import { useEffect, useState } from 'react'
import { useI18n } from '../i18n/context'
import { dateLocale, htmlLang } from '../i18n/languages'
import { TranslateControl } from '../i18n/TranslateControl'
import { ExternalLink } from 'lucide-react'
import { clockTime, hasLiveCoverage, useEarthquakes, useEvacuationZones, useFireIncidents, useWeatherAlerts } from '../hazards/liveHazards'
import { useSimulation } from '../simulation/context'
import { filterNews, incidentItems, isExpired, sortNews, weatherItems, zoneItems, type NewsHazard, type NewsItem } from './newsItems'

const hazards: NewsHazard[] = ['weather', 'fire', 'evacuation', 'earthquake']

const sources = ['news.src.nws', 'news.src.nifc', 'news.src.caloes', 'news.src.usgs'] as const

function formatTime(value: string | null, notListed: string, locale?: string) {
  return value ? new Date(value).toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' }) : notListed
}

function NewsCard({ item, expired }: { item: NewsItem; expired: boolean }) {
  const { t, lang } = useI18n()
  // Translating replaces the title and summary together until the person asks for the original again.
  const [translated, setTranslated] = useState<string[] | null>(null)
  const [title, ...summary] = translated ?? [item.title, item.summary]
  return <article className={`news-card${expired ? ' expired' : ''}`} aria-label={item.title}>
    <div className="news-tags">
      <span className="news-hazard">{t(`news.hazard.${item.hazard}`)}</span>
      {item.level && <span className={`zone-badge-inline ${item.level}`}>{item.level === 'order' ? t('news.order') : t('news.warning')}</span>}
      {expired && <span className="news-expired">{t('news.expired')}</span>}
      <span className="badge community">{item.sample ? t('alert.sample') : t('alert.public')}</span>
    </div>
    <h3 lang={translated ? htmlLang[lang] : undefined}>{title}</h3>
    <p className="body-text" lang={translated ? htmlLang[lang] : undefined}>{summary.join(' ')}</p>
    <TranslateControl texts={[item.title, item.summary]} onTranslated={setTranslated} />
    <div className="news-meta">
      <span>{item.source}</span>
      <time dateTime={item.time ?? undefined}>{formatTime(item.time, t('news.timeNotListed'), dateLocale(lang))}</time>
      <a href={item.url}>{t('news.viewSource')}<ExternalLink size={14} aria-hidden="true" /></a>
    </div>
  </article>
}

export function NewsPage({ city }: { city: string }) {
  const { t } = useI18n()
  const sim = useSimulation()
  const showSample = sim.active
  const [filter, setFilter] = useState<'all' | NewsHazard>('all')
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000)
    return () => window.clearInterval(timer)
  }, [])

  const covered = hasLiveCoverage(city)
  const weather = useWeatherAlerts(city)
  const fires = useFireIncidents(city)
  const zones = useEvacuationZones(city)
  const quakes = useEarthquakes(city)
  const queries = [
    { name: 'National Weather Service', query: weather },
    { name: 'NIFC', query: fires },
    { name: 'Cal OES', query: zones },
    { name: 'USGS', query: quakes },
  ]

  const zoneProperties = [...new Map((zones.data?.features ?? []).map(f => [f.properties.zone_id, f.properties])).values()]
  const all = showSample
    ? sim.state?.news ?? []
    : [
      ...weatherItems(weather.data ?? []),
      ...incidentItems([...(fires.data ?? []), ...(quakes.data ?? [])], false),
      ...zoneItems(zoneProperties, false),
    ]
  const items = filterNews(sortNews(all, now), filter)

  const live = !showSample && covered
  const loading = live && queries.some(({ query }) => query.isPending)
  const failed = live ? queries.filter(({ query }) => query.isError).map(({ name }) => name) : []
  const checkedAt = Math.max(0, ...queries.map(({ query }) => query.dataUpdatedAt))

  return <section className="news" aria-label={t('news.region')}>
    <div className="news-heading">
      <h2>{t('news.title', { city })}</h2>
      <p className="muted">{t('news.subtitle')}</p>
    </div>

    <div className="news-controls">
      <label className="news-filter">{t('news.show')}
        <select value={filter} onChange={e => setFilter(e.target.value as typeof filter)}>
          <option value="all">{t('news.all')}</option>
          {hazards.map(hazard => <option key={hazard} value={hazard}>{t(`news.hazard.${hazard}`)}</option>)}
        </select>
      </label>
    </div>

    {showSample && <p className="notice" role="status">{t('news.simNotice')}</p>}
    {!showSample && !covered && <p className="notice" role="status">{t('feed.noCoverage')}</p>}
    {loading && <p role="status">{t('news.checking')}</p>}
    {failed.length > 0 && <p role="alert" className="error">{t('news.failed', { sources: failed.join(', ') })}</p>}

    {items.length > 0
      ? <div className="news-list">{items.map(item => <NewsCard key={item.id} item={item} expired={isExpired(item, now)} />)}</div>
      : !loading && (showSample || covered) && <div className="panel">
        <h3>{t('news.emptyTitle', { city })}</h3>
        <p>{filter === 'all' ? t('news.emptyAll') : t('news.emptyType')}</p>
      </div>}

    {live && checkedAt > 0 && <p className="muted">{t('news.lastChecked', { time: clockTime(checkedAt) })}</p>}

    <details className="data-sources">
      <summary>{t('news.dataSources')}</summary>
      <ul>{sources.map(key => <li key={key}>{showSample ? t('news.sourceSample', { source: t(key) }) : t('news.sourceLive', { source: t(key) })}</li>)}</ul>
      <p className="muted">{t('news.safetyNote')}</p>
    </details>
  </section>
}
