import { createContext, useContext } from 'react'
import { simulationState, steps, type SimState, type SimStep, baseTime } from './scenario'

export type SimSpeed = 1 | 2 | 4

export type SimMachine = { active: boolean; index: number; playing: boolean; speed: SimSpeed; base: number }

export type SimAction =
  | { type: 'start'; now: number }
  | { type: 'stop' }
  | { type: 'next' }
  | { type: 'prev' }
  | { type: 'goTo'; index: number }
  | { type: 'togglePlay' }
  | { type: 'setSpeed'; speed: SimSpeed }
  | { type: 'tick' }

export const idle: SimMachine = { active: false, index: 0, playing: false, speed: 1, base: 0 }

const lastIndex = steps.length - 1
const clamp = (index: number) => Math.min(Math.max(Math.trunc(index), 0), lastIndex)

// Manual stepping pauses auto-play so a presenter is never surprised by the next step.
export function simulationReducer(state: SimMachine, action: SimAction): SimMachine {
  switch (action.type) {
    case 'start': return { ...state, active: true, index: 0, playing: true, base: baseTime(action.now) }
    case 'stop': return { ...idle, speed: state.speed }
    case 'next': return state.active ? { ...state, index: clamp(state.index + 1), playing: false } : state
    case 'prev': return state.active ? { ...state, index: clamp(state.index - 1), playing: false } : state
    case 'goTo': return state.active ? { ...state, index: clamp(action.index), playing: false } : state
    case 'setSpeed': return { ...state, speed: action.speed }
    case 'togglePlay':
      if (!state.active) return state
      if (state.playing) return { ...state, playing: false }
      return { ...state, playing: true, index: state.index >= lastIndex ? 0 : state.index }
    case 'tick': {
      if (!state.active || !state.playing) return state
      const index = clamp(state.index + 1)
      return { ...state, index, playing: index < lastIndex }
    }
  }
}

export type SimulationValue = SimMachine & {
  total: number
  step: SimStep | null
  state: SimState | null
  start: () => void
  stop: () => void
  next: () => void
  prev: () => void
  goTo: (index: number) => void
  togglePlay: () => void
  setSpeed: (speed: SimSpeed) => void
}

const noop = () => {}

// Without a provider (for example in tests) the simulation is simply off.
export const SimulationContext = createContext<SimulationValue>({
  ...idle, total: steps.length, step: null, state: null,
  start: noop, stop: noop, next: noop, prev: noop, goTo: noop, togglePlay: noop, setSpeed: noop,
})

export function useSimulation() {
  return useContext(SimulationContext)
}

export function deriveValue(machine: SimMachine, dispatch: (action: SimAction) => void): SimulationValue {
  return {
    ...machine,
    total: steps.length,
    step: machine.active ? steps[machine.index] ?? null : null,
    state: machine.active ? simulationState(machine.index, machine.base) : null,
    start: () => dispatch({ type: 'start', now: Date.now() }),
    stop: () => dispatch({ type: 'stop' }),
    next: () => dispatch({ type: 'next' }),
    prev: () => dispatch({ type: 'prev' }),
    goTo: index => dispatch({ type: 'goTo', index }),
    togglePlay: () => dispatch({ type: 'togglePlay' }),
    setSpeed: speed => dispatch({ type: 'setSpeed', speed }),
  }
}
