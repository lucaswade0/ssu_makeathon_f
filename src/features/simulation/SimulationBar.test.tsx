import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { deriveValue, idle, SimulationContext, simulationReducer } from './context'
import { SimulationBar } from './SimulationBar'

const html = (machine: Parameters<typeof deriveValue>[0]) =>
  renderToString(<SimulationContext.Provider value={deriveValue(machine, () => {})}><SimulationBar /></SimulationContext.Provider>).replaceAll('<!-- -->', '')

describe('SimulationBar', () => {
  it('offers to start when the simulation is off', () => {
    expect(html(idle)).toContain('Run disaster simulation')
  })

  it('names the start button for screen readers even when phones show only its icon', () => {
    const out = html(idle)
    expect(out).toContain('class="sim-start" aria-label="Run disaster simulation"')
    expect(out).toContain('<span class="sim-start-label">Run disaster simulation</span>')
  })

  it('labels the simulation as sample data and shows the current step', () => {
    const out = html(simulationReducer(idle, { type: 'start', now: Date.now() }))
    expect(out).toContain('Sample data, not a real event')
    expect(out).toContain('Step 1 of 8: Red Flag Warning issued')
    expect(out).toContain('Pause')
  })

  it('offers Replay at the end and disables Next', () => {
    const out = html({ ...simulationReducer(idle, { type: 'start', now: Date.now() }), index: 7, playing: false })
    expect(out).toContain('Replay')
    expect(out).toMatch(/aria-label="Next step"[^>]*disabled|disabled[^>]*aria-label="Next step"/)
  })

  it('disables Previous on the first step', () => {
    expect(html(simulationReducer(idle, { type: 'start', now: Date.now() }))).toMatch(/aria-label="Previous step"[^>]*disabled|disabled[^>]*aria-label="Previous step"/)
  })
})
