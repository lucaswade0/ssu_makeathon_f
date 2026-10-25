import type { ZoneCollection } from './sampleData'

export type OrderMarker = { id: string; lat: number; lng: number; label: string }

type Ring = number[][]

// Area and center of a polygon ring (shoelace formula). GeoJSON points are [longitude, latitude].
function ringCenter(ring: Ring): { area: number; lng: number; lat: number } {
  let area = 0
  let cx = 0
  let cy = 0
  for (let i = 0; i < ring.length - 1; i++) {
    const [x1, y1] = ring[i]!
    const [x2, y2] = ring[i + 1]!
    const cross = x1! * y2! - x2! * y1!
    area += cross
    cx += (x1! + x2!) * cross
    cy += (y1! + y2!) * cross
  }
  area /= 2
  if (Math.abs(area) < 1e-12) {
    // A zero-area ring (a line or a point): fall back to the average of its points.
    const points = ring.length > 1 ? ring.slice(0, -1) : ring
    return { area: 0, lng: points.reduce((sum, p) => sum + p[0]!, 0) / points.length, lat: points.reduce((sum, p) => sum + p[1]!, 0) / points.length }
  }
  return { area: Math.abs(area), lng: cx / (6 * area), lat: cy / (6 * area) }
}

function inside(ring: Ring, x: number, y: number) {
  let isInside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]!
    const [xj, yj] = ring[j]!
    if ((yi! > y) !== (yj! > y) && x < ((xj! - xi!) * (y - yi!)) / (yj! - yi!) + xi!) isInside = !isInside
  }
  return isInside
}

function distanceToEdges(ring: Ring, x: number, y: number) {
  let best = Infinity
  for (let i = 0; i < ring.length - 1; i++) {
    const [x1, y1] = ring[i]!
    const [x2, y2] = ring[i + 1]!
    const dx = x2! - x1!
    const dy = y2! - y1!
    const t = dx === 0 && dy === 0 ? 0 : Math.max(0, Math.min(1, ((x - x1!) * dx + (y - y1!) * dy) / (dx * dx + dy * dy)))
    best = Math.min(best, Math.hypot(x - (x1! + t * dx), y - (y1! + t * dy)))
  }
  return best
}

const GRID = 24

// The center of an L or crescent can fall outside the shape, so when it does, use the point inside that sits
// farthest from every edge (found by sampling a grid across the outline).
function pointInside(ring: Ring, center: { lng: number; lat: number }): { lng: number; lat: number } {
  if (inside(ring, center.lng, center.lat)) return center
  const xs = ring.map(p => p[0]!)
  const ys = ring.map(p => p[1]!)
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys)
  let best = center
  let bestDistance = -1
  for (let i = 0; i <= GRID; i++) {
    for (let j = 0; j <= GRID; j++) {
      const x = minX + ((maxX - minX) * i) / GRID
      const y = minY + ((maxY - minY) * j) / GRID
      if (!inside(ring, x, y)) continue
      const distance = distanceToEdges(ring, x, y)
      if (distance > bestDistance) { bestDistance = distance; best = { lng: x, lat: y } }
    }
  }
  return best
}

/**
 * One marker position per evacuation order, at the center of the zone. The zone's real outline stays on the map; this
 * only makes the order impossible to miss. A zone split into several parts gets one marker, at its largest part.
 */
export function orderMarkers(zones: ZoneCollection): OrderMarker[] {
  const best = new Map<string, OrderMarker & { area: number }>()
  for (const feature of zones.features) {
    if (feature.properties.level !== 'order') continue
    const outer = feature.geometry.coordinates[0]
    if (!outer || outer.length === 0) continue
    const found = ringCenter(outer)
    const center = { ...found, ...(found.area > 0 ? pointInside(outer, found) : {}) }
    const known = best.get(feature.properties.zone_id)
    if (!known || center.area > known.area) {
      best.set(feature.properties.zone_id, { id: feature.properties.zone_id, lat: center.lat, lng: center.lng, label: `Evacuation order: Zone ${feature.properties.zone_id}`, area: center.area })
    }
  }
  return [...best.values()].map(({ id, lat, lng, label }) => ({ id, lat, lng, label }))
}
