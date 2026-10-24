import { describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createCommunityApi } from './api'

const owner = '00000000-0000-4000-8000-000000000001'
const postId = '00000000-0000-4000-8000-000000000002'
const timestamp = '2026-10-24T05:00:00+00:00'
const post = {
  id: postId, author_id: owner, city: 'Santa Rosa', post_type: 'update',
  body: 'Water available at the community center.', photo_paths: [],
  created_at: timestamp, updated_at: timestamp,
  author: { id: owner, display_name: 'Alex' },
}

function setup(result: { data: unknown; error: unknown } = { data: post, error: null }) {
  const query = {
    select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(), limit: vi.fn().mockReturnThis(),
    or: vi.fn().mockReturnThis(), insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(), delete: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(result), maybeSingle: vi.fn().mockResolvedValue(result),
    then: (resolve: (value: typeof result) => unknown) => Promise.resolve(result).then(resolve),
  }
  const client = {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: owner } }, error: null }) },
    from: vi.fn(() => query),
  }
  return { query, client, api: createCommunityApi(() => client as unknown as SupabaseClient) }
}

describe('community API boundaries', () => {
  it('rejects blank and oversized content before contacting the backend', async () => {
    const { api, client } = setup()
    await expect(api.createPost({ city: 'Santa Rosa', body: '  ' })).rejects.toThrow()
    await expect(api.createReply(postId, 'x'.repeat(2001))).rejects.toThrow()
    expect(client.auth.getUser).not.toHaveBeenCalled()
    expect(client.from).not.toHaveBeenCalled()
  })

  it('requires authentication and does not attempt an anonymous write', async () => {
    const { api, client } = setup()
    client.auth.getUser.mockResolvedValueOnce({ data: { user: null }, error: null })
    await expect(api.createPost({ city: 'Santa Rosa', body: 'Hello' })).rejects.toThrow('Sign in')
    expect(client.from).not.toHaveBeenCalled()
  })

  it('uses the authenticated identity and strips injected ownership and attachment fields', async () => {
    const { api, query } = setup()
    const input = { city: ' Santa Rosa ', body: ' Hello ', author_id: postId, photo_paths: ['someone-elses-photo'] }
    await api.createPost(input)
    expect(query.insert).toHaveBeenCalledWith({
      city: 'Santa Rosa', body: 'Hello', post_type: 'update', author_id: owner,
    })
  })

  it('restricts edits to the owner without allowing city or author reassignment', async () => {
    const { api, query } = setup()
    await api.editPost(postId, { body: 'Updated', post_type: 'question', city: 'Elsewhere', author_id: postId } as never)
    expect(query.update).toHaveBeenCalledWith({ body: 'Updated', post_type: 'question' })
    expect(query.eq).toHaveBeenCalledWith('id', postId)
    expect(query.eq).toHaveBeenCalledWith('author_id', owner)
  })

  it('reports a denied or missing delete instead of pretending it succeeded', async () => {
    const error = new Error('No matching row')
    const { api, query } = setup({ data: null, error })
    await expect(api.deletePost(postId)).rejects.toThrow('No matching row')
    expect(query.eq).toHaveBeenCalledWith('author_id', owner)
  })

  it('preserves an existing question type when only its text is edited', async () => {
    const { api, query } = setup()
    await api.editPost(postId, { body: 'Revised question' })
    expect(query.update).toHaveBeenCalledWith({ body: 'Revised question' })
  })

  it('paginates equal timestamps by id and never mixes cities', async () => {
    const older = { ...post, id: '00000000-0000-4000-8000-000000000000' }
    const { api, query } = setup({ data: [post, older], error: null })
    const page = await api.listPosts(' Santa Rosa ', undefined, 1)
    expect(page.posts).toEqual([post])
    expect(page.nextCursor).toEqual({ created_at: timestamp, id: postId })
    expect(query.eq).toHaveBeenCalledWith('city', 'Santa Rosa')
    await api.listPosts('Santa Rosa', page.nextCursor, 1)
    expect(query.or).toHaveBeenCalledWith(`created_at.lt.${timestamp},and(created_at.eq.${timestamp},id.lt.${postId})`)
  })

  it('rejects filter injection in cursor fields', async () => {
    const { api, query } = setup()
    await expect(api.listPosts('Santa Rosa', { id: 'bad),city.neq.foo', created_at: timestamp })).rejects.toThrow()
    expect(query.or).not.toHaveBeenCalled()
  })

  it('propagates read failures for the UI error state', async () => {
    const { api } = setup({ data: null, error: new Error('Network unavailable') })
    await expect(api.listPosts('Santa Rosa')).rejects.toThrow('Network unavailable')
  })

  it('only addresses the replies table when creating a one-level reply', async () => {
    const reply = { id: postId, post_id: postId, author_id: owner, body: 'Thanks',
      created_at: timestamp, updated_at: timestamp, author: post.author }
    const { api, client, query } = setup({ data: reply, error: null })
    expect(await api.createReply(postId, ' Thanks ')).toEqual(reply)
    expect(client.from).toHaveBeenCalledWith('post_replies')
    expect(query.insert).toHaveBeenCalledWith({ post_id: postId, author_id: owner, body: 'Thanks' })
  })

  it('returns no pinned alert for a city with no official information', async () => {
    const { api, query } = setup({ data: null, error: null })
    expect(await api.latestAlert('Santa Rosa')).toBeNull()
    expect(query.eq).toHaveBeenCalledWith('city', 'Santa Rosa')
    expect(query.order).toHaveBeenCalledWith('issued_at', { ascending: false })
  })
})
