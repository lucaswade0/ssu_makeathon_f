import { useQuery } from '@tanstack/react-query'
import { z } from 'zod'
import type { FeatureCollection, MultiPolygon, Polygon } from 'geojson'
import type { Incident, ZoneCollection, ZoneProperties } from '../map/sampleData'

const SANTA_ROSA = { lat: 38.4404, lng: -122.7141 }

// shortcut: only the demo city has coordinates, so live data is off for every other city. Replace with geocoding when city detection lands.
const cityCenters: Record<string, { lat: number; lng: number }> = {
  'Santa Rosa': SANTA_ROSA,
}

export const NO_COVERAGE = 'Live hazard data is only set up for Santa Rosa in this demo.'

export function hasLiveCoverage(city: string) {
  return Object.hasOwn(cityCenters, city.trim())
}

// Throws instead of guessing, so we never report "nothing nearby" for a place we didn't search.
export function cityCenter(city: string) {
  const center = cityCenters[city.trim()]
  if (!center) throw new Error(`Live hazard data isn't set up for ${city}`)
  return center
}

const clockTime = (ms: number) => new Date(ms).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
export { clockTime }

function titleCase(text: string) {
  return text.toLowerCase().replace(/\b\w/g, letter => letter.toUpperCase())
}

const SEARCH_RADIUS_DEG = 0.6 // roughly 65 km around the city

// Fetches GeoJSON from an ArcGIS FeatureServer layer for a box around the city.
async function queryArea(url: string, city: string, label: string, params: Record<string, string>) {
  const { lat, lng } = cityCenter(city)
  const query = new URLSearchParams({
    where: '1=1',
    geometry: [lng - SEARCH_RADIUS_DEG, lat - SEARCH_RADIUS_DEG, lng + SEARCH_RADIUS_DEG, lat + SEARCH_RADIUS_DEG].join(','),
    geometryType: 'esriGeometryEnvelope',
    inSR: '4326',
    outSR: '4326',
    spatialRel: 'esriSpatialRelIntersects',
    f: 'geojson',
    ...params,
  })
  const response = await fetch(`${url}?${query}`)
  if (!response.ok) throw new Error(`${label} request failed (${response.status})`)
  return response.json()
}

const position = z.array(z.number()).min(2)
const polygonGeometry = z.discriminatedUnion('type', [
  z.object({ type: z.literal('Polygon'), coordinates: z.array(z.array(position)) }),
  z.object({ type: z.literal('MultiPolygon'), coordinates: z.array(z.array(z.array(position))) }),
])

// ---------- Wildfires: NIFC WFIGS current incident locations ----------

const WFIGS_URL = 'https://services3.arcgis.com/T4QMspbfLg3qTGWY/arcgis/rest/services/WFIGS_Incident_Locations_Current/FeatureServer/0/query'

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
  const data = fireResponseSchema.parse(await queryArea(WFIGS_URL, city, 'Wildfire data', {
    where: "IncidentTypeCategory = 'WF'",
    outFields: 'IrwinID,IncidentName,IncidentSize,PercentContained,ModifiedOnDateTime_dt,POOCounty',
  }))

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
    enabled: hasLiveCoverage(city),
  })
}

// ---------- Fire perimeters: NIFC WFIGS current interagency perimeters ----------

const PERIMETERS_URL = 'https://services3.arcgis.com/T4QMspbfLg3qTGWY/arcgis/rest/services/WFIGS_Interagency_Perimeters_Current/FeatureServer/0/query'

export type PerimeterCollection = FeatureCollection<Polygon | MultiPolygon, { name: string | null }>
export const noPerimeters: PerimeterCollection = { type: 'FeatureCollection', features: [] }

const perimeterResponseSchema = z.object({
  features: z.array(z.object({
    geometry: polygonGeometry.nullable(),
    properties: z.object({ poly_IncidentName: z.string().nullable() }),
  })),
})

async function fetchPerimeters(city: string): Promise<PerimeterCollection> {
  const data = perimeterResponseSchema.parse(await queryArea(PERIMETERS_URL, city, 'Fire perimeter', {
    outFields: 'poly_IncidentName',
    geometryPrecision: '5', // ~1 m; keeps large perimeters small
  }))
  return {
    type: 'FeatureCollection',
    features: data.features.flatMap(({ geometry, properties }) => geometry
      ? [{ type: 'Feature' as const, geometry, properties: { name: properties.poly_IncidentName } }]
      : []),
  }
}

export function useFirePerimeters(city: string) {
  return useQuery({
    queryKey: ['hazards', 'perimeters', city.trim()],
    queryFn: () => fetchPerimeters(city),
    refetchInterval: 5 * 60_000,
    retry: 1,
    enabled: hasLiveCoverage(city),
  })
}

// ---------- Evacuation zones: Cal OES California Active Evacuation Zones ----------

const CALOES_ZONES_URL = 'https://services.arcgis.com/BLN4oKB0N1YSgvY8/arcgis/rest/services/CA_EVACUATIONS_CalOESHosted_view/FeatureServer/0/query'

const zoneResponseSchema = z.object({
  features: z.array(z.object({
    geometry: polygonGeometry.nullable(),
    properties: z.object({
      ZONE_ID: z.string(),
      ZONE_NAME: z.string().nullable(),
      STATUS: z.string(),
      COUNTY: z.string().nullable(),
      EDIT_DATE: z.number().nullable(),
      PUBLIC_INFO: z.string().nullable(),
    }),
  })),
})

export async function fetchEvacuationZones(city: string): Promise<ZoneCollection> {
  const data = zoneResponseSchema.parse(await queryArea(CALOES_ZONES_URL, city, 'Evacuation zone', {
    outFields: 'ZONE_ID,ZONE_NAME,STATUS,COUNTY,EDIT_DATE,PUBLIC_INFO',
  }))
  return {
    type: 'FeatureCollection',
    features: data.features.flatMap(({ geometry, properties: p }) => {
      // shortcut: only order and warning statuses are drawn (e.g. shelter-in-place is skipped); add a level once the map has a style for it.
      // End-of-event statuses ("Order Lifted", "Clear to Repopulate") still contain "order", so drop them first.
      if (/lift|clear|repopulat|normal/i.test(p.STATUS)) return []
      const level = /order/i.test(p.STATUS) ? 'order' : /warning/i.test(p.STATUS) ? 'warning' : null
      if (!geometry || !level) return []
      const properties: ZoneProperties = {
        zone_id: p.ZONE_ID,
        level,
        instructions: p.PUBLIC_INFO ?? `${p.STATUS}${p.ZONE_NAME ? ` for ${p.ZONE_NAME}` : ''}. Follow instructions from local officials.`,
        source: `Cal OES${p.COUNTY ? ` (${titleCase(p.COUNTY)} County)` : ''}`,
        issued_at: p.EDIT_DATE === null ? null : new Date(p.EDIT_DATE).toISOString(),
      }
      // Split multi-part zones so every feature is a plain Polygon, like the sample zones.
      const parts = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates
      return parts.map(coordinates => ({ type: 'Feature' as const, properties, geometry: { type: 'Polygon' as const, coordinates } }))
    }),
  }
}

export function useEvacuationZones(city: string) {
  return useQuery({
    queryKey: ['hazards', 'zones', city.trim()],
    queryFn: () => fetchEvacuationZones(city),
    refetchInterval: 5 * 60_000,
    retry: 1,
    enabled: hasLiveCoverage(city),
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
    enabled: hasLiveCoverage(city),
  })
}