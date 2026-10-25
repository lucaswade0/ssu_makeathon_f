import type { Incident, Shelter, ZoneCollection } from '../map/sampleData'
import { resourceToShelter } from '../resources/sampleData'
import type { Resource } from '../resources/schemas'
import { citedIds } from './api'
import type { SamEntry } from './context'

export const MAX_CARDS = 6
export const MAX_PINS = 20

type ZoneFeature = ZoneCollection['features'][number]

/**
 * What to show under an answer, drawn only from the app's own data: cards for the cited resources and a map of every cited
 * place. Alerts and feed posts stay in the answer's text; they never become cards or pins.
 */
export type Attachments = {
  resources: Resource[]
  /** Every cited resource with a position, for the map (can be more than the cards shown). */
  mapResources: Resource[]
  map: { shelters: Shelter[]; incidents: Incident[]; zones: ZoneFeature[] }
  /** True when there is nothing to show. */
  empty: boolean
}

export const hasPins = (map: Attachments['map']) => map.shelters.length + map.incidents.length + map.zones.length > 0

/**
 * Picks resource cards and map pins for the items an answer cites, in the order it cites them, once each. An ID the model
 * made up has no entry, so it is ignored. Everything returned is the app's real data, never text written by the model.
 */
export function attachmentsFor(answer: string, entries: Record<string, SamEntry>): Attachments {
  const result: Attachments = { resources: [], mapResources: [], map: { shelters: [], incidents: [], zones: [] }, empty: true }
  const pinRoom = () => result.map.shelters.length + result.map.incidents.length + result.map.zones.length < MAX_PINS

  for (const id of citedIds(answer)) {
    const entry = entries[id]
    if (!entry) continue
    switch (entry.kind) {
      case 'resource':
        if (result.resources.length < MAX_CARDS) result.resources.push(entry.resource)
        if (pinRoom()) { result.map.shelters.push(resourceToShelter(entry.resource)); result.mapResources.push(entry.resource) }
        break
      case 'incident': if (pinRoom()) result.map.incidents.push(entry.incident); break
      case 'zone': if (entry.feature && pinRoom()) result.map.zones.push(entry.feature); break
    }
  }
  result.empty = result.resources.length === 0 && !hasPins(result.map)
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
