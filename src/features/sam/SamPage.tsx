import { useRef, useState, type FormEvent } from 'react'
import { Send } from 'lucide-react'
import type { SamTurn } from '../../../supabase/functions/ask-sam/sam'
import { MAX_QUESTION_CHARS } from '../../../supabase/functions/ask-sam/sam'
import { useCommunityFeed, useOfficialAlert } from '../community/hooks'
import { useEarthquakes, useEvacuationZones, useFireIncidents, useWeatherAlerts } from '../hazards/liveHazards'
import { useResources } from '../resources/hooks'
import { useSimulation } from '../simulation/context'
import { SIM_CITY } from '../simulation/scenario'
import { askSam, samConfigured, SamNotDeployedError } from './api'
import { attachmentsFor, hasPins } from './attachments'
import { buildSamContext, type SamContext, type SamEntry } from './context'
import { SamAttachments } from './SamAttachments'
import { FormattedAnswer } from './FormattedAnswer'
import { SAM_SUGGESTIONS } from './suggestions'

type Message = { role: 'user' | 'assistant'; text: string; entries?: Record<string, SamEntry>; simulated?: boolean; error?: boolean }

/** Returns a function that snapshots what SAM can see for the city, live or simulated, at the moment a question is asked. */
function useSamContext(city: string): () => SamContext {
  const sim = useSimulation()
  const resources = useResources(city)
  const alert = useOfficialAlert(city)
  const weather = useWeatherAlerts(city)
  const fires = useFireIncidents(city)
  const quakes = useEarthquakes(city)
  const zones = useEvacuationZones(city)
  const feed = useCommunityFeed(city)

  return () => {
    const now = Date.now()
    if (sim.active && sim.state) {
      return buildSamContext({
        city: SIM_CITY, now, simulated: true, alert: sim.state.alert, incidents: sim.state.incidents,
        zones: sim.state.zones.features.map(f => f.properties), zoneFeatures: sim.state.zones.features, resources: sim.state.resources, posts: sim.state.posts,
      })
    }
    return buildSamContext({
      city, now, alert: alert.data ?? null, weatherAlerts: weather.data ?? [],
      incidents: [...fires.data ?? [], ...quakes.data ?? []],
      zones: [...new Map((zones.data?.features ?? []).map(f => [f.properties.zone_id, f.properties])).values()],
      zoneFeatures: zones.data?.features ?? [],
      resources: resources.data ?? [], posts: feed.data?.pages.flatMap(p => p.posts) ?? [],
    })
  }
}

export function SamPage({ city, onOpenMap = () => {} }: { city: string; onOpenMap?: () => void }) {
  const snapshot = useSamContext(city)
  // Conversation lives only in this page's memory; nothing is stored or sent anywhere except to answer.
  const [messages, setMessages] = useState<Message[]>([])
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [expandedMapIndex, setExpandedMapIndex] = useState<number | null>(null)
  const abort = useRef<AbortController | null>(null)

  async function ask(question: string) {
    const q = question.trim()
    if (!q || busy) return
    // Only answered exchanges go back as history; a failed answer drops its question too.
    const history: SamTurn[] = messages
      .filter((m, i) => !m.error && !messages[i + 1]?.error && m.text.trim())
      .slice(-6)
      .map(m => ({ role: m.role, content: m.text }))
    const context = snapshot()
    setDraft('')
    setExpandedMapIndex(null)
    setBusy(true)
    setMessages(list => [...list, { role: 'user', text: q }, { role: 'assistant', text: '', entries: context.entries, simulated: context.simulated }])
    abort.current = new AbortController()
    const append = (text: string, error = false) => setMessages(list => {
      const last = list.at(-1)!
      return [...list.slice(0, -1), { ...last, text: last.text + text, error: last.error || error }]
    })
    try {
      await askSam({ question: q, context: context.text, history }, text => append(text), abort.current.signal)
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        append(error instanceof SamNotDeployedError ? error.message : `SAM couldn’t answer: ${(error as Error).message}`, true)
      }
    } finally {
      setBusy(false)
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    void ask(draft)
  }

  // Only the newest answer with a map keeps it live; older answers offer a button, so the chat never holds several maps.
  const lastMapIndex = messages.reduce((found, m, i) => (m.role === 'assistant' && m.entries && hasPins(attachmentsFor(m.text, m.entries).map) ? i : found), -1)
  const visibleMapIndex = expandedMapIndex ?? lastMapIndex

  return <section className="sam" aria-label="Ask SAM">
    <div className="sam-toolbar">
      <strong>Ask SAM</strong>
      <span className="muted">{city}</span>
      <span className="sam-tool-note">Use SAM to expand on the information shown in the app.</span>
    </div>

    <p className="sam-disclaimer" role="note">Not an emergency service. Call 911 and follow local official instructions.</p>

    {!samConfigured && <p className="notice">SAM needs the Supabase settings in .env.local to answer questions.</p>}

    {messages.length === 0 && <div className="sam-suggestions" aria-label="Common questions">
      {SAM_SUGGESTIONS.map(s => <button key={s} type="button" onClick={() => void ask(s)} disabled={busy || !samConfigured}>{s}</button>)}
    </div>}

    <ol className="sam-chat" aria-live="polite">
      {messages.map((m, i) => <li key={i} className={`sam-message ${m.role}${m.error ? ' error' : ''}`}>
        {m.role === 'assistant' && m.text && !m.error
          ? <FormattedAnswer text={m.text} />
          : <p className="body-text">{m.text || (busy && i === messages.length - 1 ? 'SAM is thinking…' : '')}</p>}
        {m.role === 'assistant' && m.entries && !m.error && !(busy && i === messages.length - 1) && <SamAttachments
          attachments={attachmentsFor(m.text, m.entries)} city={city} simulated={Boolean(m.simulated)}
          liveMap={i === visibleMapIndex} onShowMap={() => setExpandedMapIndex(i)} onOpenMap={onOpenMap} />}
      </li>)}
    </ol>

    <form className="sam-form" onSubmit={submit}>
      <label className="visually-hidden" htmlFor="sam-question">Ask SAM a question</label>
      <input id="sam-question" value={draft} onChange={e => setDraft(e.target.value)} maxLength={MAX_QUESTION_CHARS}
        placeholder="Ask SAM a question" disabled={busy || !samConfigured} autoComplete="off" />
      {busy
        ? <button type="button" onClick={() => abort.current?.abort()}>Stop</button>
        : <button type="submit" disabled={!draft.trim() || !samConfigured}><Send size={16} aria-hidden="true" />Ask</button>}
    </form>
  </section>
}
