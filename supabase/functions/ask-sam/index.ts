// ask-sam: answers resident questions with Claude, using the city data the app sends.
// The Anthropic API key lives only here, as a Supabase secret: supabase secrets set ANTHROPIC_API_KEY=...
// Deploy: supabase functions deploy ask-sam
import Anthropic from 'npm:@anthropic-ai/sdk@0.133.0'
import { SYSTEM_PROMPT, userTurn, validateSamRequest } from './sam.ts'

const client = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY') })

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// shortcut: in-memory per-IP limit, reset whenever the function restarts and not shared between instances;
// enough to stop casual abuse of the API key during a demo, move to a database counter for real traffic.
const QUESTIONS_PER_HOUR = 20
const recent = new Map<string, number[]>()
function allow(ip: string) {
  const hourAgo = Date.now() - 3_600_000
  const times = (recent.get(ip) ?? []).filter(t => t > hourAgo)
  if (times.length >= QUESTIONS_PER_HOUR) return false
  recent.set(ip, [...times, Date.now()])
  return true
}

const reply = (status: number, text: string) =>
  new Response(text, { status, headers: { ...cors, 'Content-Type': 'text/plain; charset=utf-8' } })

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return reply(405, 'Use POST.')

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  if (!allow(ip)) return reply(429, `You've asked ${QUESTIONS_PER_HOUR} questions this hour. Please try again later.`)

  let body: unknown
  try { body = await req.json() } catch { return reply(400, 'Send a JSON body.') }
  const request = validateSamRequest(body)
  if (typeof request === 'string') return reply(400, request)

  const stream = client.beta.messages.stream({
    model: 'claude-opus-5-5',
    max_tokens: 4_000,
    // Chat answers are short; low effort keeps them fast. On a safety-classifier decline, the API retries on a fallback model.
    output_config: { effort: 'low' },
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
    messages: [...request.history, { role: 'user', content: userTurn(request) }],
    tools: [{
      type: 'web_search_20260209',
      name: 'web_search',
      max_uses: 2,
      allowed_domains: ['socoemergency.org', 'weather.gov', 'fire.ca.gov', 'redcross.org', 'ready.gov'],
    }],
  })

  const encoder = new TextEncoder()
  const body$ = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const event of stream) {
          if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') controller.enqueue(encoder.encode(event.delta.text))
        }
        const final = await stream.finalMessage()
        if (final.stop_reason === 'refusal') controller.enqueue(encoder.encode('\n\nSAM can’t help with that. For emergencies call 911, and follow instructions from local officials.'))
        if (final.stop_reason === 'max_tokens') controller.enqueue(encoder.encode('…'))
      } catch (error) {
        console.error('ask-sam failed', error)
        controller.enqueue(encoder.encode('\n\nSAM ran into a problem answering. Please try again in a moment.'))
      } finally {
        controller.close()
      }
    },
  })
  return new Response(body$, { headers: { ...cors, 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' } })
})
