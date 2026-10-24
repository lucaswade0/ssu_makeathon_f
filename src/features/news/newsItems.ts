import type { WeatherAlert } from '../hazards/liveHazards'
import type { Incident, ZoneProperties } from '../map/sampleData'

export type NewsHazard = 'weather' | 'fire' | 'evacuation' | 'earthquake'

export type NewsItem = {
  id: string
  hazard: NewsHazard
  source: string
  title: string
  summary: string
  time: string | null
  expires: string | null
  url: string
  level?: 'order' | 'warning'
  sample: boolean
}

export const hazardLabels: Record<NewsHazard, string> = {
  weather: 'Weather',
  fire: 'Fire',
  evacuation: 'Evacuation',
  earthquake: 'Earthquake',
}

// Generic agency home pages. They are where a resident goes to confirm current information.
const sourceUrls: Record<NewsHazard, string> = {
  weather: 'https://www.weather.gov/',
  fire: 'https://inciweb.wildfire.gov/',
  evacuation: 'https://www.caloes.ca.gov/',
  earthquake: 'https://earthquake.usgs.gov/earthquakes/map/',
}

export function weatherItems(alerts: WeatherAlert[]): NewsItem[] {
  return alerts.map(alert => ({
    id: alert.id,
    hazard: 'weather',
    source: alert.senderName,
    title: alert.headline ?? alert.event,
    summary: `${alert.severity} · Affects ${alert.areaDesc}`,
    time: alert.effective,
    expires: alert.expires,
    url: sourceUrls.weather,
    sample: false,
  }))
}

const incidentHazards: Record<Incident['kind'], NewsHazard> = { fire: 'fire', flood: 'weather', heat: 'weather', earthquake: 'earthquake' }

export function incidentItems(incidents: Incident[], sample: boolean): NewsItem[] {
  return incidents.map(incident => {
    const hazard = incidentHazards[incident.kind]
    const details = incident.kind === 'fire'
      ? [
        incident.acres === undefined ? 'Size not reported' : `${incident.acres.toLocaleString()} acres`,
        incident.containment === undefined ? 'Containment not reported' : `${incident.containment}% contained`,
        incident.location_text,
      ]
      : incident.kind === 'earthquake'
        ? [incident.location_text, 'Magnitude and location can be revised as more data arrives']
        : [incident.location_text]
    return {
      id: incident.id,
      hazard,
      source: incident.source,
      title: incident.title,
      summary: details.join(' · '),
      time: incident.updated_at,
      expires: null,
      url: sourceUrls[hazard],
      sample,
    }
  })
}

export function zoneItems(zones: ZoneProperties[], sample: boolean): NewsItem[] {
  return zones.map(zone => ({
    id: `zone-${zone.zone_id}`,
    hazard: 'evacuation',
    source: zone.source,
    title: `${zone.level === 'order' ? 'Evacuation order' : 'Evacuation warning'} · Zone ${zone.zone_id}`,
    summary: zone.instructions,
    time: zone.issued_at,
    expires: null,
    url: sourceUrls.evacuation,
    level: zone.level,
    sample,
  }))
}

export function filterNews(items: NewsItem[], filter: 'all' | NewsHazard): NewsItem[] {
  return filter === 'all' ? items : items.filter(item => item.hazard === filter)
}

// Shown only in the sample scenario. Not a real event.
export const sampleEarthquake: Incident = {
  id: 'sample-quake-1',
  kind: 'earthquake',
  title: 'M3.1 earthquake',
  location_text: '6 km NW of The Geysers, CA',
  latitude: 38.81,
  longitude: -122.83,
  source: 'Sample data (USGS)',
  updated_at: new Date(Date.now() - 90 * 60_000).toISOString(),
}

export function isExpired(item: NewsItem, now: number) {
  return item.expires !== null && Date.parse(item.expires) <= now
}

// Current items first, newest first. Expired items go to the bottom and items without a time last.
export function sortNews(items: NewsItem[], now: number): NewsItem[] {
  const rank = (item: NewsItem) => (isExpired(item, now) ? 1 : 0)
  const time = (item: NewsItem) => (item.time ? Date.parse(item.time) : 0)
  return [...items].sort((a, b) => rank(a) - rank(b) || time(b) - time(a))
}
