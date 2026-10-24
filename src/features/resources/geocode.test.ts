import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { addressFromMap, clearGeocodeCache, createThrottle, geocodeThrottle, reversePlace, searchPlaces, viewbox } from './geocode'

const near = { lat: 38.44, lng: -122.71 }

function mockFetch(body: unknown, ok = true, status = 200) {
  const fn = vi.fn().mockResolvedValue({ ok, status, json: () => Promise.resolve(body) })
  vi.stubGlobal('fetch', fn)
  return fn
}

// Tests use no delay and a clean cache; the throttle and cache have their own tests below.
beforeEach(() => { geocodeThrottle.setGap(0); clearGeocodeCache() })
afterEach(() => { vi.unstubAllGlobals(); geocodeThrottle.setGap(1100) })

describe('place search', () => {
  it('turns OpenStreetMap results into labeled coordinates', async () => {
    mockFetch([{ display_name: 'Finley Community Center, Santa Rosa', lat: '38.4446', lon: '-122.734' }])
    expect(await searchPlaces('Finley Community Center', near)).toEqual([
      { label: 'Finley Community Center, Santa Rosa', lat: 38.4446, lng: -122.734 },
    ])
  })

  it('asks for at most five US results ranked near the city', async () => {
    const fetchMock = mockFetch([])
    await searchPlaces('  Maple Ave  ', near)
    const url = new URL(fetchMock.mock.calls[0]![0] as string)
    expect(url.origin + url.pathname).toBe('https://nominatim.openstreetmap.org/search')
    expect(url.searchParams.get('q')).toBe('Maple Ave')
    expect(url.searchParams.get('limit')).toBe('5')
    expect(url.searchParams.get('countrycodes')).toBe('us')
    expect(url.searchParams.get('viewbox')).toBe(viewbox(near))
  })

  it('does not call the network for a query that is too short', async () => {
    const fetchMock = mockFetch([])
    expect(await searchPlaces('  ab ', near)).toEqual([])
    expect(await searchPlaces('', near)).toEqual([])
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('returns an empty list when nothing matches', async () => {
    mockFetch([])
    expect(await searchPlaces('zzzzzz nowhere', near)).toEqual([])
  })

  it('throws on a failed request so the UI can show an error', async () => {
    mockFetch(null, false, 503)
    await expect(searchPlaces('Finley', near)).rejects.toThrow('503')
  })

  it('rejects results with impossible coordinates', async () => {
    mockFetch([{ display_name: 'Nowhere', lat: '95', lon: '-122' }])
    await expect(searchPlaces('Nowhere', near)).rejects.toThrow()
  })

  it('builds a west,north,east,south box around the city', () => {
    const [w, n, e, s] = viewbox(near).split(',').map(Number)
    expect(w).toBeLessThan(near.lng)
    expect(e).toBeGreaterThan(near.lng)
    expect(n).toBeGreaterThan(near.lat)
    expect(s).toBeLessThan(near.lat)
  })
})

describe('address from a pin', () => {
  it('looks up the address nearest the pin', async () => {
    const fetchMock = mockFetch({ display_name: '1351 Maple Ave, Santa Rosa, California' })
    expect(await reversePlace({ lat: 38.4339, lng: -122.7044 })).toBe('1351 Maple Ave, Santa Rosa, California')
    const url = new URL(fetchMock.mock.calls[0]![0] as string)
    expect(url.pathname).toBe('/reverse')
    // Rounded to five decimals (about one meter) so the cache key and the request match.
    expect(url.searchParams.get('lat')).toBe('38.43390')
    expect(url.searchParams.get('lon')).toBe('-122.70440')
  })

  it('returns null when there is no address at the spot', async () => {
    mockFetch({ error: 'Unable to geocode' })
    expect(await reversePlace({ lat: 0, lng: 0 })).toBeNull()
  })

  it('throws on a failed lookup', async () => {
    mockFetch(null, false, 429)
    await expect(reversePlace({ lat: 1, lng: 1 })).rejects.toThrow('429')
  })

  it('fills the address box from the map, replacing the previous map address', () => {
    expect(addressFromMap('New Place, Santa Rosa', 'Old Place, Santa Rosa', false)).toBe('New Place, Santa Rosa')
  })

  it('keeps text the person typed themselves', () => {
    expect(addressFromMap('New Place', 'Behind the red barn', true)).toBe('Behind the red barn')
  })

  it('trims very long map addresses to the database limit', () => {
    expect(addressFromMap('x'.repeat(500), '', false)).toHaveLength(240)
  })
})

// A fake clock where sleeping just moves time forward, so these tests run instantly.
function fakeClock() {
  let time = 1_000
  return { now: () => time, sleep: (ms: number) => { time += ms; return Promise.resolve() }, advance: (ms: number) => { time += ms } }
}

describe('rate limit', () => {
  it('runs the first request immediately', async () => {
    const clock = fakeClock()
    const throttle = createThrottle(1100, clock.now, clock.sleep)
    const started = clock.now()
    await throttle.run(async () => 'a')
    expect(clock.now()).toBe(started)
  })

  it('keeps real requests at least the gap apart, in order', async () => {
    const clock = fakeClock()
    const throttle = createThrottle(1100, clock.now, clock.sleep)
    const starts: number[] = []
    const order: string[] = []
    const task = (name: string) => throttle.run(async () => { starts.push(clock.now()); order.push(name); return name })
    await Promise.all([task('a'), task('b'), task('c')])
    expect(order).toEqual(['a', 'b', 'c'])
    expect(starts[1]! - starts[0]!).toBeGreaterThanOrEqual(1100)
    expect(starts[2]! - starts[1]!).toBeGreaterThanOrEqual(1100)
  })

  it('does not wait when enough time has already passed', async () => {
    const clock = fakeClock()
    const throttle = createThrottle(1100, clock.now, clock.sleep)
    await throttle.run(async () => 1)
    clock.advance(5000)
    const before = clock.now()
    await throttle.run(async () => 2)
    expect(clock.now()).toBe(before)
  })

  it('skips an aborted request without using a time slot or sending it', async () => {
    const clock = fakeClock()
    const throttle = createThrottle(1100, clock.now, clock.sleep)
    const sent: string[] = []
    const stale = new AbortController()
    const first = throttle.run(async () => { sent.push('first') })
    const dropped = throttle.run(async () => { sent.push('stale') }, stale.signal)
    stale.abort()
    const latest = throttle.run(async () => { sent.push('latest') })
    await first
    await expect(dropped).rejects.toThrow()
    await latest
    expect(sent).toEqual(['first', 'latest'])
  })

  it('keeps working after a task fails', async () => {
    const clock = fakeClock()
    const throttle = createThrottle(1100, clock.now, clock.sleep)
    await expect(throttle.run(async () => { throw new Error('boom') })).rejects.toThrow('boom')
    expect(await throttle.run(async () => 'ok')).toBe('ok')
  })

  it('makes real place searches wait between network calls', async () => {
    const fetchMock = mockFetch([])
    geocodeThrottle.setGap(60)
    const times: number[] = []
    fetchMock.mockImplementation(() => { times.push(Date.now()); return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve([]) }) })
    await Promise.all([searchPlaces('first place', near), searchPlaces('second place', near)])
    expect(times).toHaveLength(2)
    expect(times[1]! - times[0]!).toBeGreaterThanOrEqual(55)
  })
})

describe('cache', () => {
  it('answers a repeated search without another request, ignoring case and spacing', async () => {
    const fetchMock = mockFetch([{ display_name: 'Finley Hall', lat: '38.43', lon: '-122.69' }])
    const first = await searchPlaces('Finley Hall', near)
    const second = await searchPlaces('  finley hall ', near)
    expect(second).toEqual(first)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('searches again for a different query', async () => {
    const fetchMock = mockFetch([])
    await searchPlaces('Finley Hall', near)
    await searchPlaces('Maple Ave', near)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('does not cache a failed search', async () => {
    mockFetch(null, false, 503)
    await expect(searchPlaces('Finley Hall', near)).rejects.toThrow()
    const fetchMock = mockFetch([])
    await searchPlaces('Finley Hall', near)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('reuses an address for a pin dropped at the same spot', async () => {
    const fetchMock = mockFetch({ display_name: '1351 Maple Ave' })
    await reversePlace({ lat: 38.433912, lng: -122.704411 })
    await reversePlace({ lat: 38.433914, lng: -122.704409 })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('looks up a pin that moved more than a meter or so', async () => {
    const fetchMock = mockFetch({ display_name: 'Somewhere' })
    await reversePlace({ lat: 38.4339, lng: -122.7044 })
    await reversePlace({ lat: 38.4349, lng: -122.7044 })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('does not send an aborted reverse lookup', async () => {
    const fetchMock = mockFetch({ display_name: 'x' })
    const controller = new AbortController()
    controller.abort()
    await expect(reversePlace({ lat: 1, lng: 1 }, controller.signal)).rejects.toThrow()
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
