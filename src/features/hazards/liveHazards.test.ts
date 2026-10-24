import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchEvacuationZones, hasLiveCoverage, nearestCoveredCity } from './liveHazards'

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

function zone(id: string, status: string, geometry: unknown, editDate: number | null = 1_700_000_000_000) {
  return {
    type: 'Feature',
    geometry,
    properties: { ZONE_ID: id, ZONE_NAME: null, STATUS: status, COUNTY: 'SONOMA', EDIT_DATE: editDate, PUBLIC_INFO: null },
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
