import type { ZoneHazard } from './sampleData'

export type HazardFilter = 'fire' | 'flood' | 'earthquake' | 'heat'
export type ShownHazards = Record<HazardFilter, boolean>

export const hazardFilters: { id: HazardFilter; label: string }[] = [
  { id: 'fire', label: 'Wildfire' },
  { id: 'flood', label: 'Flood' },
  { id: 'earthquake', label: 'Earthquake' },
  { id: 'heat', label: 'Heat' },
]

export const allShown: ShownHazards = { fire: true, flood: true, earthquake: true, heat: true }

// Zones of unknown hazard stay visible: hiding an evacuation order we can't classify is the riskier mistake.
export function zoneShown(hazard: ZoneHazard, shown: ShownHazards) {
  return hazard === 'other' || shown[hazard]
}

// NWS alerts are matched on their event name; anything unrecognised (e.g. wind) is always shown.
export function weatherAlertShown(event: string, shown: ShownHazards) {
  if (/flood/i.test(event)) return shown.flood
  if (/heat/i.test(event)) return shown.heat
  if (/fire|red flag/i.test(event)) return shown.fire
  return true
}
