import { useEffect, useState } from 'react'
import { ExternalLink } from 'lucide-react'
import { clockTime, hasLiveCoverage, NO_COVERAGE, useEarthquakes, useEvacuationZones, useFireIncidents, useWeatherAlerts } from '../hazards/liveHazards'
import { sampleIncidents, sampleZones } from '../map/sampleData'
import { filterNews, hazardLabels, incidentItems, isExpired, sampleEarthquake, sortNews, weatherItems, zoneItems, type NewsHazard, type NewsItem } from './newsItems'

const sources = [
  'National Weather Service (weather alerts)',
  'NIFC WFIGS (wildfire incidents)',
  'Cal OES (evacuation orders and warnings)',
  'USGS Earthquake Hazards Program (earthquakes)',
]

function formatTime(value: string | null) {
  return value ? new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : 'Time not listed'
}

function NewsCard({ item, expired }: { item: NewsItem; expired: boolean }) {
  return <article className={`news-card${expired ? ' expired' : ''}`} aria-label={item.title}>
    <div className="news-tags">
      <span className="news-hazard">{hazardLabels[item.hazard]}</span>
      {item.level && <span className={`zone-badge-inline ${item.level}`}>{item.level === 'order' ? 'ORDER' : 'WARNING'}</span>}
      {expired && <span className="news-expired">Expired</span>}
      <span className="badge community">{item.sample ? 'Sample data' : 'Public data'}</span>
    </div>
    <h3>{item.title}</h3>
    <p className="body-text">{item.summary}</p>
    <div className="news-meta">
      <span>{item.source}</span>
      <time dateTime={item.time ?? undefined}>{formatTime(item.time)}</time>
      <a href={item.url} target="_blank" rel="noopener noreferrer">View source<ExternalLink size={14} aria-hidden="true" /></a>
    </div>
  </article>
}

export function NewsPage({ city }: { city: string }) {
  const [showSample, setShowSample] = useState(false)
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
  const sampleZoneProperties = [...new Map(sampleZones.features.map(f => [f.properties.zone_id, f.properties])).values()]
  const all = showSample
    ? incidentItems([...sampleIncidents, sampleEarthquake], true).concat(zoneItems(sampleZoneProperties, true))
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

  return <section className="news" aria-label="News">
    <div className="news-heading">
      <h2>News for {city}</h2>
      <p className="muted">Updates from public sources, shown with their source and time. This is not official guidance from Safety SAM.</p>
    </div>

    <div className="news-controls">
      <button type="button" className={`scenario-toggle${showSample ? ' on' : ''}`} aria-pressed={showSample} onClick={() => setShowSample(!showSample)}>
        <span className="scenario-switch" aria-hidden="true" />
        <span>
          <strong>Sample scenario {showSample ? 'on' : 'off'}</strong>
          <small>{showSample ? 'Showing demo updates, not real events' : 'Showing live public data'}</small>
        </span>
      </button>
      <label className="news-filter">Show
        <select value={filter} onChange={e => setFilter(e.target.value as typeof filter)}>
          <option value="all">All updates</option>
          {(Object.keys(hazardLabels) as NewsHazard[]).map(hazard => <option key={hazard} value={hazard}>{hazardLabels[hazard]}</option>)}
        </select>
      </label>
    </div>

    {showSample && <p className="notice" role="status">Sample scenario: these updates are not real events.</p>}
    {!showSample && !covered && <p className="notice" role="status">{NO_COVERAGE}</p>}
    {loading && <p role="status">Checking public sources…</p>}
    {failed.length > 0 && <p role="alert" className="error">Couldn’t reach {failed.join(', ')}. Showing updates from the other sources. Turn on the sample scenario to see example data.</p>}

    {items.length > 0
      ? <div className="news-list">{items.map(item => <NewsCard key={item.id} item={item} expired={isExpired(item, now)} />)}</div>
      : !loading && (showSample || covered) && <div className="panel">
        <h3>No updates listed for {city}</h3>
        <p>{filter === 'all' ? 'No public updates were found from these sources.' : `No ${hazardLabels[filter].toLowerCase()} updates were found.`} This does not confirm the area is safe. Check official sources.</p>
      </div>}

    {live && checkedAt > 0 && <p className="muted">Last checked {clockTime(checkedAt)} · Updates every 5 minutes.</p>}

    <details className="data-sources">
      <summary>Data sources</summary>
      <ul>{sources.map(source => <li key={source}>{source}: {showSample ? 'sample data shown' : 'live'}</li>)}</ul>
      <p className="muted">Follow instructions from local officials. In an emergency, call 911.</p>
    </details>
  </section>
}
