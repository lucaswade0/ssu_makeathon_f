import { describe, expect, it } from 'vitest'
import css from '../../App.css?inline'
import { noZones, sampleZones, type ZoneCollection } from './sampleData'
import { orderMarkers } from './zoneMarkers'

type Ring = number[][]
const zone = (id: string, level: 'order' | 'warning', ring: Ring): ZoneCollection['features'][number] => ({
  type: 'Feature',
  properties: { zone_id: id, level, hazard: 'fire', instructions: '', source: 's', issued_at: null },
  geometry: { type: 'Polygon', coordinates: [ring] },
})
const collection = (...features: ZoneCollection['features']): ZoneCollection => ({ type: 'FeatureCollection', features })
const square = (x: number, y: number, size: number): Ring => [[x, y], [x + size, y], [x + size, y + size], [x, y + size], [x, y]]

describe('orderMarkers', () => {
  it('puts one marker at the center of an evacuation order', () => {
    const [marker] = orderMarkers(collection(zone('A1', 'order', square(-122.8, 38.4, 0.1))))
    expect(marker).toMatchObject({ id: 'A1', label: 'Evacuation order: Zone A1' })
    expect(marker!.lng).toBeCloseTo(-122.75, 6)
    expect(marker!.lat).toBeCloseTo(38.45, 6)
  })

  it('ignores evacuation warnings, so the circle keeps its meaning of leave now', () => {
    expect(orderMarkers(collection(zone('W1', 'warning', square(0, 0, 1))))).toEqual([])
  })

  it('returns nothing when there are no zones', () => {
    expect(orderMarkers(noZones)).toEqual([])
  })

  it('gives each order its own marker', () => {
    const markers = orderMarkers(collection(zone('A', 'order', square(0, 0, 1)), zone('B', 'order', square(5, 5, 1)), zone('W', 'warning', square(9, 9, 1))))
    expect(markers.map(m => m.id)).toEqual(['A', 'B'])
  })

  it('uses one marker, at the largest part, for a zone split into parts', () => {
    const markers = orderMarkers(collection(zone('A', 'order', square(0, 0, 1)), zone('A', 'order', square(10, 10, 4))))
    expect(markers).toHaveLength(1)
    expect(markers[0]!.lng).toBeCloseTo(12, 6)
    expect(markers[0]!.lat).toBeCloseTo(12, 6)
  })

  it('stays inside an L-shaped zone, even though its plain center falls in the notch', () => {
    // The area center of this L is (1.36, 1.36), which is outside the shape.
    const l: Ring = [[0, 0], [4, 0], [4, 1], [1, 1], [1, 4], [0, 4], [0, 0]]
    const [marker] = orderMarkers(collection(zone('L', 'order', l)))
    const inside = (x: number, y: number) => (x >= 0 && x <= 4 && y >= 0 && y <= 1) || (x >= 0 && x <= 1 && y >= 0 && y <= 4)
    expect(inside(marker!.lng, marker!.lat)).toBe(true)
  })

  it('puts the marker in the roomiest part of a crescent-shaped zone', () => {
    const c: Ring = [[0, 0], [6, 0], [6, 1], [1, 1], [1, 5], [6, 5], [6, 6], [0, 6], [0, 0]]
    const [marker] = orderMarkers(collection(zone('C', 'order', c)))
    expect(marker!.lng).toBeLessThan(1)
  })

  it('does not depend on the direction the outline is drawn', () => {
    const clockwise = square(0, 0, 2).slice().reverse()
    const [a] = orderMarkers(collection(zone('A', 'order', square(0, 0, 2))))
    const [b] = orderMarkers(collection(zone('A', 'order', clockwise)))
    expect(b!.lng).toBeCloseTo(a!.lng, 6)
    expect(b!.lat).toBeCloseTo(a!.lat, 6)
  })

  it('handles an outline with no area without breaking', () => {
    const [marker] = orderMarkers(collection(zone('Z', 'order', [[1, 1], [3, 3], [1, 1]])))
    expect(Number.isFinite(marker!.lat) && Number.isFinite(marker!.lng)).toBe(true)
  })

  it('skips a zone with no outline', () => {
    expect(orderMarkers(collection(zone('E', 'order', [])))).toEqual([])
  })

  it('finds the sample evacuation order inside its zone', () => {
    const markers = orderMarkers(sampleZones)
    expect(markers.length).toBeGreaterThan(0)
    for (const marker of markers) {
      expect(marker.lat).toBeGreaterThan(37)
      expect(marker.lat).toBeLessThan(39.5)
      expect(marker.lng).toBeGreaterThan(-123.5)
      expect(marker.lng).toBeLessThan(-122)
    }
  })
})

describe('order marker styling', () => {
  it('pulses, and stops pulsing for people who prefer reduced motion', () => {
    expect(css).toContain('.order-marker::after')
    expect(css).toContain('@keyframes order-pulse')
    expect(css).toMatch(/prefers-reduced-motion: reduce\) \{\s*\.order-marker::after \{ animation: none/)
  })

  it('is at least 44px so it is easy to tap', () => {
    expect(css).toMatch(/\.order-marker \{[^}]*width: 44px; height: 44px/)
  })
})
