import type { Earthquake } from '../hazards/earthquakes'
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

export function incidentItems(incidents: Incident[], sample: boolean): NewsItem[] {
  return incidents.map(incident => {
    const fire = incident.kind === 'fire'
    const details = fire
      ? [
        incident.acres === undefined ? 'Size not reported' : `${incident.acres.toLocaleString()} acres`,
        incident.containment === undefined ? 'Containment not reported' : `${incident.containment}% contained`,
        incident.location_text,
      ]
      : [incident.location_text]
    return {
      id: incident.id,
      hazard: fire ? 'fire' : 'weather',
      source: incident.source,
      title: incident.title,
      summary: details.join(' · '),
      time: incident.updated_at,
      expires: null,
      url: sourceUrls[fire ? 'fire' : 'weather'],
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

export function earthquakeItems(quakes: Earthquake[], sample: boolean): NewsItem[] {
  return quakes.map(quake => ({
    id: quake.id,
    hazard: 'earthquake',
    source: quake.source,
    title: `Magnitude ${quake.magnitude.toFixed(1)} earthquake · ${quake.place}`,
    summary: 'Magnitude and location can be revised as more data arrives.',
    time: quake.time,
    expires: null,
    url: quake.url || sourceUrls.earthquake,
    sample,
  }))
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
