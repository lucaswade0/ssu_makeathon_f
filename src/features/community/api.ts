import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { requireSupabase } from '../../lib/supabase'
import {
  alertSchema, citySchema, cursorSchema, displayNameSchema, idSchema,
  postEditSchema, postInputSchema, postSchema, replyInputSchema, replySchema,
} from './schemas'
import type { FeedCursor, PostEdit, PostInput } from './schemas'

const passwordSchema = z.string().min(8, 'Use at least 8 characters.').max(72)

const postSelect = 'id,author_id,city,post_type,body,photo_paths,created_at,updated_at,author:profiles!posts_author_id_fkey(id,display_name)'
const replySelect = 'id,post_id,author_id,body,created_at,updated_at,author:profiles!post_replies_author_id_fkey(id,display_name)'

async function userId(client: SupabaseClient) {
  const { data, error } = await client.auth.getUser()
  if (error) throw error
  if (!data.user) throw new Error('Sign in to contribute to your community.')
  return data.user.id
}

// A client can be injected for tests. The default uses only the public browser key;
// the database's RLS policies remain the authority for all ownership checks.
export function createCommunityApi(getClient: () => SupabaseClient = requireSupabase) {
  return {
    // Returns needsConfirmation when the project still requires email confirmation.
    async signUp(email: string, password: string, displayName: string) {
      const address = z.email().parse(email.trim())
      const name = displayNameSchema.parse(displayName)
      const { data, error } = await getClient().auth.signUp({
        email: address,
        password: passwordSchema.parse(password),
        options: { data: { display_name: name } },
      })
      if (error) throw error
      return { needsConfirmation: !data.session }
    },

    async signIn(email: string, password: string) {
      const address = z.email().parse(email.trim())
      const { error } = await getClient().auth.signInWithPassword({ email: address, password })
      if (error) throw error
    },

    async signOut() {
      const { error } = await getClient().auth.signOut()
      if (error) throw error
    },

    async updateDisplayName(displayName: string) {
      const name = displayNameSchema.parse(displayName)
      const client = getClient()
      const owner = await userId(client)
      const { data, error } = await client.from('profiles').update({ display_name: name })
        .eq('id', owner).select('id,display_name').single()
      if (error) throw error
      return data
    },

    async listPosts(city: string, cursor?: FeedCursor, pageSize = 30) {
      const selectedCity = citySchema.parse(city)
      const size = z.number().int().min(1).max(50).parse(pageSize)
      let query = getClient().from('posts').select(postSelect)
        .eq('city', selectedCity).order('created_at', { ascending: false })
        .order('id', { ascending: false }).limit(size + 1)
      if (cursor) {
        const after = cursorSchema.parse(cursor)
        query = query.or(`created_at.lt.${after.created_at},and(created_at.eq.${after.created_at},id.lt.${after.id})`)
      }
      const { data, error } = await query
      if (error) throw error
      const rows = z.array(postSchema).parse(data)
      const posts = rows.slice(0, size)
      const last = posts.at(-1)
      return {
        posts,
        nextCursor: rows.length > size && last
          ? { created_at: last.created_at, id: last.id } : undefined,
      }
    },

    async latestAlert(city: string) {
      const { data, error } = await getClient().from('official_alerts').select('*')
        .eq('city', citySchema.parse(city)).order('issued_at', { ascending: false })
        .order('id', { ascending: false }).limit(1).maybeSingle()
      if (error) throw error
      // Return expiry metadata, including expired alerts; the UI must label staleness.
      return data ? alertSchema.parse(data) : null
    },

    async createPost(input: PostInput) {
      const values = postInputSchema.parse(input)
      const client = getClient()
      const owner = await userId(client)
      const { data, error } = await client.from('posts')
        .insert({ ...values, author_id: owner }).select(postSelect).single()
      if (error) throw error
      return postSchema.parse(data)
    },

    async editPost(id: string, input: PostEdit) {
      const postId = idSchema.parse(id)
      const values = postEditSchema.parse(input)
      const client = getClient()
      const owner = await userId(client)
      const { data, error } = await client.from('posts').update(values)
        .eq('id', postId).eq('author_id', owner).select(postSelect).single()
      if (error) throw error
      return postSchema.parse(data)
    },

    async deletePost(id: string) {
      const postId = idSchema.parse(id)
      const client = getClient()
      const owner = await userId(client)
      // Replies are removed atomically by the existing database cascade.
      const { error } = await client.from('posts').delete()
        .eq('id', postId).eq('author_id', owner).select('id').single()
      if (error) throw error
    },

    async listReplies(postId: string, cursor?: FeedCursor, pageSize = 50) {
      const id = idSchema.parse(postId)
      const size = z.number().int().min(1).max(100).parse(pageSize)
      let query = getClient().from('post_replies').select(replySelect)
        .eq('post_id', id).order('created_at', { ascending: true })
        .order('id', { ascending: true }).limit(size + 1)
      if (cursor) {
        const after = cursorSchema.parse(cursor)
        query = query.or(`created_at.gt.${after.created_at},and(created_at.eq.${after.created_at},id.gt.${after.id})`)
      }
      const { data, error } = await query
      if (error) throw error
      const rows = z.array(replySchema).parse(data)
      const replies = rows.slice(0, size)
      const last = replies.at(-1)
      return {
        replies,
        nextCursor: rows.length > size && last
          ? { created_at: last.created_at, id: last.id } : undefined,
      }
    },

    async createReply(postId: string, body: string) {
      const id = idSchema.parse(postId)
      const values = replyInputSchema.parse({ body })
      const client = getClient()
      const owner = await userId(client)
      const { data, error } = await client.from('post_replies')
        .insert({ ...values, post_id: id, author_id: owner }).select(replySelect).single()
      if (error) throw error
      return replySchema.parse(data)
    },

    async editReply(id: string, body: string) {
      const replyId = idSchema.parse(id)
      const values = replyInputSchema.parse({ body })
      const client = getClient()
      const owner = await userId(client)
      const { data, error } = await client.from('post_replies').update(values)
        .eq('id', replyId).eq('author_id', owner).select(replySelect).single()
      if (error) throw error
      return replySchema.parse(data)
    },

    async deleteReply(id: string) {
      const replyId = idSchema.parse(id)
      const client = getClient()
      const owner = await userId(client)
      const { error } = await client.from('post_replies').delete()
        .eq('id', replyId).eq('author_id', owner).select('id').single()
      if (error) throw error
    },
  }
}

export const communityApi = createCommunityApi()
