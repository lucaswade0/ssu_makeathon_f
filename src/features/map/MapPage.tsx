import { useState } from 'react'
import { useCommunitySession } from '../community/session'
import { cityCenter, clockTime, hasLiveCoverage, NO_COVERAGE, noPerimeters, useEvacuationZones, useFireIncidents, useFirePerimeters, useWeatherAlerts } from '../hazards/liveHazards'
import { Icon, ShelterMap } from '../shelters/ShelterMap'
import { useShelters } from '../shelters/useShelters'
import { noZones, sampleIncidents, sampleShelters, sampleZones, type Incident, type MapSelection, type Shelter, type ZoneProperties } from './sampleData'

type MapTab = 'incidents' | 'shelters' | 'alerts'

const tabs: { id: MapTab; label: string }[] = [
  { id: 'incidents', label: 'Incidents' },
  { id: 'shelters', label: 'Shelters' },
  { id: 'alerts', label: 'Alerts' },
]

const tabFor: Record<MapSelection['type'], MapTab> = { incident: 'incidents', shelter: 'shelters', zone: 'alerts' }

const statusLabel = {
  official: 'Official',
  verified: 'Verified',
  community_submitted: 'Community-submitted · unverified',
}

function timeAgo(iso: string) {
  const minutes = Math.round((Date.now() - Date.parse(iso)) / 60_000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes} min ago`
  if (minutes < 48 * 60) return `${Math.round(minutes / 60)} h ago`
  return `${Math.round(minutes / 1440)} days ago`
}

type RowProps = {
  icon: Parameters<typeof Icon>[0]['name']
  tone: string
  title: string
  meta: string
  active: boolean
  onClick: () => void
}

function Row({ icon, tone, title, meta, active, onClick }: RowProps) {
  return (
    <li>
      <button type="button" className={`map-row${active ? ' active' : ''}`} onClick={onClick}>
        <span className={`map-row-icon ${tone}`}><Icon name={icon} /></span>
        <span><strong>{title}</strong><small>{meta}</small></span>
      </button>
    </li>
  )
}

function Detail({ selection, shelters, incidents, zones }: { selection: MapSelection; shelters: Shelter[]; incidents: Incident[]; zones: ZoneProperties[] }) {
  if (selection.type === 'incident') {
    const i = incidents.find(x => x.id === selection.id)
    if (!i) return null
    return <>
      <div className="detail-head">
        <span className={`map-row-icon ${i.kind}`}><Icon name={i.kind} /></span>
        <div><h2>{i.title}</h2><p className="muted">{i.location_text} · Updated {timeAgo(i.updated_at)}</p></div>
      </div>
      {i.acres !== undefined && (
        <div className="detail-stats">
          <div><small>AREA</small><strong>{i.acres.toLocaleString()} acres</strong></div>
          <div><small>CONTAINMENT</small><strong>{i.containment !== undefined ? `${i.containment}%` : 'Not reported'}</strong></div>
        </div>
      )}
      <p className="muted">Source: {i.source}</p>
    </>
  }

  if (selection.type === 'shelter') {
    const s = shelters.find(x => x.id === selection.id)
    if (!s) return null
    return <>
      <div className="detail-head">
        <span className={`map-row-icon ${s.status}`}><Icon name="shelter" /></span>
        <div><h2>{s.name}</h2><p className="muted">{s.location_text}</p></div>
      </div>
      <span className={`status-badge ${s.status}`}>{statusLabel[s.status]}</span>
      <p>{s.description}</p>
      {s.status === 'community_submitted' && (
        <p className="detail-warning">Not verified. Confirm with local officials before you travel here.</p>
      )}
      <p className="muted">Source: {s.source} · Updated {timeAgo(s.updated_at)}</p>
    </>
  }

  const z = zones.find(x => x.zone_id === selection.id)
  if (!z) return null
  return <>
    <div className={`zone-box ${z.level}`}>
      <span className="zone-badge">{z.level === 'order' ? 'EVACUATION ORDER' : 'EVACUATION WARNING'}</span>
      <p>{z.instructions}</p>
      <small>Zone {z.zone_id} · Source: {z.source} · {z.issued_at ? `Updated ${timeAgo(z.issued_at)}` : 'Update time not reported'}</small>
    </div>
    <p className="muted">Follow instructions from local officials. In an emergency, call 911.</p>
  </>
}

export function MapPage({ city }: { city: string }) {
  const [tab, setTab] = useState<MapTab>('incidents')
  const [selection, setSelection] = useState<MapSelection | null>(null)
  const { configured } = useCommunitySession()
  const sheltersQuery = useShelters(city)

  // Without Supabase settings, fall back to sample data so the demo still works offline.
  const shelters = configured ? sheltersQuery.data ?? [] : sampleShelters
  const fetchedAt = sheltersQuery.dataUpdatedAt ? clockTime(sheltersQuery.dataUpdatedAt) : null

  const firesQuery = useFireIncidents(city)
  const weatherQuery = useWeatherAlerts(city)
  const zonesQuery = useEvacuationZones(city)
  const perimetersQuery = useFirePerimeters(city)
  const covered = hasLiveCoverage(city)

  // Live mode shows only real data. The sample scenario swaps in demo incidents and zones together,
  // so a sample evacuation zone is never drawn without the sample fire that explains it.
  const [showSample, setShowSample] = useState(false)
  // Uncovered cities have no coordinates, so they use Santa Rosa. Sample data exists for Santa Rosa (fire) and Petaluma (flood).
  const center = cityCenter(covered ? city : 'Santa Rosa')
  const incidents = showSample ? sampleIncidents : firesQuery.data ?? []
  const zoneCollection = showSample ? sampleZones : zonesQuery.data ?? noZones
  const perimeters = showSample ? noPerimeters : perimetersQuery.data ?? noPerimeters
  // Multi-part zones arrive as several features; list each zone once.
  const zones = [...new Map(zoneCollection.features.map(f => [f.properties.zone_id, f.properties])).values()]

  function select(next: MapSelection) {
    setSelection(next)
    setTab(tabFor[next.type])
  }

  function toggleSample() {
    setShowSample(!showSample)
    setSelection(null)
  }

  const isActive = (type: MapSelection['type'], id: string) => selection?.type === type && selection.id === id

  return (
    <div className="map-page">
      <section className="map-area" aria-label="Map">
        <ShelterMap shelters={shelters} incidents={incidents} zones={zoneCollection} perimeters={perimeters} center={center} selection={selection} onSelect={select} />
        {showSample && <p className="sample-banner" role="status">Sample scenario: these incidents and evacuation zones are not real events.</p>}
        <details className="map-legend" open>
          <summary>Legend</summary>
          <span><i className="swatch order" />Evacuation order</span>
          <span><i className="swatch warning" />Evacuation warning</span>
          <span><i className="swatch zone-fire" /><i className="swatch zone-flood" /><i className="swatch zone-quake" />Fire · Flood · Earthquake</span>
          <span><i className="swatch incident" />Incident</span>
          <span><i className="swatch perimeter" />Fire perimeter</span>
          <span><i className="swatch official" />Official shelter</span>
          <span><i className="swatch verified" />Verified shelter</span>
          <span><i className="swatch community" />Community-submitted</span>
        </details>
      </section>

      <aside className="map-panel" aria-label="Map details">
        <button type="button" className={`scenario-toggle${showSample ? ' on' : ''}`} aria-pressed={showSample} onClick={toggleSample}>
          <span className="scenario-switch" aria-hidden="true" />
          <span>
            <strong>Sample scenario {showSample ? 'on' : 'off'}</strong>
            <small>{showSample ? 'Showing demo incidents and evacuation zones' : 'Showing live data only'}</small>
          </span>
        </button>

        <div className="map-tabs" role="tablist" aria-label="Map lists">
          {tabs.map(t => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => { setTab(t.id); setSelection(null) }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {selection && (
          <section className="map-card">
            <button type="button" className="back-link" onClick={() => setSelection(null)}>← Back to list</button>
            <Detail selection={selection} shelters={shelters} incidents={incidents} zones={zones} />
          </section>
        )}

        <section className="map-card">
          {tab === 'incidents' && <>
            <h2>{showSample ? 'Sample incidents' : `Active wildfires near ${city}`}</h2>
            {!showSample && !covered && <p className="muted">{NO_COVERAGE}</p>}
            {!showSample && covered && <>
              {firesQuery.isPending && <p className="muted">Loading wildfire data…</p>}
              {firesQuery.isError && <p role="alert" className="error">Couldn't reach the live wildfire feed. Turn on the sample scenario to see example data.</p>}
              {firesQuery.isSuccess && incidents.length === 0 && (
                <p className="muted">No active wildfires reported within about 65 km. This does not confirm that the area is safe.</p>
              )}
            </>}
            <ul className="map-list">
              {incidents.map(i => (
                <Row key={i.id} icon={i.kind} tone={i.kind} title={i.title}
                  meta={`${i.location_text} · ${timeAgo(i.updated_at)}`}
                  active={isActive('incident', i.id)} onClick={() => select({ type: 'incident', id: i.id })} />
              ))}
            </ul>
            <p className="muted map-source">
              {showSample
                ? 'Sample scenario data. Not real events.'
                : firesQuery.isSuccess ? `Source: NIFC WFIGS · Fetched ${clockTime(firesQuery.dataUpdatedAt)}` : 'Source: NIFC WFIGS'}
            </p>
          </>}

          {tab === 'shelters' && <>
            <h2>Shelters near {city}</h2>
            {configured && sheltersQuery.isPending && <p className="muted">Loading shelters…</p>}
            {configured && sheltersQuery.isError && (
              <div role="alert">
                <p>Couldn't load shelters. Check your connection and try again.</p>
                <button type="button" onClick={() => void sheltersQuery.refetch()}>Try again</button>
              </div>
            )}
            {!(configured && (sheltersQuery.isPending || sheltersQuery.isError)) && shelters.length === 0 && (
              <p className="muted">No shelters listed for {city} yet.</p>
            )}
            <ul className="map-list">
              {shelters.map(s => (
                <Row key={s.id} icon="shelter" tone={s.status} title={s.name}
                  meta={`${statusLabel[s.status]} · ${timeAgo(s.updated_at)}`}
                  active={isActive('shelter', s.id)} onClick={() => select({ type: 'shelter', id: s.id })} />
              ))}
            </ul>
            <p className="muted map-source">
              {configured
                ? `Source: Safety SAM shelter list${fetchedAt ? ` · Fetched ${fetchedAt}` : ''}`
                : 'Sample shelters. Connect Supabase to load live data.'}
            </p>
          </>}

          {tab === 'alerts' && <>
            <h2>Weather alerts</h2>
            {covered ? <>
              {weatherQuery.isPending && <p className="muted">Loading National Weather Service alerts…</p>}
              {weatherQuery.isError && <p role="alert" className="error">Couldn't reach the National Weather Service. Check weather.gov for current alerts.</p>}
              {weatherQuery.isSuccess && weatherQuery.data.length === 0 && <p className="muted">No active weather alerts for {city}.</p>}
            </> : <p className="muted">{NO_COVERAGE} Check weather.gov for alerts in {city}.</p>}
            <ul className="map-list">
              {weatherQuery.data?.map(a => (
                <li key={a.id} className="weather-alert">
                  <strong>{a.event}</strong>
                  <small>{a.severity} · {a.senderName}{a.expires ? ` · Until ${new Date(a.expires).toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' })}` : ''}</small>
                  {a.headline && <p>{a.headline}</p>}
                </li>
              ))}
            </ul>
            {weatherQuery.isSuccess && <p className="muted map-source">Source: National Weather Service · Fetched {clockTime(weatherQuery.dataUpdatedAt)}</p>}

            <h2 className="section-gap">{showSample ? 'Sample evacuation zones' : 'Evacuation zones'}</h2>
            {!showSample && !covered && <p className="muted">{NO_COVERAGE}</p>}
            {!showSample && covered && <>
              {zonesQuery.isPending && <p className="muted">Loading Cal OES evacuation zones…</p>}
              {zonesQuery.isError && <p role="alert" className="error">Couldn't reach Cal OES. Check your county emergency website for current orders and warnings.</p>}
              {zonesQuery.isSuccess && zones.length === 0 && (
                <p className="muted">No active evacuation orders or warnings reported by Cal OES within about 65 km. This does not confirm that the area is safe.</p>
              )}
            </>}
            <ul className="map-list">
              {zones.map(z => (
                <Row key={z.zone_id} icon="alert" tone={z.level}
                  title={`${z.level === 'order' ? 'Evacuation order' : 'Evacuation warning'} · Zone ${z.zone_id}`}
                  meta={`${z.source} · ${z.issued_at ? `updated ${timeAgo(z.issued_at)}` : 'update time not reported'}`}
                  active={isActive('zone', z.zone_id)} onClick={() => select({ type: 'zone', id: z.zone_id })} />
              ))}
            </ul>
            <p className="muted map-source">
              {showSample
                ? 'Sample scenario data. Not real events.'
                : `Source: Cal OES California Active Evacuation Zones${zonesQuery.isSuccess ? ` · Fetched ${clockTime(zonesQuery.dataUpdatedAt)}` : ''}`}
            </p>
          </>}
        </section>
      </aside>
    </div>
  )
}