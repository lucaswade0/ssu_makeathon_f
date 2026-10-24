import { useState } from 'react'
import { useCommunitySession } from '../community/session'
import { Icon, ShelterMap } from '../shelters/ShelterMap'
import { useShelters } from '../shelters/useShelters'
import { sampleIncidents, sampleShelters, sampleZones, type MapSelection, type Shelter } from './sampleData'

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

const zones = sampleZones.features.map(f => f.properties)

function timeAgo(iso: string) {
  const minutes = Math.round((Date.now() - Date.parse(iso)) / 60_000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes} min ago`
  return `${Math.round(minutes / 60)} h ago`
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

function Detail({ selection, shelters }: { selection: MapSelection; shelters: Shelter[] }) {
  if (selection.type === 'incident') {
    const i = sampleIncidents.find(x => x.id === selection.id)
    if (!i) return null
    return <>
      <div className="detail-head">
        <span className={`map-row-icon ${i.kind}`}><Icon name={i.kind} /></span>
        <div><h2>{i.title}</h2><p className="muted">{i.location_text} · Updated {timeAgo(i.updated_at)}</p></div>
      </div>
      {i.acres !== undefined && (
        <div className="detail-stats">
          <div><small>AREA</small><strong>{i.acres.toLocaleString()} acres</strong></div>
          <div><small>CONTAINMENT</small><strong>{i.containment ?? 0}%</strong></div>
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
      <small>Zone {z.zone_id} · Source: {z.source} · Issued {timeAgo(z.issued_at)}</small>
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
  const fetchedAt = sheltersQuery.dataUpdatedAt
    ? new Date(sheltersQuery.dataUpdatedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    : null

  function select(next: MapSelection) {
    setSelection(next)
    setTab(tabFor[next.type])
  }

  const isActive = (type: MapSelection['type'], id: string) => selection?.type === type && selection.id === id

  return (
    <div className="map-page">
      <section className="map-area" aria-label="Map">
        <ShelterMap shelters={shelters} selection={selection} onSelect={select} />
        <div className="map-legend">
          <strong>Legend</strong>
          <span><i className="swatch order" />Evacuation order</span>
          <span><i className="swatch warning" />Evacuation warning</span>
          <span><i className="swatch incident" />Incident</span>
          <span><i className="swatch official" />Official shelter</span>
          <span><i className="swatch verified" />Verified shelter</span>
          <span><i className="swatch community" />Community-submitted</span>
        </div>
      </section>

      <aside className="map-panel" aria-label="Map details">
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
            <Detail selection={selection} shelters={shelters} />
          </section>
        )}

        <section className="map-card">
          {tab === 'incidents' && <>
            <h2>All incidents near {city}</h2>
            <ul className="map-list">
              {sampleIncidents.map(i => (
                <Row key={i.id} icon={i.kind} tone={i.kind} title={i.title}
                  meta={`${i.location_text} · ${timeAgo(i.updated_at)}`}
                  active={isActive('incident', i.id)} onClick={() => select({ type: 'incident', id: i.id })} />
              ))}
            </ul>
            <p className="muted map-source">Sample public data. Not an official emergency service.</p>
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
            <h2>Evacuation zones</h2>
            <ul className="map-list">
              {zones.map(z => (
                <Row key={z.zone_id} icon="alert" tone={z.level}
                  title={`${z.level === 'order' ? 'Evacuation order' : 'Evacuation warning'} · Zone ${z.zone_id}`}
                  meta={`${z.source} · ${timeAgo(z.issued_at)}`}
                  active={isActive('zone', z.zone_id)} onClick={() => select({ type: 'zone', id: z.zone_id })} />
              ))}
            </ul>
            <p className="muted map-source">Sample public data. Not an official emergency service.</p>
          </>}
        </section>
      </aside>
    </div>
  )
}