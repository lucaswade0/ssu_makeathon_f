import Map, { Layer, Marker, NavigationControl, Source, type MapRef } from 'react-map-gl/maplibre'
import 'maplibre-gl/dist/maplibre-gl.css'
import { useEffect, useRef } from 'react'
import { setWorkerUrl } from 'maplibre-gl'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url'
import { sampleIncidents, sampleZones, type MapSelection, type Shelter } from '../map/sampleData'

// Vite's dev bundling breaks MapLibre's default worker path, so point it at the file directly.
setWorkerUrl(workerUrl)

const loadedAt = new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })

const icons = {
  fire: <path d="M12 3c1 3 5 5 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-5 1-9z" />,
  flood: <path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z" />,
  heat: <><circle cx="12" cy="12" r="4" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2" /></>,
  shelter: <path d="M3 12l9-8 9 8v9H3z" />,
  alert: <path d="M12 4 2 20h20zM12 10v4M12 17v.01" />,
}

export function Icon({ name }: { name: keyof typeof icons }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {icons[name]}
    </svg>
  )
}

type Props = {
  shelters: Shelter[]
  selection: MapSelection | null
  onSelect: (selection: MapSelection) => void
}

export function ShelterMap({  shelters, selection, onSelect }: Props) {
  const mapRef = useRef<MapRef>(null)

  // Move the camera whenever the selection changes, whether it came from the map or the side panel.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !selection) return
    if (selection.type === 'zone') {
      const zone = sampleZones.features.find(f => f.properties.zone_id === selection.id)
      if (!zone) return
      const ring = zone.geometry.coordinates[0]
      const lngs = ring.map(p => p[0])
      const lats = ring.map(p => p[1])
      map.fitBounds([[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]], { padding: 60 })
      return
    }
    const item = selection.type === 'incident'
      ? sampleIncidents.find(i => i.id === selection.id)
      : shelters.find(s => s.id === selection.id)
    if (item) map.flyTo({ center: [item.longitude, item.latitude], zoom: 14 })
  }, [selection, shelters])

  const isSelected = (type: MapSelection['type'], id: string) => selection?.type === type && selection.id === id

  return (
    <Map
      ref={mapRef}
      initialViewState={{ latitude: 38.455, longitude: -122.71, zoom: 12 }}
      style={{ width: '100%', height: '100%' }}
      mapStyle="https://tiles.openfreemap.org/styles/positron"
      attributionControl={{ customAttribution: `Sample public data · Fetched ${loadedAt}` }}
      interactiveLayerIds={['zone-fill']}
      onClick={e => {
        const zoneId = e.features?.[0]?.properties?.zone_id
        if (zoneId) onSelect({ type: 'zone', id: zoneId })
      }}
    >
      <NavigationControl position="top-right" />

      <Source id="zones" type="geojson" data={sampleZones}>
        <Layer
          id="zone-fill"
          type="fill"
          paint={{
            'fill-color': ['match', ['get', 'level'], 'order', '#B42318', '#F7B91F'],
            'fill-opacity': ['match', ['get', 'level'], 'order', 0.3, 0.22],
          }}
        />
        <Layer
          id="zone-warning-line"
          type="line"
          filter={['==', ['get', 'level'], 'warning']}
          paint={{ 'line-color': '#9A6B00', 'line-width': 2.5, 'line-dasharray': [3, 2] }}
        />
        <Layer
          id="zone-order-line"
          type="line"
          filter={['==', ['get', 'level'], 'order']}
          paint={{ 'line-color': '#B42318', 'line-width': 2.5 }}
        />
      </Source>

      {sampleIncidents.map(i => (
        <Marker key={i.id} latitude={i.latitude} longitude={i.longitude}
          onClick={e => { e.originalEvent.stopPropagation(); onSelect({ type: 'incident', id: i.id }) }}>
          <button type="button" className={`map-marker incident ${i.kind}${isSelected('incident', i.id) ? ' selected' : ''}`} aria-label={i.title}>
            <Icon name={i.kind} />
          </button>
        </Marker>
      ))}

      {shelters.map(s => (
        <Marker key={s.id} latitude={s.latitude} longitude={s.longitude}
          onClick={e => { e.originalEvent.stopPropagation(); onSelect({ type: 'shelter', id: s.id }) }}>
          <button type="button" className={`map-marker shelter ${s.status}${isSelected('shelter', s.id) ? ' selected' : ''}`} aria-label={`${s.name} (${s.status.replace('_', ' ')})`}>
            <Icon name="shelter" />
          </button>
        </Marker>
      ))}
    </Map>
  )
}