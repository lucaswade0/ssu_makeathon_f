import { useQuery } from '@tanstack/react-query'
import { z } from 'zod'
import type { Incident } from '../map/sampleData'

const SANTA_ROSA = { lat: 38.4404, lng: -122.7141 }

// shortcut: only the demo city has coordinates; other cities fall back to Santa Rosa. Replace with geocoding when city detection lands.
const cityCenters: Record<string, { lat: number; lng: number }> = {
  'Santa Rosa': SANTA_ROSA,
}

export function cityCenter(city: string) {
  return cityCenters[city.trim()] ?? SANTA_ROSA
}

const clockTime = (ms: number) => new Date(ms).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
export { clockTime }

function titleCase(text: string) {
  return text.toLowerCase().replace(/\b\w/g, letter => letter.toUpperCase())
}

// ---------- Wildfires: NIFC WFIGS current incident locations ----------

const WFIGS_URL = 'https://services3.arcgis.com/T4QMspbfLg3qTGWY/arcgis/rest/services/WFIGS_Incident_Locations_Current/FeatureServer/0/query'
const SEARCH_RADIUS_DEG = 0.6 // roughly 65 km around the city

const fireResponseSchema = z.object({
  features: z.array(z.object({
    geometry: z.object({ coordinates: z.tuple([z.number(), z.number()]) }).nullable(),
    properties: z.object({
      IrwinID: z.string(),
      IncidentName: z.string(),
      IncidentSize: z.number().nullable(),
      PercentContained: z.number().nullable(),
      ModifiedOnDateTime_dt: z.number(),
      POOCounty: z.string().nullable(),
    }),
  })),
})

async function fetchFires(city: string): Promise<Incident[]> {
  const { lat, lng } = cityCenter(city)
  const params = new URLSearchParams({
    where: "IncidentTypeCategory = 'WF'",
    geometry: [lng - SEARCH_RADIUS_DEG, lat - SEARCH_RADIUS_DEG, lng + SEARCH_RADIUS_DEG, lat + SEARCH_RADIUS_DEG].join(','),
    geometryType: 'esriGeometryEnvelope',
    inSR: '4326',
    spatialRel: 'esriSpatialRelIntersects',
    outFields: 'IrwinID,IncidentName,IncidentSize,PercentContained,ModifiedOnDateTime_dt,POOCounty',
    f: 'geojson',
  })
  const response = await fetch(`${WFIGS_URL}?${params}`)
  if (!response.ok) throw new Error(`Wildfire data request failed (${response.status})`)
  const data = fireResponseSchema.parse(await response.json())

  return data.features.flatMap(({ geometry, properties: p }) => geometry ? [{
    id: `wfigs-${p.IrwinID}`,
    kind: 'fire' as const,
    title: `Wildfire · ${titleCase(p.IncidentName)}`,
    location_text: p.POOCounty ? `${p.POOCounty} County` : 'Location not listed',
    latitude: geometry.coordinates[1],
    longitude: geometry.coordinates[0],
    acres: p.IncidentSize ?? undefined,
    containment: p.PercentContained ?? undefined,
    source: 'NIFC WFIGS (national wildfire data)',
    updated_at: new Date(p.ModifiedOnDateTime_dt).toISOString(),
  }] : [])
}

export function useFireIncidents(city: string) {
  return useQuery({
    queryKey: ['hazards', 'fires', city.trim()],
    queryFn: () => fetchFires(city),
    refetchInterval: 5 * 60_000,
    retry: 1,
  })
}

// ---------- Weather alerts: National Weather Service ----------

const weatherResponseSchema = z.object({
  features: z.array(z.object({
    properties: z.object({
      id: z.string(),
      event: z.string(),
      severity: z.string(),
      headline: z.string().nullable(),
      areaDesc: z.string(),
      senderName: z.string(),
      effective: z.string(),
      expires: z.string().nullable(),
    }),
  })),
})

export type WeatherAlert = z.infer<typeof weatherResponseSchema>['features'][number]['properties']

async function fetchWeatherAlerts(city: string): Promise<WeatherAlert[]> {
  const { lat, lng } = cityCenter(city)
  const response = await fetch(`https://api.weather.gov/alerts/active?point=${lat},${lng}`)
  if (!response.ok) throw new Error(`Weather alert request failed (${response.status})`)
  return weatherResponseSchema.parse(await response.json()).features.map(f => f.properties)
}

export function useWeatherAlerts(city: string) {
  return useQuery({
    queryKey: ['hazards', 'weather', city.trim()],
    queryFn: () => fetchWeatherAlerts(city),
    refetchInterval: 5 * 60_000,
    retry: 1,
  })
}