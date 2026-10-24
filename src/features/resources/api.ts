import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { requireSupabase } from '../../lib/supabase'
import { citySchema, idSchema } from '../community/schemas'
import { reportInputSchema, resourceInputSchema, resourceSchema } from './schemas'
import type { ReportReason, ResourceInput } from './schemas'

const columns = 'id, author_id, category, title, description, location_text, city, latitude, longitude, status, source, last_confirmed_at, created_at, updated_at'

async function userId(client: SupabaseClient) {
  const { data, error } = await client.auth.getUser()
  if (error) throw error
  if (!data.user) throw new Error('Sign in to add or report a resource.')
  return data.user.id
}

// A client can be injected for tests. RLS in the database remains the authority:
// residents can only create community-submitted rows and report one resource once.
export function createResourcesApi(getClient: () => SupabaseClient = requireSupabase) {
  return {
    async list(city: string) {
      const { data, error } = await getClient().from('resources').select(columns)
        .eq('city', citySchema.parse(city)).order('category').order('title')
      if (error) throw error
      return z.array(resourceSchema).parse(data)
    },

    async create(input: ResourceInput) {
      const values = resourceInputSchema.parse(input)
      const client = getClient()
      const owner = await userId(client)
      const { data, error } = await client.from('resources')
        .insert({ ...values, author_id: owner, status: 'community_submitted', source: 'Community submission' })
        .select(columns).single()
      if (error) throw error
      return resourceSchema.parse(data)
    },

    async report(resourceId: string, reason: ReportReason, details?: string) {
      const values = reportInputSchema.parse({ reason, details })
      const id = idSchema.parse(resourceId)
      const client = getClient()
      const reporter = await userId(client)
      const { error } = await client.from('resource_reports')
        .insert({ resource_id: id, reporter_id: reporter, reason: values.reason, details: values.details || null })
      if (error) {
        if (error.code === '23505') throw new Error('You already reported this resource. Thank you.')
        throw error
      }
    },

    async remove(resourceId: string) {
      const id = idSchema.parse(resourceId)
      const client = getClient()
      const owner = await userId(client)
      const { error } = await client.from('resources').delete().eq('id', id).eq('author_id', owner)
      if (error) throw error
    },
  }
}

export const resourcesApi = createResourcesApi()
