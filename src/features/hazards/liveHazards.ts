import { useQuery } from '@tanstack/react-query'
import { z } from 'zod'
import type { FeatureCollection, MultiPolygon, Polygon } from 'geojson'
import type { Incident, ShakeMapCollection, ZoneCollection, ZoneProperties } from '../map/sampleData'

// shortcut: only these Sonoma County cities have coordinates, so live data is off everywhere else. Replace with geocoding to cover any city.
const cityCenters: Record<string, { lat: number; lng: number }> = {
  'Santa Rosa': { lat: 38.4404, lng: -122.7141 },
  'Petaluma': { lat: 38.2324, lng: -122.6367 },
  'Rohnert Park': { lat: 38.3396, lng: -122.7011 },
  'Cotati': { lat: 38.3266, lng: -122.7092 },
  'Sebastopol': { lat: 38.4021, lng: -122.8239 },
  'Windsor': { lat: 38.5471, lng: -122.8164 },
  'Healdsburg': { lat: 38.6105, lng: -122.8697 },
  'Sonoma': { lat: 38.2919, lng: -122.4580 },
}

export const NO_COVERAGE = 'Live hazard data is only set up for Sonoma County cities in this demo.'

const NEARBY_KM = 30

// Flat-earth distance is accurate enough within tens of km.
function distanceKm(lat: number, lng: number, center: { lat: number; lng: number }) {
  const x = (lng - center.lng) * Math.cos(((lat + center.lat) / 2) * Math.PI / 180) * 111.32
  const y = (lat - center.lat) * 110.57
  return Math.hypot(x, y)
}

// Matches a browser location to the closest covered city within 30 km.
export function nearestCoveredCity(lat: number, lng: number): string | null {
  let best: { name: string; km: number } | null = null
  for (const [name, center] of Object.entries(cityCenters)) {
    const km = distanceKm(lat, lng, center)
    if (km <= NEARBY_KM && (!best || km < best.km)) best = { name, km }
  }
  return best?.name ?? null
}

// Case-insensitive, so a typed "petaluma" still finds Petaluma.
function findCity(city: string) {
  const wanted = city.trim().toLowerCase()
  return Object.entries(cityCenters).find(([name]) => name.toLowerCase() === wanted)?.[1]
}

export function hasLiveCoverage(city: string) {
  return findCity(city) !== undefined
}

// Throws instead of guessing, so we never report "nothing nearby" for a place we didn't search.
export function cityCenter(city: string) {
  const center = findCity(city)
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
      EVENT_TYPE: z.string().nullish(),
    }),
  })),
})

export async function fetchEvacuationZones(city: string): Promise<ZoneCollection> {
  const data = zoneResponseSchema.parse(await queryArea(CALOES_ZONES_URL, city, 'Evacuation zone', {
    outFields: 'ZONE_ID,ZONE_NAME,STATUS,COUNTY,EDIT_DATE,PUBLIC_INFO,EVENT_TYPE',
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
        hazard: /flood/i.test(p.EVENT_TYPE ?? '') ? 'flood' : /quake/i.test(p.EVENT_TYPE ?? '') ? 'earthquake' : /fire/i.test(p.EVENT_TYPE ?? '') ? 'fire' : 'other',
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

// ---------- Earthquakes: USGS earthquake catalog ----------

const USGS_QUERY_URL = 'https://earthquake.usgs.gov/fdsnws/event/1/query'
const QUAKE_DAYS = 7
const QUAKE_MIN_MAGNITUDE = 2.5 // smaller quakes are rarely felt

const quakeResponseSchema = z.object({
  features: z.array(z.object({
    id: z.string(),
    geometry: z.object({ coordinates: z.array(z.number()).min(2) }),
    properties: z.object({
      mag: z.number().nullable(),
      place: z.string().nullable(),
      time: z.number(),
    }),
  })),
})

export async function fetchEarthquakes(city: string): Promise<Incident[]> {
  const { lat, lng } = cityCenter(city)
  const query = new URLSearchParams({
    format: 'geojson',
    latitude: String(lat),
    longitude: String(lng),
    maxradiuskm: '65',
    minmagnitude: String(QUAKE_MIN_MAGNITUDE),
    starttime: new Date(Date.now() - QUAKE_DAYS * 86_400_000).toISOString(),
    orderby: 'time',
  })
  const response = await fetch(`${USGS_QUERY_URL}?${query}`)
  if (!response.ok) throw new Error(`Earthquake request failed (${response.status})`)
  const data = quakeResponseSchema.parse(await response.json())

  return data.features.map(({ id, geometry, properties: p }) => ({
    id: `usgs-${id}`,
    kind: 'earthquake' as const,
    title: `M${p.mag?.toFixed(1) ?? '?'} earthquake`,
    location_text: p.place ?? 'Location not listed',
    latitude: geometry.coordinates[1]!,
    longitude: geometry.coordinates[0]!,
    source: 'USGS earthquake catalog',
    // When the quake happened, so lists read "3 h ago" for the event itself.
    updated_at: new Date(p.time).toISOString(),
  }))
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

// ---------- Earthquake shaking rings: USGS ShakeMap ----------

// Only larger quakes get a ShakeMap, so most days this returns nothing.
const shakeListSchema = z.object({ features: z.array(z.object({ properties: z.object({ detail: z.string() }) })) })
const shakeDetailSchema = z.object({
  properties: z.object({
    products: z.object({
      shakemap: z.array(z.object({ contents: z.record(z.string(), z.object({ url: z.string() })) })).min(1),
    }),
  }),
})
const lineGeometry = z.discriminatedUnion('type', [
  z.object({ type: z.literal('LineString'), coordinates: z.array(position) }),
  z.object({ type: z.literal('MultiLineString'), coordinates: z.array(z.array(position)) }),
])
const contourSchema = z.object({
  features: z.array(z.object({ geometry: lineGeometry.nullable(), properties: z.object({ value: z.number() }) })),
})

async function getJson(url: string, label: string) {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`${label} request failed (${response.status})`)
  return response.json()
}

export async function fetchShakeMaps(city: string): Promise<ShakeMapCollection> {
  const { lat, lng } = cityCenter(city)
  const query = new URLSearchParams({
    format: 'geojson',
    latitude: String(lat),
    longitude: String(lng),
    maxradiuskm: '65',
    minmagnitude: String(QUAKE_MIN_MAGNITUDE),
    starttime: new Date(Date.now() - QUAKE_DAYS * 86_400_000).toISOString(),
    producttype: 'shakemap',
  })
  const quakes = shakeListSchema.parse(await getJson(`${USGS_QUERY_URL}?${query}`, 'ShakeMap list'))

  const rings = await Promise.all(quakes.features.map(async ({ properties }) => {
    const detail = shakeDetailSchema.parse(await getJson(properties.detail, 'Earthquake detail'))
    const contourUrl = detail.properties.products.shakemap[0]!.contents['download/cont_mmi.json']?.url
    if (!contourUrl) return []
    const contours = contourSchema.parse(await getJson(contourUrl, 'ShakeMap contour'))
    // Whole-number intensities from 2 (weak shaking) up keep the map readable; 1 is "not felt".
    return contours.features.flatMap(({ geometry, properties: { value } }) => geometry && Number.isInteger(value) && value >= 2
      ? [{ type: 'Feature' as const, geometry, properties: { mmi: value } }]
      : [])
  }))
  return { type: 'FeatureCollection', features: rings.flat() }
}

export function useShakeMaps(city: string) {
  return useQuery({
    queryKey: ['hazards', 'shakemaps', city.trim()],
    queryFn: () => fetchShakeMaps(city),
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