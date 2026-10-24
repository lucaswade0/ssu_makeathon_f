import Map, { Layer, Marker, NavigationControl, Source, type MapRef } from 'react-map-gl/maplibre'
import type { ExpressionSpecification } from '@maplibre/maplibre-gl-style-spec'
import 'maplibre-gl/dist/maplibre-gl.css'
import { useEffect, useRef } from 'react'
import { setWorkerUrl } from 'maplibre-gl'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url'
import { Activity, BatteryCharging, Bus, Droplets, Flame, HeartPulse, PawPrint, Tent, ThermometerSun, TriangleAlert, Utensils, type LucideIcon } from 'lucide-react'
import type { PerimeterCollection } from '../hazards/liveHazards'
import type { Incident, MapResourceCategory, MapSelection, ShakeMapCollection, Shelter, ZoneCollection } from '../map/sampleData'

// Vite's dev bundling breaks MapLibre's default worker path, so point it at the file directly.
setWorkerUrl(workerUrl)

const icons: Record<'fire' | 'flood' | 'heat' | 'earthquake' | 'shelter' | 'alert' | MapResourceCategory, LucideIcon> = {
  water_food: Utensils,
  medical: HeartPulse,
  charging: BatteryCharging,
  pets: PawPrint,
  transportation: Bus,
  fire: Flame,
  earthquake: Activity,
  flood: Droplets,
  heat: ThermometerSun,
  shelter: Tent,
  alert: TriangleAlert,
}

export function Icon({ name, size = 20 }: { name: keyof typeof icons; size?: number }) {
  const Glyph = icons[name]
  return <Glyph size={size} aria-hidden="true" />
}

// Zone color follows the hazard; order vs warning is shown by solid vs dashed outline and fill strength.
// MapLibre paints these itself, so they are hex values, not CSS variables.
const hazardColor: ExpressionSpecification = ['match', ['get', 'hazard'], 'fire', '#C2410C', 'flood', '#1D4ED8', 'earthquake', '#7C4A1E', '#B42318']

type Props = {
  shelters: Shelter[]
  incidents: Incident[]
  zones: ZoneCollection
  perimeters: PerimeterCollection
  shakeMaps: ShakeMapCollection
  center: { lat: number; lng: number }
  selection: MapSelection | null
  onSelect: (selection: MapSelection) => void
}

export function ShelterMap({ shelters, incidents, zones, perimeters, shakeMaps, center, selection, onSelect }: Props) {
  const mapRef = useRef<MapRef>(null)

  // Follow the selected city. The first render uses initialViewState, so this only moves on later changes.
  useEffect(() => {
    mapRef.current?.flyTo({ center: [center.lng, center.lat], zoom: 12 })
  }, [center])

  // Move the camera whenever the selection changes, whether it came from the map or the side panel.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !selection) return
    if (selection.type === 'zone') {
      const zone = zones.features.find(f => f.properties.zone_id === selection.id)
      if (!zone) return
      const ring = zone.geometry.coordinates[0]
      const lngs = ring.map(p => p[0])
      const lats = ring.map(p => p[1])
      map.fitBounds([[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]], { padding: 60 })
      return
    }
    const item = selection.type === 'incident'
      ? incidents.find(i => i.id === selection.id)
      : shelters.find(s => s.id === selection.id)
    if (item) map.flyTo({ center: [item.longitude, item.latitude], zoom: 14 })
  }, [selection, shelters, incidents, zones])

  const isSelected = (type: MapSelection['type'], id: string) => selection?.type === type && selection.id === id

  return (
    <Map
      ref={mapRef}
      initialViewState={{ latitude: center.lat, longitude: center.lng, zoom: 12 }}
      style={{ width: '100%', height: '100%' }}
      mapStyle="https://tiles.openfreemap.org/styles/positron"
      attributionControl={{ compact: true, customAttribution: 'Wildfires: NIFC WFIGS · Earthquakes: USGS · Evacuation zones: Cal OES · Sample scenario: demo data' }}
      interactiveLayerIds={['zone-fill']}
      onClick={e => {
        const zoneId = e.features?.[0]?.properties?.zone_id
        if (zoneId) onSelect({ type: 'zone', id: zoneId })
      }}
    >
      <NavigationControl position="top-right" />

      {/* Stronger shaking (higher MMI) draws darker and thicker. */}
      <Source id="shakemaps" type="geojson" data={shakeMaps}>
        <Layer
          id="shakemap-line"
          type="line"
          paint={{
            'line-color': '#7C4A1E',
            'line-width': ['interpolate', ['linear'], ['get', 'mmi'], 2, 1.5, 6, 3.5],
            'line-opacity': ['interpolate', ['linear'], ['get', 'mmi'], 2, 0.35, 6, 0.95],
          }}
        />
      </Source>

      <Source id="perimeters" type="geojson" data={perimeters}>
        <Layer id="perimeter-fill" type="fill" paint={{ 'fill-color': '#C2410C', 'fill-opacity': 0.15 }} />
        <Layer id="perimeter-line" type="line" paint={{ 'line-color': '#C2410C', 'line-width': 1.5 }} />
      </Source>

      <Source id="zones" type="geojson" data={zones}>
        <Layer
          id="zone-fill"
          type="fill"
          paint={{
            'fill-color': hazardColor,
            'fill-opacity': ['match', ['get', 'level'], 'order', 0.35, 0.15],
          }}
        />
        <Layer
          id="zone-warning-line"
          type="line"
          filter={['==', ['get', 'level'], 'warning']}
          paint={{ 'line-color': hazardColor, 'line-width': 2.5, 'line-dasharray': [3, 2] }}
        />
        <Layer
          id="zone-order-line"
          type="line"
          filter={['==', ['get', 'level'], 'order']}
          paint={{ 'line-color': hazardColor, 'line-width': 3 }}
        />
      </Source>

      {incidents.map(i => (
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
            <Icon name={s.category ?? 'shelter'} />
          </button>
        </Marker>
      ))}
    </Map>
  )
}