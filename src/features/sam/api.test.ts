import { describe, expect, it, vi } from 'vitest'

vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co/')
vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'sb_publishable_test')
const { askSam, citedIds, SamNotDeployedError } = await import('./api')

const streamOf = (...chunks: string[]) => new Response(new ReadableStream({
  start(controller) {
    for (const chunk of chunks) controller.enqueue(new TextEncoder().encode(chunk))
    controller.close()
  },
}))

describe('askSam', () => {
  it('posts to the ask-sam function with the public key and streams the answer', async () => {
    const fetcher = vi.fn(async () => streamOf('Finley ', 'Community Center [R1].'))
    const pieces: string[] = []
    await askSam({ question: 'Shelter?', context: 'CITY: Santa Rosa', history: [] }, t => pieces.push(t), undefined, fetcher)
    expect(pieces.join('')).toBe('Finley Community Center [R1].')
    const [calledUrl, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit]
    expect(calledUrl).toBe('https://example.supabase.co/functions/v1/ask-sam')
    expect((init.headers as Record<string, string>).apikey).toBe('sb_publishable_test')
    expect(JSON.parse(init.body as string)).toMatchObject({ question: 'Shelter?' })
  })

  it('explains when the function is not deployed, and passes other errors through', async () => {
    await expect(askSam({ question: 'q', context: '', history: [] }, () => {}, undefined, async () => new Response('', { status: 404 })))
      .rejects.toBeInstanceOf(SamNotDeployedError)
    await expect(askSam({ question: 'q', context: '', history: [] }, () => {}, undefined, async () => new Response('Slow down', { status: 429 })))
      .rejects.toThrow('Slow down')
    await expect(askSam({ question: 'q', context: '', history: [] }, () => {}, undefined, async () => { throw new TypeError('Failed to fetch') }))
      .rejects.toBeInstanceOf(SamNotDeployedError)
  })
})

describe('citedIds', () => {
  it('finds each cited ID once, in order, and ignores things that are not IDs', () => {
    expect(citedIds('Go to [R1] or [R2]. Zone [Z1] is under order; see [R1]. [X9] [see note]')).toEqual(['R1', 'R2', 'Z1'])
  })
})
