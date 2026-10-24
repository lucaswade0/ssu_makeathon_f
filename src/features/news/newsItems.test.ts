import { describe, expect, it } from 'vitest'
import { earthquakeItems, incidentItems, isExpired, sortNews, weatherItems, zoneItems } from './newsItems'

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
      { zone_id: 'A1', level: 'order', instructions: 'Leave now.', source: 'Cal OES', issued_at: null },
      { zone_id: 'A2', level: 'warning', instructions: 'Be ready.', source: 'Cal OES', issued_at: null },
    ], false)
    expect(items.map(item => item.title)).toEqual(['Evacuation order · Zone A1', 'Evacuation warning · Zone A2'])
  })

  it('formats earthquake magnitude to one decimal', () => {
    const [item] = earthquakeItems([{ id: 'q', magnitude: 3.14, place: '5 km W of Cobb, CA', time: '2026-10-24T10:00:00Z', url: '', source: 'USGS' }], false)
    expect(item.title).toBe('Magnitude 3.1 earthquake · 5 km W of Cobb, CA')
    expect(item.url).toContain('earthquake.usgs.gov')
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
