import { describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createResourcesApi } from './api'

const owner = '00000000-0000-4000-8000-000000000001'
const rid = '00000000-0000-4000-8000-000000000002'
const ts = '2026-10-24T05:00:00+00:00'
const row = {
  id: rid, author_id: owner, category: 'water_food', title: 'Water', description: 'Bottled water', location_text: 'Main St',
  city: 'Santa Rosa', latitude: 38.4, longitude: -122.7, status: 'community_submitted', source: 'Community submission',
  last_confirmed_at: ts, created_at: ts, updated_at: ts,
}
const input = { category: 'water_food' as const, title: 'Water', description: 'Bottled water', location_text: 'Main St', city: 'Santa Rosa', latitude: 38.4, longitude: -122.7 }

function setup(result: { data: unknown; error: unknown } = { data: row, error: null }, signedIn = true) {
  const query = {
    select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), order: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(), delete: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(result),
    then: (resolve: (value: typeof result) => unknown) => Promise.resolve(result).then(resolve),
  }
  const client = {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: signedIn ? { id: owner } : null }, error: null }) },
    from: vi.fn(() => query),
  }
  return { query, client, api: createResourcesApi(() => client as unknown as SupabaseClient) }
}

describe('resources API', () => {
  it('lists resources for a trimmed city', async () => {
    const { api, query, client } = setup({ data: [row], error: null })
    expect(await api.list(' Santa Rosa ')).toHaveLength(1)
    expect(client.from).toHaveBeenCalledWith('resources')
    expect(query.eq).toHaveBeenCalledWith('city', 'Santa Rosa')
  })

  it('propagates read failures instead of returning an empty list', async () => {
    const { api } = setup({ data: null, error: new Error('Network unavailable') })
    await expect(api.list('Santa Rosa')).rejects.toThrow('Network unavailable')
  })

  it('rejects a malformed row from the database', async () => {
    const { api } = setup({ data: [{ ...row, category: 'weapons' }], error: null })
    await expect(api.list('Santa Rosa')).rejects.toThrow()
  })

  it('always submits as community-submitted, whatever the caller passes', async () => {
    const { api, query } = setup()
    await api.create({ ...input, status: 'official', source: 'Sonoma County' } as never)
    expect(query.insert).toHaveBeenCalledWith(expect.objectContaining({ author_id: owner, status: 'community_submitted', source: 'Community submission' }))
  })

  it('rejects blank or invalid submissions before contacting the backend', async () => {
    const { api, client } = setup()
    await expect(api.create({ ...input, title: '  ' })).rejects.toThrow()
    await expect(api.create({ ...input, latitude: 200 })).rejects.toThrow()
    expect(client.auth.getUser).not.toHaveBeenCalled()
    expect(client.from).not.toHaveBeenCalled()
  })

  it('requires sign-in and does not write anonymously', async () => {
    const { api, query } = setup(undefined, false)
    await expect(api.create(input)).rejects.toThrow('Sign in')
    await expect(api.report(rid, 'unsafe')).rejects.toThrow('Sign in')
    expect(query.insert).not.toHaveBeenCalled()
  })

  it('files a report against one resource with the reporter id', async () => {
    const { api, query, client } = setup({ data: null, error: null })
    await api.report(rid, 'unsafe', '  Gate was locked  ')
    expect(client.from).toHaveBeenCalledWith('resource_reports')
    expect(query.insert).toHaveBeenCalledWith({ resource_id: rid, reporter_id: owner, reason: 'unsafe', details: 'Gate was locked' })
  })

  it('stores no details when the field is empty', async () => {
    const { api, query } = setup({ data: null, error: null })
    await api.report(rid, 'closed', '')
    expect(query.insert).toHaveBeenCalledWith(expect.objectContaining({ details: null }))
  })

  it('turns a duplicate report into a friendly message', async () => {
    const { api } = setup({ data: null, error: { code: '23505', message: 'duplicate key' } })
    await expect(api.report(rid, 'unsafe')).rejects.toThrow('already reported')
  })

  it('rejects an unknown reason or malformed id before any request', async () => {
    const { api, client } = setup()
    await expect(api.report(rid, 'spam' as never)).rejects.toThrow()
    await expect(api.report('not-a-uuid', 'unsafe')).rejects.toThrow()
    expect(client.from).not.toHaveBeenCalled()
  })

  it('only deletes the signed-in user\'s own resource', async () => {
    const { api, query } = setup({ data: null, error: null })
    await api.remove(rid)
    expect(query.delete).toHaveBeenCalled()
    expect(query.eq).toHaveBeenCalledWith('id', rid)
    expect(query.eq).toHaveBeenCalledWith('author_id', owner)
  })
})
