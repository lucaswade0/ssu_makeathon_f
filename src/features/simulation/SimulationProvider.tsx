import { useEffect, useMemo, useReducer, type ReactNode } from 'react'
import { deriveValue, idle, SimulationContext, simulationReducer } from './context'

const STEP_MS = 6000

export function SimulationProvider({ children }: { children: ReactNode }) {
  const [machine, dispatch] = useReducer(simulationReducer, idle)

  useEffect(() => {
    if (!machine.active || !machine.playing) return
    const timer = window.setInterval(() => dispatch({ type: 'tick' }), STEP_MS / machine.speed)
    return () => window.clearInterval(timer)
  }, [machine.active, machine.playing, machine.speed])

  const value = useMemo(() => deriveValue(machine, dispatch), [machine])
  return <SimulationContext.Provider value={value}>{children}</SimulationContext.Provider>
}
