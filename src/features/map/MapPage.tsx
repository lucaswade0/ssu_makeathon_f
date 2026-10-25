import { useState } from 'react'
import { List, Map as MapIcon, SlidersHorizontal, X } from 'lucide-react'
import { useSimulation } from '../simulation/context'
import { SIM_CITY } from '../simulation/scenario'
import { useCommunitySession } from '../community/session'
import { cityCenter, clockTime, hasLiveCoverage, noPerimeters, useEarthquakes, useEvacuationZones, useFireIncidents, useFirePerimeters, useShakeMaps, useWeatherAlerts } from '../hazards/liveHazards'
import { Icon, ShelterMap } from '../shelters/ShelterMap'
import { useResources } from '../resources/hooks'
import { useI18n } from '../i18n/context'
import { dateLocale } from '../i18n/languages'
import { sourceLabel } from '../i18n/sourceLabel'
import type { MessageKey } from '../i18n/messages'
import { resourceToShelter, sampleResources } from '../resources/sampleData'
import { timeAgo as relativeTime } from '../resources/format'
import { allShown, hazardFilters, weatherAlertShown, zoneShown, type HazardFilter, type ShownHazards } from './hazardFilters'
import { noShakeMaps, noZones, type Incident, type MapSelection, type Shelter, type ZoneProperties } from './sampleData'

type MapTab = 'incidents' | 'shelters' | 'alerts'

const tabs: { id: MapTab; label: MessageKey }[] = [
  { id: 'incidents', label: 'map.tab.incidents' },
  { id: 'shelters', label: 'map.tab.resources' },
  { id: 'alerts', label: 'map.tab.alerts' },
]

const tabFor: Record<MapSelection['type'], MapTab> = { incident: 'incidents', shelter: 'shelters', zone: 'alerts' }

// Phones get Watch Duty-style map controls; desktop keeps the side panel and open legend.
const isPhone = () => typeof window !== 'undefined' && Boolean(window.matchMedia?.('(max-width: 720px)').matches)

// "9 h ago" in the reader's language.
function useAgo() {
  const { lang } = useI18n()
  return (iso: string) => relativeTime(iso, Date.now(), dateLocale(lang))
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
  const { t, lang } = useI18n()
  const timeAgo = useAgo()
  if (selection.type === 'incident') {
    const i = incidents.find(x => x.id === selection.id)
    if (!i) return null
    return <>
      <div className="detail-head">
        <span className={`map-row-icon ${i.kind}`}><Icon name={i.kind} /></span>
        <div><h2>{i.title}</h2><p className="muted">{i.location_text} · {t('map.updated', { time: timeAgo(i.updated_at) })}</p></div>
      </div>
      {i.acres !== undefined && (
        <div className="detail-stats">
          <div><small>{t('map.area')}</small><strong>{t('map.acres', { n: i.acres.toLocaleString(dateLocale(lang)) })}</strong></div>
          <div><small>{t('map.containment')}</small><strong>{i.containment !== undefined ? `${i.containment}%` : t('map.notReported')}</strong></div>
        </div>
      )}
      <p className="muted">{t('map.source', { source: sourceLabel(i.source, t) })}</p>
    </>
  }

  if (selection.type === 'shelter') {
    const s = shelters.find(x => x.id === selection.id)
    if (!s) return null
    return <>
      <div className="detail-head">
        <span className={`map-row-icon ${s.status}`}><Icon name={s.category ?? 'shelter'} /></span>
        <div><h2>{s.name}</h2><p className="muted">{t(`category.${s.category ?? 'shelter'}`)} · {s.location_text}</p></div>
      </div>
      <span className={`status-badge ${s.status}`}>{t(`status.${s.status}`)}</span>
      <p>{s.description}</p>
      {s.status === 'community_submitted' && (
        <p className="detail-warning">{t('map.notVerified')}</p>
      )}
      <p className="muted">{t('map.sourceUpdated', { source: sourceLabel(s.source, t), time: timeAgo(s.updated_at) })}</p>
    </>
  }

  const z = zones.find(x => x.zone_id === selection.id)
  if (!z) return null
  return <>
    <div className={`zone-box ${z.level}`}>
      <span className="zone-badge">{z.level === 'order' ? t('map.zoneOrder') : t('map.zoneWarning')}</span>
      <p>{z.instructions}</p>
      <small>{t('map.zoneLine', { id: z.zone_id, source: sourceLabel(z.source, t), when: z.issued_at ? t('map.updated', { time: timeAgo(z.issued_at) }) : t('map.updateUnknown') })}</small>
    </div>
    <p className="muted">{t('news.safetyNote')}</p>
  </>
}

export function MapPage({ city }: { city: string }) {
  const { t, lang } = useI18n()
  const timeAgo = useAgo()
  const [tab, setTab] = useState<MapTab>('incidents')
  const [selection, setSelection] = useState<MapSelection | null>(null)
  // Phone-only overlays. The CSS ignores panelOpen and filtersOpen on desktop.
  const [panelOpen, setPanelOpen] = useState(false)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [legendOpen, setLegendOpen] = useState(() => !isPhone())
  const { configured } = useCommunitySession()
  const resourcesQuery = useResources(city)

  // Without Supabase settings, fall back to sample data so the demo still works offline.
  const fetchedAt = resourcesQuery.dataUpdatedAt ? clockTime(resourcesQuery.dataUpdatedAt) : null

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
  // Every resource category gets a pin, not only shelters. Live data shares one query with the Resources page.
  const shelters = (showSample ? sim.state?.resources ?? [] : configured ? resourcesQuery.data ?? [] : sampleResources).map(resourceToShelter)
  // Uncovered cities have no coordinates, so they use Santa Rosa. Sample data exists for Santa Rosa (fire) and Petaluma (flood).
  const center = cityCenter(showSample ? SIM_CITY : covered ? city : 'Santa Rosa')
  const [shown, setShown] = useState<ShownHazards>(allShown)
  const hiddenLabels = hazardFilters.filter(f => !shown[f.id]).map(f => t(`map.hazard.${f.id}`))
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
    setPanelOpen(true)
  }

  function toggleHazard(id: HazardFilter) {
    setShown({ ...shown, [id]: !shown[id] })
    setSelection(null)
  }

  const isActive = (type: MapSelection['type'], id: string) => selection?.type === type && selection.id === id

  // Rendered in the side panel on desktop and as a card over the map on phones; CSS shows one of them.
  const filters = (
    <fieldset className="hazard-filters">
      <legend>{t('map.show')}</legend>
      {hazardFilters.map(f => (
        <button key={f.id} type="button" className={`hazard-chip ${f.id}${shown[f.id] ? ' on' : ''}`} aria-pressed={shown[f.id]} onClick={() => toggleHazard(f.id)}>
          <span className="hazard-switch" aria-hidden="true" />
          <Icon name={f.id} size={16} />
          {t(`map.hazard.${f.id}`)}
        </button>
      ))}
      {hiddenLabels.length > 0 && <p className="muted">{t('map.hidden', { list: hiddenLabels.join(', ') })}</p>}
    </fieldset>
  )

  return (
    <div className={`map-page${panelOpen ? ' panel-open' : ''}`}>
      <section className="map-area" aria-label={t('nav.map')}>
        <ShelterMap shelters={shelters} incidents={incidents} zones={zoneCollection} perimeters={perimeters} shakeMaps={shakeMaps} center={center} selection={selection} onSelect={select} />
        {showSample && <p className="sample-banner" role="status">{t('map.simBanner')}</p>}
        <button type="button" className="map-fab map-menu" aria-label={t('map.openList')} aria-controls="map-panel" aria-expanded={panelOpen} onClick={() => setPanelOpen(true)}>
          <List size={22} aria-hidden="true" />
        </button>
        <div className="map-fab-stack">
          <button type="button" className="map-fab" aria-expanded={filtersOpen} onClick={() => { setFiltersOpen(!filtersOpen); setLegendOpen(false) }}>
            <SlidersHorizontal size={20} aria-hidden="true" /><span>{t('map.filters')}</span>
          </button>
          <button type="button" className="map-fab" aria-expanded={legendOpen} onClick={() => { setLegendOpen(!legendOpen); setFiltersOpen(false) }}>
            <MapIcon size={20} aria-hidden="true" /><span>{t('map.legend')}</span>
          </button>
        </div>
        {filtersOpen && <div className="map-pop map-filters-pop">{filters}</div>}
        {/* Starts collapsed on phones, where the open legend covers half the map; there the Legend button opens it. */}
        <details className="map-legend" open={legendOpen} onToggle={e => setLegendOpen(e.currentTarget.open)}>
          <summary>{t('map.legend')}</summary>
          <span><i className="swatch order" />{t('map.leg.order')}</span>
          <span><i className="swatch warning" />{t('map.leg.warning')}</span>
          <span><i className="swatch zone-fire" /><i className="swatch zone-flood" /><i className="swatch zone-quake" />{t('map.leg.zones')}</span>
          <span><i className="swatch incident" />{t('map.leg.incident')}</span>
          <span><i className="swatch perimeter" />{t('map.leg.perimeter')}</span>
          <span><i className="swatch shaking" />{t('map.leg.shaking')}</span>
          <span><i className="swatch official" />{t('map.leg.official')}</span>
          <span><i className="swatch verified" />{t('map.leg.verified')}</span>
          <span><i className="swatch community" />{t('map.leg.community')}</span>
        </details>
      </section>

      {panelOpen && <button type="button" className="map-scrim" aria-label={t('map.closeList')} onClick={() => setPanelOpen(false)} />}
      <aside id="map-panel" className="map-panel" aria-label={t('map.details')} onKeyDown={e => { if (e.key === 'Escape') setPanelOpen(false) }}>
        <button type="button" className="map-panel-close" onClick={() => setPanelOpen(false)}>
          <X size={20} aria-hidden="true" />{t('map.closeList')}
        </button>
        {filters}

        <div className="map-tabs" role="tablist" aria-label={t('map.lists')}>
          {tabs.map(item => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={tab === item.id}
              onClick={() => { setTab(item.id); setSelection(null) }}
            >
              {t(item.label)}
            </button>
          ))}
        </div>

        {selection && (
          <section className="map-card">
            <button type="button" className="back-link" onClick={() => setSelection(null)}>{t('map.back')}</button>
            <Detail selection={selection} shelters={shelters} incidents={incidents} zones={zones} />
          </section>
        )}

        <section className="map-card">
          {tab === 'incidents' && <>
            <h2>{showSample ? t('map.incidentsSim') : t('map.incidentsNear', { city })}</h2>
            {!showSample && !covered && <p className="muted">{t('feed.noCoverage')}</p>}
            {!showSample && covered && <>
              {(firesQuery.isPending || quakesQuery.isPending) && <p className="muted">{t('map.loadingIncidents')}</p>}
              {firesQuery.isError && <p role="alert" className="error">{t('map.fireFeedFailed')}</p>}
              {quakesQuery.isError && <p role="alert" className="error">{t('map.quakeFeedFailed')}</p>}
              {firesQuery.isSuccess && quakesQuery.isSuccess && allIncidents.length === 0 && (
                <p className="muted">{t('map.noIncidents')}</p>
              )}
            </>}
            {allIncidents.length > 0 && incidents.length === 0 && <p className="muted">{t('map.incidentsHidden')}</p>}
            <ul className="map-list">
              {incidents.map(i => (
                <Row key={i.id} icon={i.kind} tone={i.kind} title={i.title}
                  meta={`${i.location_text} · ${timeAgo(i.updated_at)}`}
                  active={isActive('incident', i.id)} onClick={() => select({ type: 'incident', id: i.id })} />
              ))}
            </ul>
            <p className="muted map-source">
              {showSample
                ? t('map.simData')
                : `${t('map.incidentSources')}${firesQuery.isSuccess ? t('map.fetched', { time: clockTime(firesQuery.dataUpdatedAt) }) : ''}`}
            </p>
          </>}

          {tab === 'shelters' && <>
            <h2>{showSample ? t('resources.simTitle') : t('map.resNear', { city })}</h2>
            {liveShelters && resourcesQuery.isPending && <p className="muted">{t('resources.loading')}</p>}
            {liveShelters && resourcesQuery.isError && (
              <div role="alert">
                <p>{t('map.resFailed')}</p>
                <button type="button" onClick={() => void resourcesQuery.refetch()}>{t('resources.tryAgain')}</button>
              </div>
            )}
            {!(liveShelters && (resourcesQuery.isPending || resourcesQuery.isError)) && shelters.length === 0 && (
              <p className="muted">{showSample ? t('map.noResSim') : t('map.noRes', { city })}</p>
            )}
            <ul className="map-list">
              {shelters.map(s => (
                <Row key={s.id} icon={s.category ?? 'shelter'} tone={s.status} title={s.name}
                  meta={`${t(`category.${s.category ?? 'shelter'}`)} · ${t(`status.${s.status}`)} · ${timeAgo(s.updated_at)}`}
                  active={isActive('shelter', s.id)} onClick={() => select({ type: 'shelter', id: s.id })} />
              ))}
            </ul>
            <p className="muted map-source">
              {showSample
                ? t('map.simDataRes')
                : configured
                ? `${t('map.resSource')}${fetchedAt ? t('map.fetched', { time: fetchedAt }) : ''}`
                : t('resources.sampleNotice')}
            </p>
          </>}

          {tab === 'alerts' && <>
            <h2>{t('map.weatherAlerts')}</h2>
            {covered ? <>
              {weatherQuery.isPending && <p className="muted">{t('map.loadingNws')}</p>}
              {weatherQuery.isError && <p role="alert" className="error">{t('map.nwsFailed')}</p>}
              {weatherQuery.isSuccess && weatherQuery.data.length === 0 && <p className="muted">{t('map.noWeather', { city })}</p>}
              {weatherQuery.isSuccess && weatherQuery.data.length > 0 && weatherAlerts?.length === 0 && <p className="muted">{t('map.weatherHidden')}</p>}
            </> : <p className="muted">{t('feed.noCoverage')} {t('map.checkWeather', { city })}</p>}
            <ul className="map-list">
              {weatherAlerts?.map(a => (
                <li key={a.id} className="weather-alert">
                  <strong>{a.event}</strong>
                  <small>{a.severity} · {a.senderName}{a.expires ? ` · ${t('map.until', { time: new Date(a.expires).toLocaleString(dateLocale(lang) ?? [], { weekday: 'short', hour: 'numeric', minute: '2-digit' }) })}` : ''}</small>
                  {a.headline && <p>{a.headline}</p>}
                </li>
              ))}
            </ul>
            {weatherQuery.isSuccess && <p className="muted map-source">{t('map.nwsSource')}{t('map.fetched', { time: clockTime(weatherQuery.dataUpdatedAt) })}</p>}

            <h2 className="section-gap">{showSample ? t('map.zonesSim') : t('map.zones')}</h2>
            {!showSample && !covered && <p className="muted">{t('feed.noCoverage')}</p>}
            {!showSample && covered && <>
              {zonesQuery.isPending && <p className="muted">{t('map.loadingZones')}</p>}
              {zonesQuery.isError && <p role="alert" className="error">{t('map.zonesFailed')}</p>}
              {zonesQuery.isSuccess && allZones.features.length === 0 && (
                <p className="muted">{t('map.noZones')}</p>
              )}
            </>}
            <ul className="map-list">
              {zones.map(z => (
                <Row key={z.zone_id} icon="alert" tone={z.level}
                  title={z.level === 'order' ? t('map.zoneTitle.order', { id: z.zone_id }) : t('map.zoneTitle.warning', { id: z.zone_id })}
                  meta={`${sourceLabel(z.source, t)} · ${z.issued_at ? t('map.updatedLower', { time: timeAgo(z.issued_at) }) : t('map.updateUnknownLower')}`}
                  active={isActive('zone', z.zone_id)} onClick={() => select({ type: 'zone', id: z.zone_id })} />
              ))}
            </ul>
            <p className="muted map-source">
              {showSample
                ? t('map.simData')
                : `${t('map.zonesSource')}${zonesQuery.isSuccess ? t('map.fetched', { time: clockTime(zonesQuery.dataUpdatedAt) }) : ''}`}
            </p>
          </>}
        </section>
      </aside>
    </div>
  )
}