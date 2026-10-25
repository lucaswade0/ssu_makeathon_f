import { describe, expect, it } from 'vitest'
import css from '../App.css?inline'

describe('mobile bottom navigation', () => {
  // Regression: the Map page uses the compact layout, whose rail rule is more specific than the
  // mobile one, so the active-tab bar sat 8px down and cut across the map pin icon.
  it('keeps the active-tab bar on the top edge in the compact layout too', () => {
    // The last matching rule wins when specificity ties, so it must be the mobile one.
    const rules = [...css.matchAll(/[^{}]*\.compact \.nav-rail button\[aria-current='page'\]::before[^{}]*\{([^}]*)\}/g)]
    const last = rules.at(-1)
    expect(last).toBeDefined()
    expect(last![1]).toMatch(/top: 0;/)
    expect(last![1]).toMatch(/bottom: auto;/)
  })
})
