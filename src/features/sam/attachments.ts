import type { CommunityPost, OfficialAlert } from '../community/schemas'
import type { WeatherAlert } from '../hazards/liveHazards'
import type { Incident, Shelter, ZoneCollection } from '../map/sampleData'
import { incidentItems, zoneItems, type NewsItem } from '../news/newsItems'
import { resourceToShelter } from '../resources/sampleData'
import type { Resource } from '../resources/schemas'
import { citedIds } from './api'
import type { SamEntry } from './context'

export const MAX_CARDS = 6
export const MAX_PINS = 20

export type AlertAttachment = { kind: 'official'; alert: OfficialAlert } | { kind: 'weather'; alert: WeatherAlert }
type ZoneFeature = ZoneCollection['features'][number]

/** What to show under an answer, drawn only from the app's own data. */
export type Attachments = {
  alerts: AlertAttachment[]
  resources: Resource[]
  /** Every cited resource with a position, for the map (can be more than the cards shown). */
  mapResources: Resource[]
  /** Incidents and zones, as the same cards the News page uses. */
  news: NewsItem[]
  posts: CommunityPost[]
  map: { shelters: Shelter[]; incidents: Incident[]; zones: ZoneFeature[] }
  /** True when there is nothing to show. */
  empty: boolean
}

export const hasPins = (map: Attachments['map']) => map.shelters.length + map.incidents.length + map.zones.length > 0

/**
 * Picks cards and map pins for the items an answer cites, in the order it cites them, once each. An ID the model made up has
 * no entry, so it is ignored. Everything returned is the app's real data, never text written by the model.
 */
export function attachmentsFor(answer: string, entries: Record<string, SamEntry>, { simulated = false }: { simulated?: boolean } = {}): Attachments {
  const result: Attachments = { alerts: [], resources: [], mapResources: [], news: [], posts: [], map: { shelters: [], incidents: [], zones: [] }, empty: true }
  let cards = 0
  const room = () => cards < MAX_CARDS
  const pinRoom = () => result.map.shelters.length + result.map.incidents.length + result.map.zones.length < MAX_PINS

  for (const id of citedIds(answer)) {
    const entry = entries[id]
    if (!entry) continue
    switch (entry.kind) {
      case 'alert': if (room()) { result.alerts.push({ kind: 'official', alert: entry.alert }); cards++ } break
      case 'weather': if (room()) { result.alerts.push({ kind: 'weather', alert: entry.alert }); cards++ } break
      case 'resource':
        if (room()) { result.resources.push(entry.resource); cards++ }
        if (pinRoom()) { result.map.shelters.push(resourceToShelter(entry.resource)); result.mapResources.push(entry.resource) }
        break
      case 'incident':
        if (room()) { result.news.push(...incidentItems([entry.incident], simulated)); cards++ }
        if (pinRoom()) result.map.incidents.push(entry.incident)
        break
      case 'zone':
        if (room()) { result.news.push(...zoneItems([entry.zone], simulated)); cards++ }
        if (entry.feature && pinRoom()) result.map.zones.push(entry.feature)
        break
      case 'post': if (room()) { result.posts.push(entry.post); cards++ } break
    }
  }
  result.empty = cards === 0 && !hasPins(result.map)
  return result
}

/**
 * The box that holds every cited place, so the small map shows them all. Null when there is one place or none,
 * where centering on it is better.
 */
export function pinBounds(map: Attachments['map']): [[number, number], [number, number]] | null {
  const points: [number, number][] = [
    ...map.shelters.map(s => [s.longitude, s.latitude] as [number, number]),
    ...map.incidents.map(i => [i.longitude, i.latitude] as [number, number]),
    ...map.zones.flatMap(z => z.geometry.coordinates[0]!.map(p => [p[0]!, p[1]!] as [number, number])),
  ]
  if (points.length < 2) return null
  const lngs = points.map(p => p[0])
  const lats = points.map(p => p[1])
  const box: [[number, number], [number, number]] = [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]]
  return box[0][0] === box[1][0] && box[0][1] === box[1][1] ? null : box
}

/** Where to center the small map: the first cited place, or the city when only zones without a position are cited. */
export function pinCenter(map: Attachments['map'], fallback: { lat: number; lng: number }) {
  const shelter = map.shelters[0]
  if (shelter) return { lat: shelter.latitude, lng: shelter.longitude }
  const incident = map.incidents[0]
  if (incident) return { lat: incident.latitude, lng: incident.longitude }
  const ring = map.zones[0]?.geometry.coordinates[0]
  if (ring?.length) {
    const lat = ring.reduce((sum, point) => sum + point[1]!, 0) / ring.length
    const lng = ring.reduce((sum, point) => sum + point[0]!, 0) / ring.length
    return { lat, lng }
  }
  return fallback
}
