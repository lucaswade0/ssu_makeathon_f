import { Pause, Play, Radio, SkipBack, SkipForward, X } from 'lucide-react'
import { useI18n } from '../i18n/context'
import { useSimulation, type SimSpeed } from './context'

const speeds: SimSpeed[] = [1, 2, 4]

export function SimulationBar() {
  const sim = useSimulation()
  const { t } = useI18n()

  if (!sim.active || !sim.step) {
    return <button type="button" className="sim-start" onClick={sim.start}>
      <Radio size={18} aria-hidden="true" />{t('sim.start')}
    </button>
  }

  const atEnd = sim.index >= sim.total - 1
  const playLabel = sim.playing ? t('sim.pause') : atEnd ? t('sim.replay') : t('sim.play')
  return <section className="sim-bar" aria-label={t('sim.region')}>
    <div className="sim-head">
      <span className="sim-tag">{t('sim.tag')}</span>
      <span className="sim-clock">{sim.step.clock}</span>
      <button type="button" className="ghost icon" aria-label={t('sim.exit')} title={t('sim.exit')} onClick={sim.stop}><X size={18} aria-hidden="true" /></button>
    </div>
    <h2 className="sim-title">{t('sim.step', { n: sim.index + 1, total: sim.total, title: sim.step.title })}</h2>
    <p className="sim-narration" role="status">{sim.step.narration}</p>
    <div className="sim-controls">
      <button type="button" className="ghost icon" aria-label={t('sim.prev')} title={t('sim.prev')} disabled={sim.index === 0} onClick={sim.prev}><SkipBack size={18} aria-hidden="true" /></button>
      <button type="button" className="sim-play" aria-label={playLabel} onClick={sim.togglePlay}>
        {sim.playing ? <Pause size={18} aria-hidden="true" /> : <Play size={18} aria-hidden="true" />}{playLabel}
      </button>
      <button type="button" className="ghost icon" aria-label={t('sim.next')} title={t('sim.next')} disabled={atEnd} onClick={sim.next}><SkipForward size={18} aria-hidden="true" /></button>
      <input type="range" className="sim-scrub" aria-label={t('sim.scrub')} min={0} max={sim.total - 1} value={sim.index} onChange={e => sim.goTo(Number(e.target.value))} />
      <label className="sim-speed">{t('sim.speed')}
        <select value={sim.speed} onChange={e => sim.setSpeed(Number(e.target.value) as SimSpeed)}>
          {speeds.map(speed => <option key={speed} value={speed}>{speed}x</option>)}
        </select>
      </label>
    </div>
  </section>
}
