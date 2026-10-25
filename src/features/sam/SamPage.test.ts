import { describe, expect, it } from 'vitest'
import { SAM_SUGGESTIONS } from './suggestions'

describe('SAM starter questions', () => {
  it('keeps the common questions grounded in SAM’s available data', () => {
    expect(SAM_SUGGESTIONS).toEqual([
      'What current alerts or evacuation zones affect my area?',
      'Where can I find water, food, or medical help?',
    ])
  })
})
