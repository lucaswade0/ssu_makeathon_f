import type { FeatureCollection, Polygon } from 'geojson'

// Sample data for the demo, so the map works without a live data source.
// Timestamps are relative to page load so "updated X min ago" stays believable.
const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString()

export type ShelterStatus = 'official' | 'verified' | 'community_submitted'

// Same fields as the shelters table, so Phase 5 can swap in real rows.
export type Shelter = {
  id: string
  name: string
  description: string
  location_text: string
  city: string
  latitude: number
  longitude: number
  status: ShelterStatus
  source: string
  created_at: string
  updated_at: string
}

export type IncidentKind = 'fire' | 'flood' | 'heat'

export type Incident = {
  id: string
  kind: IncidentKind
  title: string
  location_text: string
  latitude: number
  longitude: number
  acres?: number
  containment?: number
  source: string
  updated_at: string
}

export type ZoneLevel = 'order' | 'warning'

export type ZoneProperties = {
  zone_id: string
  level: ZoneLevel
  instructions: string
  source: string
  issued_at: string
}

export const sampleShelters: Shelter[] = [
  {
    id: 'shelter-1',
    name: 'Finley Community Center',
    description: 'Evacuation center with cots, water, and charging stations.',
    location_text: '2060 W College Ave, Santa Rosa',
    city: 'Santa Rosa',
    latitude: 38.4446,
    longitude: -122.734,
    status: 'official',
    source: 'Sample data (county emergency services)',
    created_at: minutesAgo(180),
    updated_at: minutesAgo(15),
  },
  {
    id: 'shelter-2',
    name: 'Veterans Memorial Building',
    description: 'Overflow shelter. Pets allowed in crates.',
    location_text: '1351 Maple Ave, Santa Rosa',
    city: 'Santa Rosa',
    latitude: 38.4339,
    longitude: -122.7044,
    status: 'verified',
    source: 'Sample data (Red Cross listing)',
    created_at: minutesAgo(150),
    updated_at: minutesAgo(40),
  },
  {
    id: 'shelter-3',
    name: 'Church parking lot',
    description: 'Neighbors report water and shade available. Not confirmed.',
    location_text: 'Near Montgomery Dr and Farmers Ln',
    city: 'Santa Rosa',
    latitude: 38.4502,
    longitude: -122.6905,
    status: 'community_submitted',
    source: 'Community submission',
    created_at: minutesAgo(30),
    updated_at: minutesAgo(30),
  },
]

export const sampleIncidents: Incident[] = [
  {
    id: 'incident-1',
    kind: 'fire',
    title: 'Vegetation fire · Fountaingrove',
    location_text: 'Fountaingrove Pkwy near Round Barn Blvd',
    latitude: 38.4815,
    longitude: -122.7105,
    acres: 240,
    containment: 10,
    source: 'Sample data (CAL FIRE)',
    updated_at: minutesAgo(5),
  },
  {
    id: 'incident-2',
    kind: 'flood',
    title: 'Flood watch · Santa Rosa Creek',
    location_text: 'Santa Rosa Creek corridor',
    latitude: 38.4405,
    longitude: -122.725,
    source: 'Sample data (National Weather Service)',
    updated_at: minutesAgo(25),
  },
  {
    id: 'incident-3',
    kind: 'heat',
    title: 'Heat advisory · Sonoma County',
    location_text: 'Inland Sonoma County',
    latitude: 38.425,
    longitude: -122.67,
    source: 'Sample data (National Weather Service)',
    updated_at: minutesAgo(120),
  },
]

// GeoJSON uses [longitude, latitude], and each ring ends on its first point.
export const sampleZones: FeatureCollection<Polygon, ZoneProperties> = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: {
        zone_id: 'SRO-E012',
        level: 'warning',
        instructions: 'Be ready to leave. Gather medications, documents, and pets.',
        source: 'Sample data (Sonoma County)',
        issued_at: minutesAgo(50),
      },
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [-122.735, 38.468], [-122.705, 38.462], [-122.685, 38.475],
          [-122.688, 38.497], [-122.712, 38.505], [-122.735, 38.493], [-122.735, 38.468],
        ]],
      },
    },
    {
      type: 'Feature',
      properties: {
        zone_id: 'SRO-E011',
        level: 'order',
        instructions: 'Leave now. Follow instructions from local officials.',
        source: 'Sample data (Sonoma County)',
        issued_at: minutesAgo(35),
      },
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [-122.722, 38.474], [-122.703, 38.472], [-122.697, 38.484],
          [-122.705, 38.494], [-122.72, 38.492], [-122.722, 38.474],
        ]],
      },
    },
  ],
}