import type { SamTurn } from '../../../supabase/functions/ask-sam/sam'

const url = import.meta.env.VITE_SUPABASE_URL?.trim()
const key = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim()

export const samConfigured = Boolean(url && key)

/** Thrown when SAM can't be reached, so the page can explain instead of showing a raw error. */
export class SamNotDeployedError extends Error {}

const UNREACHABLE = 'SAM couldn’t be reached. Check your connection. If this keeps happening, the ask-sam server function may not be deployed yet.'

/**
 * Sends the question and the city's data to the ask-sam Edge Function and calls onText with each streamed piece.
 * The Claude API key never reaches the browser; only the public Supabase key is sent.
 */
export async function askSam(
  request: { question: string; context: string; history: SamTurn[] },
  onText: (text: string) => void,
  signal?: AbortSignal,
  fetcher: typeof fetch = fetch,
) {
  if (!url || !key) throw new Error('SAM needs the Supabase settings in .env.local.')
  let response: Response
  try {
    response = await fetcher(`${url.replace(/\/$/, '')}/functions/v1/ask-sam`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: key, Authorization: `Bearer ${key}` },
      body: JSON.stringify(request),
      signal,
    })
  } catch (error) {
    // A missing function answers 404 without CORS headers, so the browser reports it as a network failure.
    if ((error as Error).name === 'AbortError') throw error
    throw new SamNotDeployedError(UNREACHABLE)
  }
  if (response.status === 404) throw new SamNotDeployedError(UNREACHABLE)
  if (!response.ok || !response.body) throw new Error((await response.text()) || `SAM couldn’t answer (${response.status}).`)

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    onText(decoder.decode(value, { stream: true }))
  }
}

/** The IDs an answer cited, in order, without repeats, e.g. "[R1] and [Z2]" gives ["R1", "Z2"]. */
export function citedIds(answer: string) {
  return [...new Set([...answer.matchAll(/\[([AWIZRP]\d{1,3})\]/g)].map(m => m[1]!))]
}
