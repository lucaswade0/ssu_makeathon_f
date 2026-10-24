import { describe, expect, it } from 'vitest'
import { idle, simulationReducer, type SimMachine } from './context'
import { steps } from './scenario'

const last = steps.length - 1
const started = (): SimMachine => simulationReducer(idle, { type: 'start', now: 1_000_000 })

describe('simulation controls', () => {
  it('starts at step 1, playing', () => {
    expect(started()).toMatchObject({ active: true, index: 0, playing: true })
  })

  it('ignores controls while inactive', () => {
    for (const action of [{ type: 'next' }, { type: 'prev' }, { type: 'togglePlay' }, { type: 'tick' }, { type: 'goTo', index: 3 }] as const) {
      expect(simulationReducer(idle, action)).toEqual(idle)
    }
  })

  it('advances on tick and stops playing at the last step', () => {
    let state = started()
    for (let i = 0; i < last; i++) state = simulationReducer(state, { type: 'tick' })
    expect(state).toMatchObject({ index: last, playing: false })
    expect(simulationReducer(state, { type: 'tick' }).index).toBe(last)
  })

  it('pauses auto-play when stepping manually', () => {
    expect(simulationReducer(started(), { type: 'next' })).toMatchObject({ index: 1, playing: false })
    expect(simulationReducer({ ...started(), index: 3 }, { type: 'prev' })).toMatchObject({ index: 2, playing: false })
  })

  it('never steps below the first or above the last step', () => {
    expect(simulationReducer(started(), { type: 'prev' }).index).toBe(0)
    expect(simulationReducer({ ...started(), index: last }, { type: 'next' }).index).toBe(last)
    expect(simulationReducer(started(), { type: 'goTo', index: 999 }).index).toBe(last)
    expect(simulationReducer(started(), { type: 'goTo', index: -4 }).index).toBe(0)
  })

  it('replays from the start when play is pressed at the end', () => {
    const atEnd = { ...started(), index: last, playing: false }
    expect(simulationReducer(atEnd, { type: 'togglePlay' })).toMatchObject({ index: 0, playing: true })
  })

  it('pauses and resumes in place', () => {
    const paused = simulationReducer({ ...started(), index: 2 }, { type: 'togglePlay' })
    expect(paused).toMatchObject({ index: 2, playing: false })
    expect(simulationReducer(paused, { type: 'togglePlay' })).toMatchObject({ index: 2, playing: true })
  })

  it('keeps the chosen speed after exiting', () => {
    const fast = simulationReducer(started(), { type: 'setSpeed', speed: 4 })
    expect(simulationReducer(fast, { type: 'stop' })).toEqual({ ...idle, speed: 4 })
  })
})
