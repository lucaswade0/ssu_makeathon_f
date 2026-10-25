import { useEffect, useState } from 'react'
import { Pause, Play, Radio, SkipBack, SkipForward, X } from 'lucide-react'
import { useI18n } from '../i18n/context'
import { useSimulation, type SimSpeed } from './context'

const speeds: SimSpeed[] = [1, 2, 4]

export function SimulationBar() {
  const sim = useSimulation()
  const { t } = useI18n()
  // On phones the start button is a small round icon; the first tap shows its label, the second starts.
  const [expanded, setExpanded] = useState(false)
  useEffect(() => {
    if (!expanded) return
    const id = setTimeout(() => setExpanded(false), 4000)
    return () => clearTimeout(id)
  }, [expanded])

  if (!sim.active || !sim.step) {
    const onClick = () => {
      if (!expanded && window.matchMedia?.('(max-width: 720px)').matches) setExpanded(true)
      else sim.start()
    }
    return <button type="button" className={`sim-start${expanded ? ' expanded' : ''}`} aria-label={t('sim.start')} onClick={onClick}>
      <Radio size={18} aria-hidden="true" /><span className="sim-start-label">{t('sim.start')}</span>
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
