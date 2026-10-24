import { describe, expect, it } from 'vitest'
import { allShown, weatherAlertShown, zoneShown } from './hazardFilters'

const floodsOnly = { ...allShown, fire: false, earthquake: false, heat: false }

describe('hazard filters', () => {
  it('hides zones of a filtered-out hazard but never zones of unknown hazard', () => {
    expect(zoneShown('flood', floodsOnly)).toBe(true)
    expect(zoneShown('fire', floodsOnly)).toBe(false)
    expect(zoneShown('other', floodsOnly)).toBe(true)
  })

  it('matches NWS alert names to hazards and always shows unrecognised ones', () => {
    expect(weatherAlertShown('Coastal Flood Advisory', floodsOnly)).toBe(true)
    expect(weatherAlertShown('Heat Advisory', floodsOnly)).toBe(false)
    expect(weatherAlertShown('Red Flag Warning', floodsOnly)).toBe(false)
    expect(weatherAlertShown('Wind Advisory', floodsOnly)).toBe(true)
  })
})
