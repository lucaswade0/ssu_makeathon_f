import { useState } from 'react'
import { ShelterMap } from '../shelters/ShelterMap'

type MapTab = 'incidents' | 'shelters' | 'alerts'

const tabs: { id: MapTab; label: string }[] = [
  { id: 'incidents', label: 'Incidents' },
  { id: 'shelters', label: 'Shelters' },
  { id: 'alerts', label: 'Alerts' },
]

export function MapPage() {
  const [tab, setTab] = useState<MapTab>('incidents')
  const active = tabs.find(t => t.id === tab)!

  return (
    <div className="map-page">
      <section className="map-area" aria-label="Map">
        <ShelterMap />
      </section>

      <aside className="map-panel" aria-label="Map details">
        <div className="map-tabs" role="tablist" aria-label="Map lists">
          {tabs.map(t => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        <section className="map-card">
          <h2>{active.label}</h2>
          <p className="muted">Select an item on the map or in the list to see details.</p>
        </section>
      </aside>
    </div>
  )
}