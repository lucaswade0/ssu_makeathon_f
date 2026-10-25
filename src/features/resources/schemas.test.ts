import { describe, expect, it } from 'vitest'
import { timeAgo } from './format'
import { resourceToShelter, sampleExtras, sampleResources, shelterToResource } from './sampleData'
import { categories, categoryLabels, filterResources, isStale, reportInputSchema, resourceInputSchema, type Resource } from './schemas'
import { sampleShelters } from '../map/sampleData'

const now = Date.parse('2026-10-24T18:00:00Z')
const resource = (over: Partial<Resource>): Resource => ({ ...sampleExtras[0]!, ...over })
const input = { category: 'water_food', title: 'Water', description: 'Bottled water', location_text: 'Main St', city: 'Santa Rosa', latitude: 38.4, longitude: -122.7 }

describe('resource input', () => {
  it('accepts a valid submission and trims text', () => {
    expect(resourceInputSchema.parse({ ...input, title: '  Water  ' }).title).toBe('Water')
  })

  it('rejects blank text, unknown categories, and out-of-range coordinates', () => {
    expect(() => resourceInputSchema.parse({ ...input, title: '   ' })).toThrow()
    expect(() => resourceInputSchema.parse({ ...input, description: '' })).toThrow()
    expect(() => resourceInputSchema.parse({ ...input, category: 'weapons' })).toThrow()
    expect(() => resourceInputSchema.parse({ ...input, latitude: 91 })).toThrow()
    expect(() => resourceInputSchema.parse({ ...input, longitude: -181 })).toThrow()
  })

  it('has a label for every category', () => {
    for (const category of categories) expect(categoryLabels[category]).toBeTruthy()
  })

  it('validates report reasons and caps details', () => {
    expect(reportInputSchema.parse({ reason: 'unsafe' }).reason).toBe('unsafe')
    expect(() => reportInputSchema.parse({ reason: 'spam' })).toThrow()
    expect(() => reportInputSchema.parse({ reason: 'other', details: 'x'.repeat(1001) })).toThrow()
  })
})

describe('filtering', () => {
  const items = [
    resource({ id: 'a', category: 'shelter', status: 'official' }),
    resource({ id: 'b', category: 'medical', status: 'verified' }),
    resource({ id: 'c', category: 'medical', status: 'community_submitted' }),
  ]

  it('returns everything for "all"', () => expect(filterResources(items, 'all')).toHaveLength(3))
  it('filters by category', () => expect(filterResources(items, 'medical').map(r => r.id)).toEqual(['b', 'c']))
  it('filters by status', () => expect(filterResources(items, 'community_submitted').map(r => r.id)).toEqual(['c']))
  it('returns nothing when nothing matches', () => expect(filterResources(items, 'pets')).toEqual([]))
})

describe('stale handling', () => {
  it('flags resources not confirmed in over 7 days', () => {
    expect(isStale({ last_confirmed_at: '2026-10-16T17:59:00Z' }, now)).toBe(true)
    expect(isStale({ last_confirmed_at: '2026-10-17T18:00:00Z' }, now)).toBe(false)
    expect(isStale({ last_confirmed_at: '2026-10-24T17:00:00Z' }, now)).toBe(false)
  })

  it('formats elapsed time', () => {
    expect(timeAgo('2026-10-24T17:59:40Z', now)).toBe('just now')
    expect(timeAgo('2026-10-24T17:15:00Z', now)).toBe('45 min ago')
    expect(timeAgo('2026-10-24T12:00:00Z', now)).toBe('6 h ago')
    expect(timeAgo('2026-10-20T18:00:00Z', now)).toBe('4 days ago')
  })
})

describe('localized time', () => {
  it('uses the browser’s wording for the reader’s language', () => {
    expect(timeAgo('2026-10-24T17:15:00Z', now, 'es')).toBe('hace 45 minutos')
    expect(timeAgo('2026-10-24T12:00:00Z', now, 'es')).toBe('hace 6 horas')
    expect(timeAgo('2026-10-24T17:15:00Z', now, 'zh-Hans')).toContain('45')
    expect(timeAgo('2026-10-20T18:00:00Z', now, 'vi')).toContain('4')
  })

  it('says "now" for something just confirmed', () => {
    expect(timeAgo('2026-10-24T17:59:50Z', now, 'es')).toBe('este minuto')
  })

  it('stays English without a locale', () => {
    expect(timeAgo('2026-10-24T17:15:00Z', now)).toBe('45 min ago')
  })
})

describe('sample data', () => {
  it('covers all six categories and all three trust levels', () => {
    expect(new Set(sampleResources.map(r => r.category)).size).toBe(6)
    expect(new Set(sampleResources.map(r => r.status))).toEqual(new Set(['official', 'verified', 'community_submitted']))
  })

  it('has unique ids and a source on every record', () => {
    expect(new Set(sampleResources.map(r => r.id)).size).toBe(sampleResources.length)
    expect(sampleResources.every(r => r.source.length > 0)).toBe(true)
  })

  it('keeps community resources marked unverified', () => {
    const community = sampleResources.filter(r => r.source === 'Community submission')
    expect(community.every(r => r.status === 'community_submitted')).toBe(true)
  })

  it('converts a shelter to a resource and back without losing fields', () => {
    for (const shelter of sampleShelters) expect(resourceToShelter(shelterToResource(shelter))).toEqual({ ...shelter, category: 'shelter' })
    expect(shelterToResource(sampleShelters[0]!).category).toBe('shelter')
  })

  it('keeps every category when turning resources into map pins', () => {
    const pins = sampleResources.map(resourceToShelter)
    expect(pins).toHaveLength(sampleResources.length)
    expect(new Set(pins.map(pin => pin.category))).toEqual(new Set(categories))
    expect(pins.every(pin => Number.isFinite(pin.latitude) && Number.isFinite(pin.longitude))).toBe(true)
  })
})
