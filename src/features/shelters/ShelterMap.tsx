import Map, { Marker, NavigationControl, Popup } from 'react-map-gl/maplibre'
import 'maplibre-gl/dist/maplibre-gl.css'
import { useState } from 'react'
import { setWorkerUrl } from 'maplibre-gl'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url'
import { sampleShelters, type Shelter } from '../map/sampleData'

// Vite's dev bundling breaks MapLibre's default worker path, so point it at the file directly.
setWorkerUrl(workerUrl)



export function ShelterMap() {
  const [selected, setSelected] = useState<Shelter | null>(null)

  return (
    <Map
      initialViewState={{ latitude: 38.44, longitude: -122.71, zoom: 11 }}
      style={{ width: '100%', height: '100%' }}
      mapStyle="https://tiles.openfreemap.org/styles/liberty"
    >
      <NavigationControl position="top-right" />
      {sampleShelters.map(s => (
        <Marker
          key={s.id}
          latitude={s.latitude}
          longitude={s.longitude}
          onClick={e => { e.originalEvent.stopPropagation(); setSelected(s) }}
        />
      ))}
      {selected && (
        <Popup latitude={selected.latitude} longitude={selected.longitude} onClose={() => setSelected(null)}>
          {selected.name}
        </Popup>
      )}
    </Map>
  )
}