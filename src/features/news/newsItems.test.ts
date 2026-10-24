import { describe, expect, it } from 'vitest'
import { filterNews, incidentItems, isExpired, sampleEarthquake, sortNews, weatherItems, zoneItems, type NewsItem } from './newsItems'

const now = Date.parse('2026-10-24T18:00:00Z')

describe('news items', () => {
  it('maps a weather alert and keeps the sender and times', () => {
    const [item] = weatherItems([{
      id: 'urn:1', event: 'Red Flag Warning', severity: 'Severe', headline: 'Red Flag Warning until 8 PM',
      areaDesc: 'North Bay Mountains', senderName: 'NWS San Francisco CA',
      effective: '2026-10-24T15:00:00Z', expires: '2026-10-25T03:00:00Z',
    }])
    expect(item).toMatchObject({ hazard: 'weather', source: 'NWS San Francisco CA', title: 'Red Flag Warning until 8 PM', sample: false })
    expect(item.summary).toContain('North Bay Mountains')
  })

  it('says when fire size and containment are not reported', () => {
    const [item] = incidentItems([{
      id: 'f1', kind: 'fire', title: 'Wildfire · Test', location_text: 'Sonoma County', latitude: 0, longitude: 0,
      source: 'NIFC WFIGS', updated_at: '2026-10-24T17:00:00Z',
    }], false)
    expect(item.summary).toBe('Size not reported · Containment not reported · Sonoma County')
  })

  it('files flood and heat incidents under weather', () => {
    const items = incidentItems([{
      id: 'w1', kind: 'flood', title: 'Flood watch', location_text: 'Creek', latitude: 0, longitude: 0,
      source: 'Sample data (National Weather Service)', updated_at: '2026-10-24T17:00:00Z',
    }], true)
    expect(items[0]).toMatchObject({ hazard: 'weather', sample: true })
  })

  it('labels evacuation orders and warnings', () => {
    const items = zoneItems([
      { zone_id: 'A1', level: 'order', hazard: 'fire', instructions: 'Leave now.', source: 'Cal OES', issued_at: null },
      { zone_id: 'A2', level: 'warning', hazard: 'fire', instructions: 'Be ready.', source: 'Cal OES', issued_at: null },
    ], false)
    expect(items.map(item => item.title)).toEqual(['Evacuation order · Zone A1', 'Evacuation warning · Zone A2'])
  })

  it('maps a USGS earthquake incident to an earthquake update', () => {
    const [item] = incidentItems([{
      id: 'usgs-1', kind: 'earthquake', title: 'M3.1 earthquake', location_text: '5 km W of Cobb, CA', latitude: 0, longitude: 0,
      source: 'USGS earthquake catalog', updated_at: '2026-10-24T10:00:00Z',
    }], false)
    expect(item).toMatchObject({ hazard: 'earthquake', title: 'M3.1 earthquake', sample: false })
    expect(item.summary).toContain('5 km W of Cobb, CA')
    expect(item.url).toContain('earthquake.usgs.gov')
  })

  it('marks the sample earthquake as sample data', () => {
    const [item] = incidentItems([sampleEarthquake], true)
    expect(item).toMatchObject({ hazard: 'earthquake', sample: true })
    expect(item.source).toContain('Sample')
  })

  it('shows fire size with thousands separators and containment', () => {
    const [item] = incidentItems([{
      id: 'f2', kind: 'fire', title: 'Wildfire · Big', location_text: 'Napa County', latitude: 0, longitude: 0,
      acres: 12500, containment: 40, source: 'NIFC WFIGS', updated_at: '2026-10-24T17:00:00Z',
    }], false)
    expect(item.summary).toBe('12,500 acres · 40% contained · Napa County')
  })

  it('does not drop an alert with no headline or expiry', () => {
    const [item] = weatherItems([{
      id: 'urn:2', event: 'Heat Advisory', severity: 'Moderate', headline: null,
      areaDesc: 'Inland Sonoma County', senderName: 'NWS', effective: '2026-10-24T15:00:00Z', expires: null,
    }])
    expect(item.title).toBe('Heat Advisory')
    expect(isExpired(item, now)).toBe(false)
  })

  it('keeps a zone without an issue time and sorts it after timed items', () => {
    const [zone] = zoneItems([{ zone_id: 'Z', level: 'order', hazard: 'fire', instructions: 'Leave now.', source: 'Cal OES', issued_at: null }], false)
    expect(zone.time).toBeNull()
    const timed: NewsItem = { ...zone, id: 'timed', time: '2026-10-24T10:00:00Z' }
    expect(sortNews([zone, timed], now).map(item => item.id)).toEqual(['timed', zone.id])
  })

  it('treats an alert as expired exactly at its expiry time', () => {
    const [item] = weatherItems([{
      id: 'urn:3', event: 'Flood Watch', severity: 'Minor', headline: null, areaDesc: 'Creek', senderName: 'NWS',
      effective: '2026-10-24T10:00:00Z', expires: '2026-10-24T18:00:00Z',
    }])
    expect(isExpired(item, now)).toBe(true)
    expect(isExpired(item, now - 1)).toBe(false)
  })

  it('filters by hazard and returns everything for "all"', () => {
    const base = { source: 's', summary: '', time: null, expires: null, url: '', sample: false }
    const items: NewsItem[] = [
      { ...base, id: 'a', hazard: 'weather', title: 'a' },
      { ...base, id: 'b', hazard: 'fire', title: 'b' },
      { ...base, id: 'c', hazard: 'earthquake', title: 'c' },
    ]
    expect(filterNews(items, 'all')).toHaveLength(3)
    expect(filterNews(items, 'fire').map(item => item.id)).toEqual(['b'])
    expect(filterNews(items, 'evacuation')).toEqual([])
  })

  it('does not change the order of the input list', () => {
    const base = { hazard: 'weather' as const, source: 's', summary: '', url: '', sample: false, expires: null }
    const input: NewsItem[] = [
      { ...base, id: '1', title: '1', time: '2026-10-24T10:00:00Z' },
      { ...base, id: '2', title: '2', time: '2026-10-24T11:00:00Z' },
    ]
    sortNews(input, now)
    expect(input.map(item => item.id)).toEqual(['1', '2'])
  })

  it('sorts newest first, expired and untimed items last', () => {
    const base = { hazard: 'weather' as const, source: 's', summary: '', url: '', sample: false }
    const items = sortNews([
      { ...base, id: 'old', title: 'old', time: '2026-10-24T10:00:00Z', expires: null },
      { ...base, id: 'expired', title: 'expired', time: '2026-10-24T17:00:00Z', expires: '2026-10-24T17:30:00Z' },
      { ...base, id: 'new', title: 'new', time: '2026-10-24T16:00:00Z', expires: null },
      { ...base, id: 'none', title: 'none', time: null, expires: null },
    ], now)
    expect(items.map(item => item.id)).toEqual(['new', 'old', 'none', 'expired'])
    expect(isExpired(items[3], now)).toBe(true)
  })
})
