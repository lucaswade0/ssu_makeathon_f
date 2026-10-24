import { z } from 'zod'

export type Place = { label: string; lat: number; lng: number }

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search'
const NOMINATIM_REVERSE_URL = 'https://nominatim.openstreetmap.org/reverse'
const SEARCH_BOX_DEG = 0.5 // roughly 50 km around the city

const resultSchema = z.array(z.object({
  display_name: z.string(),
  lat: z.coerce.number().min(-90).max(90),
  lon: z.coerce.number().min(-180).max(180),
}))

// ---------- Rate limit and cache ----------
// The public server allows an absolute maximum of 1 request per second for the whole app, so every
// lookup goes through one queue that spaces real network calls at least a little over a second apart.

const MIN_GAP_MS = 1100
const CACHE_LIMIT = 50

const realSleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms))

export function createThrottle(gapMs: number, now: () => number = Date.now, sleep: (ms: number) => Promise<void> = realSleep) {
  let gap = gapMs
  let last = -Infinity
  let chain: Promise<unknown> = Promise.resolve()
  return {
    setGap(ms: number) { gap = ms },
    // Runs tasks one at a time. A task whose signal is aborted is skipped without using up a time slot.
    run<T>(task: () => Promise<T>, signal?: AbortSignal): Promise<T> {
      const result = chain.then(async () => {
        signal?.throwIfAborted()
        const wait = last + gap - now()
        if (wait > 0) await sleep(wait)
        signal?.throwIfAborted()
        last = now()
        return task()
      })
      chain = result.catch(() => {})
      return result
    },
  }
}

export const geocodeThrottle = createThrottle(MIN_GAP_MS)

// Repeating a query should never reach the network. Only successful answers are kept.
const cache = new Map<string, unknown>()

export function clearGeocodeCache() {
  cache.clear()
}

async function cached<T>(key: string, load: () => Promise<T>): Promise<T> {
  if (cache.has(key)) return cache.get(key) as T
  const value = await load()
  cache.set(key, value)
  if (cache.size > CACHE_LIMIT) cache.delete(cache.keys().next().value!)
  return value
}

// Nominatim wants west,north,east,south. It only ranks results near the box; it does not hide others.
export function viewbox(center: { lat: number; lng: number }) {
  return [center.lng - SEARCH_BOX_DEG, center.lat + SEARCH_BOX_DEG, center.lng + SEARCH_BOX_DEG, center.lat - SEARCH_BOX_DEG].join(',')
}

// Free OpenStreetMap search, no key. The public server allows about one request per second and
// forbids autocomplete, so call this only when the person presses Search, never on every keystroke.
export async function searchPlaces(query: string, near: { lat: number; lng: number }, signal?: AbortSignal): Promise<Place[]> {
  const q = query.trim()
  if (q.length < 3) return []
  const params = new URLSearchParams({ q, format: 'jsonv2', limit: '5', viewbox: viewbox(near), countrycodes: 'us' })
  return cached(`search:${q.toLowerCase()}|${params.get('viewbox')}`, () => geocodeThrottle.run(async () => {
    const response = await fetch(`${NOMINATIM_URL}?${params}`, { signal })
    if (!response.ok) throw new Error(`Place search failed (${response.status})`)
    return resultSchema.parse(await response.json()).map(r => ({ label: r.display_name, lat: r.lat, lng: r.lon }))
  }, signal))
}

const reverseSchema = z.object({ display_name: z.string().optional(), error: z.string().optional() })

// Finds the address nearest a pin. Returns null when the spot has no known address (for example open land).
// Coordinates are rounded to about one meter so a re-dropped pin reuses the earlier answer.
export async function reversePlace(pin: { lat: number; lng: number }, signal?: AbortSignal): Promise<string | null> {
  const lat = pin.lat.toFixed(5), lng = pin.lng.toFixed(5)
  return cached(`reverse:${lat},${lng}`, () => geocodeThrottle.run(async () => {
    const params = new URLSearchParams({ format: 'jsonv2', lat, lon: lng, zoom: '18' })
    const response = await fetch(`${NOMINATIM_REVERSE_URL}?${params}`, { signal })
    if (!response.ok) throw new Error(`Address lookup failed (${response.status})`)
    const data = reverseSchema.parse(await response.json())
    return data.error || !data.display_name ? null : data.display_name
  }, signal))
}

export const MAX_ADDRESS_LENGTH = 240

// The address box follows the pin until the person types their own text. Clearing it turns auto-fill back on.
export function addressFromMap(label: string, current: string, editedByPerson: boolean) {
  return editedByPerson ? current : label.slice(0, MAX_ADDRESS_LENGTH)
}
