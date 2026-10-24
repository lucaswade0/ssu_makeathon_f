import { useQuery } from '@tanstack/react-query'
import { z } from 'zod'
import { requireSupabase } from '../../lib/supabase'
import { citySchema, idSchema } from '../community/schemas'
import { useCommunitySession } from '../community/session'
import type { Shelter } from '../map/sampleData'

const timestamp = z.iso.datetime({ offset: true })

// Validate rows at the boundary so one bad record can't break the map.
const shelterSchema = z.object({
  id: idSchema,
  name: z.string(),
  description: z.string(),
  location_text: z.string(),
  city: citySchema,
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  status: z.enum(['official', 'verified', 'community_submitted']),
  source: z.string(),
  created_at: timestamp,
  updated_at: timestamp,
})

// author_id is left out on purpose: the map never needs to know who submitted a shelter.
const columns = 'id, name, description, location_text, city, latitude, longitude, status, source, created_at, updated_at'

export async function listShelters(city: string): Promise<Shelter[]> {
  const { data, error } = await requireSupabase()
    .from('shelters')
    .select(columns)
    .eq('city', citySchema.parse(city))
    .order('name')
  if (error) throw error
  return z.array(shelterSchema).parse(data)
}

export function useShelters(city: string) {
  const { configured } = useCommunitySession()
  const selectedCity = city.trim()
  return useQuery({
    queryKey: ['shelters', selectedCity],
    queryFn: () => listShelters(selectedCity),
    enabled: configured && Boolean(selectedCity),
    refetchInterval: 30_000,
  })
}