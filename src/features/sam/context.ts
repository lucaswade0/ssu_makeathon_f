import type { CommunityPost, OfficialAlert } from '../community/schemas'
import { nearbyCities, type WeatherAlert } from '../hazards/liveHazards'
import type { Incident, ZoneCollection, ZoneProperties } from '../map/sampleData'
import { timeAgo } from '../resources/format'
import { statusLabels, type Resource } from '../resources/schemas'

export type SamInput = {
  city: string
  now: number
  simulated?: boolean
  alert?: OfficialAlert | null
  weatherAlerts?: WeatherAlert[]
  incidents?: Incident[]
  zones?: ZoneProperties[]
  /** The map shapes for `zones`, so an answer that cites a zone can show it on a map. */
  zoneFeatures?: ZoneCollection['features']
  resources?: Resource[]
  posts?: CommunityPost[]
}

/** The real object behind an ID, so the page can show the actual card instead of anything the model wrote. */
export type SamEntry =
  | { kind: 'alert'; alert: OfficialAlert }
  | { kind: 'weather'; alert: WeatherAlert }
  | { kind: 'incident'; incident: Incident }
  | { kind: 'zone'; zone: ZoneProperties; feature?: ZoneCollection['features'][number] }
  | { kind: 'resource'; resource: Resource }
  | { kind: 'post'; post: CommunityPost }

/** Text SAM reads, plus a label for every ID in it so the page can show what an answer cited. */
export type SamContext = { text: string; sources: Record<string, string>; entries: Record<string, SamEntry>; simulated: boolean }

// Keeps a busy city's data to a few thousand tokens.
export const MAX_RESOURCES = 60
export const MAX_POSTS = 30

// Collapses newlines and extra spaces so submitted text can't start a new line
// and pass itself off as another entry (e.g. a fake "[R9] Official shelter").
const oneLine = (text: string) => text.replace(/\s+/g, ' ').trim()
// Resident-written text is quoted and capped so it reads as data, not as instructions.
const quoted = (text: string, max = 300) => `"${oneLine(text).replaceAll('"', "'").slice(0, max)}"`

export function buildSamContext(input: SamInput): SamContext {
  const { now } = input
  const lines: string[] = [`CITY: ${oneLine(input.city)}`]
  const sources: Record<string, string> = {}
  const entries: Record<string, SamEntry> = {}
  const nearby = nearbyCities(input.city)
  if (nearby.length) lines.push(`NEARBY CITIES (approximate straight-line distance between city centers): ${nearby.map(c => `${c.name} ${c.km} km ${c.direction}`).join(', ')}`)
  if (input.simulated) lines.push('NOTE: a disaster SIMULATION is running. Everything below is sample data, not real events.')

  function section(title: string, prefix: string, items: string[][], labels: string[], objects: SamEntry[]) {
    lines.push(`${title}:`)
    if (!items.length) lines.push('none listed')
    items.forEach((parts, i) => {
      const id = `${prefix}${i + 1}`
      sources[id] = labels[i]!
      entries[id] = objects[i]!
      lines.push([`[${id}] ${parts[0]}`, ...parts.slice(1)].join(' · '))
    })
  }

  const alert = input.alert
  section('OFFICIAL ALERT (local responders)', 'A',
    alert ? [[oneLine(alert.title), quoted(alert.instructions, 600), `source ${oneLine(alert.source_name)}`, `issued ${timeAgo(alert.issued_at, now)}`,
      alert.expires_at && Date.parse(alert.expires_at) <= now ? 'EXPIRED' : 'active']] : [],
    alert ? [alert.title] : [],
    alert ? [{ kind: 'alert', alert }] : [])

  const weather = input.weatherAlerts ?? []
  section('WEATHER ALERTS (National Weather Service, public data)', 'W',
    weather.map(w => [oneLine(w.event), `severity ${w.severity}`, w.headline ? quoted(w.headline) : 'no headline',
      w.expires ? `expires ${new Date(w.expires).toUTCString()}` : 'no expiry listed']),
    weather.map(w => w.event),
    weather.map(w => ({ kind: 'weather', alert: w })))

  const incidents = input.incidents ?? []
  section('INCIDENTS (wildfires from NIFC, earthquakes from USGS, public data)', 'I',
    incidents.map(i => [oneLine(i.title), i.kind, oneLine(i.location_text),
      ...(i.acres !== undefined ? [`${i.acres} acres`, i.containment !== undefined ? `${i.containment}% contained` : 'containment not reported'] : []),
      `updated ${timeAgo(i.updated_at, now)}`]),
    incidents.map(i => i.title),
    incidents.map(i => ({ kind: 'incident', incident: i })))

  const zones = input.zones ?? []
  section('EVACUATION ZONES', 'Z',
    zones.map(z => [`Zone ${oneLine(z.zone_id)}`, z.level === 'order' ? 'EVACUATION ORDER' : 'EVACUATION WARNING', z.hazard,
      quoted(z.instructions), `source ${oneLine(z.source)}`, z.issued_at ? `updated ${timeAgo(z.issued_at, now)}` : 'update time not reported']),
    zones.map(z => `Zone ${z.zone_id}`),
    zones.map(z => ({ kind: 'zone', zone: z, feature: input.zoneFeatures?.find(f => f.properties.zone_id === z.zone_id) })))

  const resources = (input.resources ?? []).slice(0, MAX_RESOURCES)
  section('RESOURCES', 'R',
    resources.map(r => [oneLine(r.title), r.category, statusLabels[r.status], `updated ${timeAgo(r.updated_at, now)}`, oneLine(r.location_text)]),
    resources.map(r => r.title),
    resources.map(r => ({ kind: 'resource', resource: r })))

  const posts = [...input.posts ?? []].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at)).slice(0, MAX_POSTS)
  section('FEED POSTS (residents, unverified)', 'P',
    posts.map(p => [quoted(p.body), p.post_type, `by ${oneLine(p.author?.display_name ?? 'a resident')}`, timeAgo(p.created_at, now)]),
    posts.map(p => `Post by ${p.author?.display_name ?? 'a resident'}`),
    posts.map(p => ({ kind: 'post', post: p })))

  return { text: lines.join('\n'), sources, entries, simulated: Boolean(input.simulated) }
}
