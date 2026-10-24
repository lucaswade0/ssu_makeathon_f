import { useQuery } from '@tanstack/react-query'
import { z } from 'zod'
import { cityCenter, hasLiveCoverage } from './liveHazards'

const QUAKE_RADIUS_KM = 100
const MIN_MAGNITUDE = 2.5
const LOOKBACK_DAYS = 7

const quakeResponseSchema = z.object({
  features: z.array(z.object({
    id: z.string(),
    properties: z.object({
      mag: z.number().nullable(),
      place: z.string().nullable(),
      time: z.number(),
      url: z.string(),
    }),
  })),
})

export type Earthquake = {
  id: string
  magnitude: number
  place: string
  time: string
  url: string
  source: string
}

// USGS event search: recent earthquakes within about 100 km of the city. No key needed.
async function fetchEarthquakes(city: string): Promise<Earthquake[]> {
  const { lat, lng } = cityCenter(city)
  const query = new URLSearchParams({
    format: 'geojson',
    latitude: String(lat),
    longitude: String(lng),
    maxradiuskm: String(QUAKE_RADIUS_KM),
    minmagnitude: String(MIN_MAGNITUDE),
    starttime: new Date(Date.now() - LOOKBACK_DAYS * 86_400_000).toISOString().slice(0, 10),
    orderby: 'time',
    limit: '20',
  })
  const response = await fetch(`https://earthquake.usgs.gov/fdsnws/event/1/query?${query}`)
  if (!response.ok) throw new Error(`Earthquake request failed (${response.status})`)
  return quakeResponseSchema.parse(await response.json()).features.flatMap(({ id, properties: p }) => p.mag === null ? [] : [{
    id: `usgs-${id}`,
    magnitude: p.mag,
    place: p.place ?? 'Location not listed',
    time: new Date(p.time).toISOString(),
    url: p.url,
    source: 'USGS Earthquake Hazards Program',
  }])
}

export function useEarthquakes(city: string) {
  return useQuery({
    queryKey: ['hazards', 'earthquakes', city.trim()],
    queryFn: () => fetchEarthquakes(city),
    refetchInterval: 5 * 60_000,
    retry: 1,
    enabled: hasLiveCoverage(city),
  })
}

const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString()

// Shown only in the sample scenario. Not a real event.
export const sampleEarthquakes: Earthquake[] = [{
  id: 'sample-quake-1',
  magnitude: 3.1,
  place: '6 km NW of The Geysers, CA',
  time: minutesAgo(90),
  url: 'https://earthquake.usgs.gov/earthquakes/map/',
  source: 'Sample data (USGS)',
}]
