import { useState } from 'react'
import { useSimulation } from '../simulation/context'
import { SIM_CITY } from '../simulation/scenario'
import { useCommunitySession } from '../community/session'
import { cityCenter, clockTime, hasLiveCoverage, NO_COVERAGE, noPerimeters, useEarthquakes, useEvacuationZones, useFireIncidents, useFirePerimeters, useShakeMaps, useWeatherAlerts } from '../hazards/liveHazards'
import { Icon, ShelterMap } from '../shelters/ShelterMap'
import { useShelters } from '../shelters/useShelters'
import { allShown, hazardFilters, weatherAlertShown, zoneShown, type HazardFilter, type ShownHazards } from './hazardFilters'
import { noShakeMaps, noZones, sampleShelters, type Incident, type MapSelection, type Shelter, type ZoneProperties } from './sampleData'

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
  const fetchedAt = sheltersQuery.dataUpdatedAt ? clockTime(sheltersQuery.dataUpdatedAt) : null

  const firesQuery = useFireIncidents(city)
  const quakesQuery = useEarthquakes(city)
  const weatherQuery = useWeatherAlerts(city)
  const zonesQuery = useEvacuationZones(city)
  const perimetersQuery = useFirePerimeters(city)
  const shakeMapsQuery = useShakeMaps(city)
  const covered = hasLiveCoverage(city)

  // Live mode shows only real data. The sample scenario swaps in demo incidents and zones together,
  // so a sample evacuation zone is never drawn without the sample fire that explains it.
  const sim = useSimulation()
  const showSample = sim.active
  const liveShelters = configured && !showSample
  const shelters = showSample ? sim.state?.shelters ?? [] : configured ? sheltersQuery.data ?? [] : sampleShelters
  // Uncovered cities have no coordinates, so they use Santa Rosa. Sample data exists for Santa Rosa (fire) and Petaluma (flood).
  const center = cityCenter(showSample ? SIM_CITY : covered ? city : 'Santa Rosa')
  const [shown, setShown] = useState<ShownHazards>(allShown)
  const hiddenLabels = hazardFilters.filter(f => !shown[f.id]).map(f => f.label)
  const allIncidents = showSample ? sim.state?.incidents ?? [] : [...firesQuery.data ?? [], ...quakesQuery.data ?? []]
  const incidents = allIncidents.filter(i => shown[i.kind])
  const allZones = showSample ? sim.state?.zones ?? noZones : zonesQuery.data ?? noZones
  const zoneCollection = { ...allZones, features: allZones.features.filter(f => zoneShown(f.properties.hazard, shown)) }
  const perimeters = !shown.fire || showSample ? noPerimeters : perimetersQuery.data ?? noPerimeters
  const shakeMaps = !shown.earthquake || showSample ? noShakeMaps : shakeMapsQuery.data ?? noShakeMaps
  const weatherAlerts = weatherQuery.data?.filter(a => weatherAlertShown(a.event, shown))
  // Multi-part zones arrive as several features; list each zone once.
  const zones = [...new Map(zoneCollection.features.map(f => [f.properties.zone_id, f.properties])).values()]

  function select(next: MapSelection) {
    setSelection(next)
    setTab(tabFor[next.type])
  }

  function toggleHazard(id: HazardFilter) {
    setShown({ ...shown, [id]: !shown[id] })
    setSelection(null)
  }

  const isActive = (type: MapSelection['type'], id: string) => selection?.type === type && selection.id === id

  return (
    <div className="map-page">
      <section className="map-area" aria-label="Map">
        <ShelterMap shelters={shelters} incidents={incidents} zones={zoneCollection} perimeters={perimeters} shakeMaps={shakeMaps} center={center} selection={selection} onSelect={select} />
        {showSample && <p className="sample-banner" role="status">Simulation: these incidents and evacuation zones are sample data, not real events.</p>}
        <details className="map-legend" open>
          <summary>Legend</summary>
          <span><i className="swatch order" />Evacuation order</span>
          <span><i className="swatch warning" />Evacuation warning</span>
          <span><i className="swatch zone-fire" /><i className="swatch zone-flood" /><i className="swatch zone-quake" />Fire · Flood · Earthquake</span>
          <span><i className="swatch incident" />Incident</span>
          <span><i className="swatch perimeter" />Fire perimeter</span>
          <span><i className="swatch shaking" />Earthquake shaking rings</span>
          <span><i className="swatch official" />Official shelter</span>
          <span><i className="swatch verified" />Verified shelter</span>
          <span><i className="swatch community" />Community-submitted</span>
        </details>
      </section>

      <aside className="map-panel" aria-label="Map details">
        <fieldset className="hazard-filters">
          <legend>Show on map</legend>
          {hazardFilters.map(f => (
            <button key={f.id} type="button" className={`hazard-chip ${f.id}${shown[f.id] ? ' on' : ''}`} aria-pressed={shown[f.id]} onClick={() => toggleHazard(f.id)}>
              <span className="hazard-switch" aria-hidden="true" />
              <Icon name={f.id} size={16} />
              {f.label}
            </button>
          ))}
          {hiddenLabels.length > 0 && <p className="muted">Hidden: {hiddenLabels.join(', ')}. Evacuation zones of unknown type always show.</p>}
        </fieldset>

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
            <h2>{showSample ? 'Simulated incidents' : `Incidents near ${city}`}</h2>
            {!showSample && !covered && <p className="muted">{NO_COVERAGE}</p>}
            {!showSample && covered && <>
              {(firesQuery.isPending || quakesQuery.isPending) && <p className="muted">Loading wildfire and earthquake data…</p>}
              {firesQuery.isError && <p role="alert" className="error">Couldn't reach the live wildfire feed.</p>}
              {quakesQuery.isError && <p role="alert" className="error">Couldn't reach the USGS earthquake feed.</p>}
              {firesQuery.isSuccess && quakesQuery.isSuccess && allIncidents.length === 0 && (
                <p className="muted">No active wildfires or M2.5+ earthquakes in the past week within about 65 km. This does not confirm that the area is safe.</p>
              )}
            </>}
            {allIncidents.length > 0 && incidents.length === 0 && <p className="muted">All incidents here are hidden by the filters above.</p>}
            <ul className="map-list">
              {incidents.map(i => (
                <Row key={i.id} icon={i.kind} tone={i.kind} title={i.title}
                  meta={`${i.location_text} · ${timeAgo(i.updated_at)}`}
                  active={isActive('incident', i.id)} onClick={() => select({ type: 'incident', id: i.id })} />
              ))}
            </ul>
            <p className="muted map-source">
              {showSample
                ? 'Simulation data. Not real events.'
                : `Sources: NIFC WFIGS (wildfires), USGS (earthquakes, M2.5+ past 7 days)${firesQuery.isSuccess ? ` · Fetched ${clockTime(firesQuery.dataUpdatedAt)}` : ''}`}
            </p>
          </>}

          {tab === 'shelters' && <>
            <h2>{showSample ? 'Simulated shelters' : `Shelters near ${city}`}</h2>
            {liveShelters && sheltersQuery.isPending && <p className="muted">Loading shelters…</p>}
            {liveShelters && sheltersQuery.isError && (
              <div role="alert">
                <p>Couldn't load shelters. Check your connection and try again.</p>
                <button type="button" onClick={() => void sheltersQuery.refetch()}>Try again</button>
              </div>
            )}
            {!(liveShelters && (sheltersQuery.isPending || sheltersQuery.isError)) && shelters.length === 0 && (
              <p className="muted">{showSample ? 'No shelters have opened yet in this simulation step.' : `No shelters listed for ${city} yet.`}</p>
            )}
            <ul className="map-list">
              {shelters.map(s => (
                <Row key={s.id} icon="shelter" tone={s.status} title={s.name}
                  meta={`${statusLabel[s.status]} · ${timeAgo(s.updated_at)}`}
                  active={isActive('shelter', s.id)} onClick={() => select({ type: 'shelter', id: s.id })} />
              ))}
            </ul>
            <p className="muted map-source">
              {showSample
                ? 'Simulation data. Not real shelters.'
                : configured
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
              {weatherQuery.isSuccess && weatherQuery.data.length > 0 && weatherAlerts?.length === 0 && <p className="muted">All weather alerts here are hidden by the filters above.</p>}
            </> : <p className="muted">{NO_COVERAGE} Check weather.gov for alerts in {city}.</p>}
            <ul className="map-list">
              {weatherAlerts?.map(a => (
                <li key={a.id} className="weather-alert">
                  <strong>{a.event}</strong>
                  <small>{a.severity} · {a.senderName}{a.expires ? ` · Until ${new Date(a.expires).toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' })}` : ''}</small>
                  {a.headline && <p>{a.headline}</p>}
                </li>
              ))}
            </ul>
            {weatherQuery.isSuccess && <p className="muted map-source">Source: National Weather Service · Fetched {clockTime(weatherQuery.dataUpdatedAt)}</p>}

            <h2 className="section-gap">{showSample ? 'Simulated evacuation zones' : 'Evacuation zones'}</h2>
            {!showSample && !covered && <p className="muted">{NO_COVERAGE}</p>}
            {!showSample && covered && <>
              {zonesQuery.isPending && <p className="muted">Loading Cal OES evacuation zones…</p>}
              {zonesQuery.isError && <p role="alert" className="error">Couldn't reach Cal OES. Check your county emergency website for current orders and warnings.</p>}
              {zonesQuery.isSuccess && allZones.features.length === 0 && (
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
                ? 'Simulation data. Not real events.'
                : `Source: Cal OES California Active Evacuation Zones${zonesQuery.isSuccess ? ` · Fetched ${clockTime(zonesQuery.dataUpdatedAt)}` : ''}`}
            </p>
          </>}
        </section>
      </aside>
    </div>
  )
}