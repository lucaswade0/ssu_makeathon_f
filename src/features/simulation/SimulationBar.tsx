import { Pause, Play, Radio, SkipBack, SkipForward, X } from 'lucide-react'
import { useSimulation, type SimSpeed } from './context'

const speeds: SimSpeed[] = [1, 2, 4]

export function SimulationBar() {
  const sim = useSimulation()

  if (!sim.active || !sim.step) {
    return <button type="button" className="sim-start" onClick={sim.start}>
      <Radio size={18} aria-hidden="true" />Run disaster simulation
    </button>
  }

  const atEnd = sim.index >= sim.total - 1
  return <section className="sim-bar" aria-label="Disaster simulation">
    <div className="sim-head">
      <span className="sim-tag">SIMULATION · Sample data, not a real event</span>
      <span className="sim-clock">{sim.step.clock}</span>
      <button type="button" className="ghost icon" aria-label="Exit simulation" title="Exit simulation" onClick={sim.stop}><X size={18} aria-hidden="true" /></button>
    </div>
    <h2 className="sim-title">Step {sim.index + 1} of {sim.total}: {sim.step.title}</h2>
    <p className="sim-narration" role="status">{sim.step.narration}</p>
    <div className="sim-controls">
      <button type="button" className="ghost icon" aria-label="Previous step" title="Previous step" disabled={sim.index === 0} onClick={sim.prev}><SkipBack size={18} aria-hidden="true" /></button>
      <button type="button" className="sim-play" aria-label={sim.playing ? 'Pause' : atEnd ? 'Replay' : 'Play'} onClick={sim.togglePlay}>
        {sim.playing ? <Pause size={18} aria-hidden="true" /> : <Play size={18} aria-hidden="true" />}{sim.playing ? 'Pause' : atEnd ? 'Replay' : 'Play'}
      </button>
      <button type="button" className="ghost icon" aria-label="Next step" title="Next step" disabled={atEnd} onClick={sim.next}><SkipForward size={18} aria-hidden="true" /></button>
      <input type="range" className="sim-scrub" aria-label="Simulation step" min={0} max={sim.total - 1} value={sim.index} onChange={e => sim.goTo(Number(e.target.value))} />
      <label className="sim-speed">Speed
        <select value={sim.speed} onChange={e => sim.setSpeed(Number(e.target.value) as SimSpeed)}>
          {speeds.map(speed => <option key={speed} value={speed}>{speed}x</option>)}
        </select>
      </label>
    </div>
  </section>
}
