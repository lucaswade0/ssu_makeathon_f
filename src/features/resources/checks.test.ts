import { describe, expect, it } from 'vitest'
import { checkResource, friendlyDbError } from './checks'
import { sampleExtras } from './sampleData'
import type { Resource } from './schemas'

const good = { category: 'water_food' as const, title: 'Free bottled water', description: 'Cases of water at the front desk, 9am to 5pm.', city: 'Santa Rosa', latitude: 38.44, longitude: -122.71 }
const existing: Resource = { ...sampleExtras[0]!, category: 'water_food', title: 'Free Bottled Water!', latitude: 38.4402, longitude: -122.7102 }

describe('checkResource', () => {
  it('accepts a normal submission', () => {
    expect(checkResource(good, [])).toEqual({ problems: [], duplicate: null })
  })

  it('blocks junk text', () => {
    expect(checkResource({ ...good, title: 'aaaa' }, []).problems).toHaveLength(1)
    expect(checkResource({ ...good, title: '!!!' }, []).problems).toHaveLength(1)
    expect(checkResource({ ...good, description: 'x' }, []).problems).toHaveLength(1)
  })

  it('blocks links in the name or description', () => {
    expect(checkResource({ ...good, description: 'Free water, sign up at bit.ly/abc' }, []).problems[0]).toMatch(/Links/)
    expect(checkResource({ ...good, title: 'Water www.example.com' }, []).problems[0]).toMatch(/Links/)
  })

  it('blocks a pin far from the selected city but allows cities it cannot check', () => {
    const fresnoPin = { latitude: 36.7378, longitude: -119.7871 }
    expect(checkResource({ ...good, ...fresnoPin }, []).problems[0]).toMatch(/km from Santa Rosa/)
    expect(checkResource({ ...good, ...fresnoPin, city: 'Fresno' }, []).problems).toEqual([])
  })

  it('flags a same-type resource with a similar name within 100 m', () => {
    expect(checkResource(good, [existing]).duplicate?.title).toBe('Free Bottled Water!')
    expect(checkResource({ ...good, category: 'medical' }, [existing]).duplicate).toBeNull()
    expect(checkResource({ ...good, latitude: 38.45 }, [existing]).duplicate).toBeNull()
  })
})

describe('friendlyDbError', () => {
  it('turns database rule names into the form messages and leaves other errors alone', () => {
    expect(friendlyDbError('new row for relation "resources" violates check constraint "resources_community_no_links"')).toMatch(/Links aren/)
    expect(friendlyDbError('You can add up to 10 resources per hour. Please try again later.')).toMatch(/10 resources per hour/)
  })
})
