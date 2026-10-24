import { describe, expect, it } from 'vitest'
import { baseTime, simulationState, steps } from './scenario'

const now = Date.parse('2026-10-24T18:00:00Z')
const base = baseTime(now)
const last = steps.length - 1
const at = (id: string) => steps.findIndex(step => step.id === id)

describe('wildfire simulation scenario', () => {
  it('has unique step ids and times that only move forward', () => {
    expect(new Set(steps.map(step => step.id)).size).toBe(steps.length)
    steps.slice(1).forEach((step, i) => expect(step.at).toBeGreaterThan(steps[i]!.at))
  })

  it('starts with a weather alert and no fire, zones, or posts about fire', () => {
    const state = simulationState(0, base)
    expect(state.alert?.title).toContain('Red Flag')
    expect(state.incidents).toEqual([])
    expect(state.zones.features).toEqual([])
    expect(state.news).toHaveLength(1)
  })

  it('adds the fire once smoke is reported and grows it over time', () => {
    const early = simulationState(at('smoke'), base).incidents[0]!
    const later = simulationState(at('containment'), base).incidents[0]!
    expect(early).toMatchObject({ kind: 'fire', acres: 5, containment: 0 })
    expect(later.acres).toBeGreaterThan(early.acres!)
    expect(later.containment).toBeGreaterThan(early.containment!)
  })

  it('shows the warning zone first, then the order zone, then clears them', () => {
    const ids = (index: number) => simulationState(index, base).zones.features.map(f => f.properties.zone_id)
    expect(ids(at('warning'))).toEqual(['SRO-E012'])
    expect(ids(at('order')).sort()).toEqual(['SRO-E011', 'SRO-E012'])
    expect(ids(at('downgrade'))).toEqual(['SRO-E012'])
    expect(ids(last)).toEqual([])
  })

  it('pins the newest alert for the current step', () => {
    expect(simulationState(at('warning'), base).alert?.title).toContain('warning')
    expect(simulationState(at('order'), base).alert?.title).toContain('order')
    expect(simulationState(last, base).alert?.title).toContain('lifted')
  })

  it('keeps news and posts cumulative, with the newest post first', () => {
    const early = simulationState(1, base)
    const late = simulationState(last, base)
    expect(late.news.length).toBeGreaterThan(early.news.length)
    expect(late.posts.length).toBeGreaterThan(early.posts.length)
    const times = late.posts.map(post => Date.parse(post.created_at))
    expect(times).toEqual([...times].sort((a, b) => b - a))
  })

  it('marks every news item as sample data', () => {
    expect(simulationState(last, base).news.every(item => item.sample)).toBe(true)
  })

  it('places every event in the past so the last step lands on now', () => {
    const state = simulationState(last, base)
    expect(state.alert && Date.parse(state.alert.issued_at)).toBeLessThanOrEqual(now)
    expect(state.news.every(item => item.time && Date.parse(item.time) <= now)).toBe(true)
  })

  it('is pure and clamps out-of-range steps', () => {
    expect(simulationState(2, base)).toEqual(simulationState(2, base))
    expect(simulationState(-5, base)).toEqual(simulationState(0, base))
    expect(simulationState(999, base)).toEqual(simulationState(last, base))
  })

  it('opens shelters over time with their trust labels', () => {
    const shelters = (index: number) => simulationState(index, base).shelters
    expect(shelters(at('order'))).toEqual([])
    expect(shelters(at('shelter')).map(s => [s.id, s.status])).toEqual([['shelter-1', 'official']])
    expect(shelters(at('containment')).map(s => s.status).sort()).toEqual(['community_submitted', 'official'])
    expect(shelters(at('downgrade')).map(s => s.status).sort()).toEqual(['community_submitted', 'official', 'verified'])
  })

  it('keeps the community shelter marked community-submitted until the end', () => {
    const community = simulationState(at('downgrade'), base).shelters.find(s => s.id === 'shelter-3')
    expect(community?.status).toBe('community_submitted')
    expect(community?.source).toBe('Community submission')
  })

  it('closes every shelter when the warnings are lifted', () => {
    expect(simulationState(last, base).shelters).toEqual([])
    expect(simulationState(last, base).news.some(item => item.title === 'Evacuation centers closing')).toBe(true)
  })

  it('opens non-shelter resources as the scenario unfolds and closes them at the end', () => {
    const ids = (index: number) => simulationState(index, base).resources.map(r => r.id)
    expect(ids(0)).toEqual([])
    expect(ids(at('order'))).toContain('resource-transport-1')
    expect(ids(at('shelter'))).toEqual(expect.arrayContaining(['shelter-1', 'resource-water-1', 'resource-pets-1']))
    expect(ids(at('containment'))).toContain('resource-medical-1')
    expect(ids(at('downgrade'))).toContain('resource-charging-1')
    expect(ids(last)).toEqual([])
  })

  it('keeps resource shelters in step with the map shelters', () => {
    for (let i = 0; i <= last; i++) {
      const state = simulationState(i, base)
      const shelterIds = state.resources.filter(r => r.category === 'shelter').map(r => r.id).sort()
      expect(shelterIds).toEqual(state.shelters.map(s => s.id).sort())
    }
  })

  it('keeps the charging resource community-submitted', () => {
    const charging = simulationState(at('downgrade'), base).resources.find(r => r.id === 'resource-charging-1')
    expect(charging?.status).toBe('community_submitted')
  })
})
