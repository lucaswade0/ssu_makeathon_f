import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchEarthquakes, fetchEvacuationZones, fetchShakeMaps, hasLiveCoverage, nearestCoveredCity } from './liveHazards'

describe('nearestCoveredCity', () => {
  it('picks the closest covered city, not just any within 30 km', () => {
    expect(nearestCoveredCity(38.2400, -122.6400)).toBe('Petaluma') // ~24 km from Santa Rosa, ~1 km from Petaluma
    expect(nearestCoveredCity(38.4500, -122.7100)).toBe('Santa Rosa')
    expect(nearestCoveredCity(39.1502, -123.2078)).toBeNull() // Ukiah, outside Sonoma County coverage
    expect(nearestCoveredCity(36.7378, -119.7871)).toBeNull() // Fresno
  })

  it('finds typed cities regardless of case', () => {
    expect(hasLiveCoverage(' petaluma ')).toBe(true)
    expect(hasLiveCoverage('Fresno')).toBe(false)
  })
})

const square = [[[-122.7, 38.4], [-122.6, 38.4], [-122.6, 38.5], [-122.7, 38.4]]]

function zone(id: string, status: string, geometry: unknown, editDate: number | null = 1_700_000_000_000, eventType?: string) {
  return {
    type: 'Feature',
    geometry,
    properties: { ZONE_ID: id, ZONE_NAME: null, STATUS: status, COUNTY: 'SONOMA', EDIT_DATE: editDate, PUBLIC_INFO: null, EVENT_TYPE: eventType },
  }
}

afterEach(() => vi.unstubAllGlobals())

describe('fetchEvacuationZones', () => {
  it('maps Cal OES zones to order/warning polygons and skips other statuses', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      type: 'FeatureCollection',
      features: [
        zone('A', 'Evacuation Order', { type: 'Polygon', coordinates: square }),
        zone('B', 'Evacuation Warning', { type: 'MultiPolygon', coordinates: [square, square] }, null),
        zone('C', 'Shelter in Place', { type: 'Polygon', coordinates: square }),
        zone('E', 'Evacuation Order Lifted', { type: 'Polygon', coordinates: square }),
        zone('D', 'Evacuation Order', null),
      ],
    }))))

    const result = await fetchEvacuationZones('Santa Rosa')
    const parts = result.features.map(f => [f.properties.zone_id, f.properties.level, f.geometry.type])

    expect(parts).toEqual([
      ['A', 'order', 'Polygon'],
      ['B', 'warning', 'Polygon'],
      ['B', 'warning', 'Polygon'],
    ])
    expect(result.features[0]?.properties.source).toBe('Cal OES (Sonoma County)')
    expect(result.features[1]?.properties.issued_at).toBeNull()
    expect(result.features[0]?.properties.hazard).toBe('other') // Cal OES left EVENT_TYPE out
  })

  it('reads the hazard type for zone colors', async () => {
    const typed = (eventType: string) => zone(eventType, 'Evacuation Order', { type: 'Polygon', coordinates: square }, null, eventType)
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      type: 'FeatureCollection',
      features: [typed('Flood'), typed('Earthquake'), typed('Wildfire'), typed('Hazmat')],
    }))))

    const result = await fetchEvacuationZones('Santa Rosa')
    expect(result.features.map(f => f.properties.hazard)).toEqual(['flood', 'earthquake', 'fire', 'other'])
  })

  it('never searches a city without coordinates', async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    await expect(fetchEvacuationZones('Fresno')).rejects.toThrow("Live hazard data isn't set up for Fresno")
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('throws when Cal OES responds with an error status', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 503 })))
    await expect(fetchEvacuationZones('Santa Rosa')).rejects.toThrow('Evacuation zone request failed (503)')
  })
})

describe('fetchEarthquakes', () => {
  it('turns USGS quakes into earthquake incidents', async () => {
    const fetchSpy = vi.fn(async (_url: string) => new Response(JSON.stringify({
      type: 'FeatureCollection',
      features: [
        { id: 'nc1', geometry: { coordinates: [-122.8, 38.83, 2] }, properties: { mag: 2.52, place: '7 km W of Cobb, CA', time: 1_700_000_000_000 } },
        { id: 'nc2', geometry: { coordinates: [-122.7, 38.5, 1] }, properties: { mag: null, place: null, time: 1_700_000_000_000 } },
      ],
    })))
    vi.stubGlobal('fetch', fetchSpy)

    const quakes = await fetchEarthquakes('Santa Rosa')
    expect(quakes.map(q => [q.id, q.kind, q.title, q.location_text, q.latitude])).toEqual([
      ['usgs-nc1', 'earthquake', 'M2.5 earthquake', '7 km W of Cobb, CA', 38.83],
      ['usgs-nc2', 'earthquake', 'M? earthquake', 'Location not listed', 38.5],
    ])
    const url = new URL(fetchSpy.mock.calls[0]![0])
    expect(url.searchParams.get('minmagnitude')).toBe('2.5')
    expect(url.searchParams.get('maxradiuskm')).toBe('65')
  })
})

describe('fetchShakeMaps', () => {
  it('follows quake → detail → contours and keeps whole intensities from 2 up', async () => {
    const line = { type: 'MultiLineString', coordinates: [[[-122.8, 38.8], [-122.7, 38.9]]] }
    const responses: Record<string, unknown> = {
      list: { features: [{ properties: { detail: 'https://usgs.test/detail' } }] },
      'https://usgs.test/detail': { properties: { products: { shakemap: [{ contents: { 'download/cont_mmi.json': { url: 'https://usgs.test/cont' } } }] } } },
      'https://usgs.test/cont': { features: [1, 2, 2.5, 3].map(value => ({ geometry: line, properties: { value } })) },
    }
    const fetchSpy = vi.fn(async (url: string) => new Response(JSON.stringify(responses[url] ?? responses.list)))
    vi.stubGlobal('fetch', fetchSpy)

    const rings = await fetchShakeMaps('Santa Rosa')
    expect(rings.features.map(f => f.properties.mmi)).toEqual([2, 3])
    expect(new URL(fetchSpy.mock.calls[0]![0]).searchParams.get('producttype')).toBe('shakemap')
  })
})
