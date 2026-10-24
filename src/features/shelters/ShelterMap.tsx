import Map, { Layer, Marker, NavigationControl, Source, type MapRef } from 'react-map-gl/maplibre'
import 'maplibre-gl/dist/maplibre-gl.css'
import { useEffect, useRef } from 'react'
import { setWorkerUrl } from 'maplibre-gl'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url'
import { Droplets, Flame, Tent, ThermometerSun, TriangleAlert, type LucideIcon } from 'lucide-react'
import { sampleIncidents, sampleZones, type MapSelection, type Shelter } from '../map/sampleData'

// Vites dev bundling breaks MapLibre's default worker path, so point it at the file directly.
setWorkerUrl(workerUrl)

const loadedAt = new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })

const icons: Record<'fire' | 'flood' | 'heat' | 'shelter' | 'alert', LucideIcon> = {
  fire: Flame,
  flood: Droplets,
  heat: ThermometerSun,
  shelter: Tent,
  alert: TriangleAlert,
}

export function Icon({ name, size = 20 }: { name: keyof typeof icons; size?: number }) {
  const Glyph = icons[name]
  return <Glyph size={size} aria-hidden="true" />
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
      attributionControl={{ compact: true, customAttribution: `Sample public data · Fetched ${loadedAt}` }}
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
            'fill-color': ['match', ['get', 'level'], 'order', '#B42318', '#D97706'],
            'fill-opacity': ['match', ['get', 'level'], 'order', 0.3, 0.2],
          }}
        />
        <Layer
          id="zone-warning-line"
          type="line"
          filter={['==', ['get', 'level'], 'warning']}
          paint={{ 'line-color': '#B45309', 'line-width': 2.5, 'line-dasharray': [3, 2] }}
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