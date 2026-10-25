import { useRef, useState } from 'react'
import Map, { Marker, NavigationControl, type MapRef } from 'react-map-gl/maplibre'
import 'maplibre-gl/dist/maplibre-gl.css'
import { setWorkerUrl } from 'maplibre-gl'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url'
import { MapPin, Search } from 'lucide-react'
import { useI18n } from '../i18n/context'
import { reversePlace, searchPlaces, type Place } from './geocode'

// Vite's dev bundling breaks MapLibre's default worker path, so point it at the file directly.
setWorkerUrl(workerUrl)

export type Pin = { lat: number; lng: number }

type Props = {
  center: Pin
  pin: Pin | null
  onPin: (pin: Pin) => void
  /** Called with the address for the pin, after a search pick or a map click or drag. */
  onLabel: (label: string) => void
}

export default function LocationPicker({ center, pin, onPin, onLabel }: Props) {
  const { t } = useI18n()
  const mapRef = useRef<MapRef>(null)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Place[] | null>(null)
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState('')
  const [lookup, setLookup] = useState<'idle' | 'loading' | 'failed' | 'none'>('idle')
  const requestId = useRef(0)
  const lookupAbort = useRef<AbortController | null>(null)

  async function search() {
    setSearching(true); setError(''); setResults(null)
    try { setResults(await searchPlaces(query, center)) }
    catch { setError(t('picker.searchFailed')) }
    finally { setSearching(false) }
  }

  // Click or drag: move the pin now, then look up its address. A newer move cancels an older lookup.
  async function movePin(next: Pin) {
    const id = ++requestId.current
    // Drop any older lookup that hasn't been sent yet, so quick drags send only the last position.
    lookupAbort.current?.abort()
    const controller = new AbortController()
    lookupAbort.current = controller
    onPin(next)
    setLookup('loading')
    try {
      const label = await reversePlace(next, controller.signal)
      if (id !== requestId.current) return
      if (label) { onLabel(label); setLookup('idle') } else setLookup('none')
    } catch {
      if (id === requestId.current) setLookup('failed')
    }
  }

  function choose(place: Place) {
    requestId.current++
    lookupAbort.current?.abort()
    setLookup('idle')
    onPin({ lat: place.lat, lng: place.lng })
    onLabel(place.label)
    setResults(null)
    mapRef.current?.flyTo({ center: [place.lng, place.lat], zoom: 16 })
  }

  return <div className="location-picker">
    <div className="picker-search">
      <input
        type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder={t('picker.placeholder')}
        aria-label={t('picker.placeholder')} disabled={searching}
        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); void search() } }}
      />
      <button type="button" disabled={searching || query.trim().length < 3} onClick={() => void search()}><Search size={16} aria-hidden="true" />{searching ? t('picker.searching') : t('picker.search')}</button>
    </div>
    {error && <p role="alert" className="error">{error}</p>}
    {results && (results.length === 0
      ? <p role="status" className="muted">{t('picker.noResults')}</p>
      : <ul className="picker-results" aria-label={t('picker.results')}>
        {results.map(place => <li key={`${place.lat},${place.lng},${place.label}`}>
          <button type="button" onClick={() => choose(place)}><MapPin size={16} aria-hidden="true" />{place.label}</button>
        </li>)}
      </ul>)}
    <div className="picker-map">
      <Map
        ref={mapRef}
        initialViewState={{ latitude: pin?.lat ?? center.lat, longitude: pin?.lng ?? center.lng, zoom: pin ? 16 : 12 }}
        style={{ width: '100%', height: '100%' }}
        mapStyle="https://tiles.openfreemap.org/styles/positron"
        attributionControl={{ compact: true }}
        cursor="crosshair"
        onClick={e => void movePin({ lat: e.lngLat.lat, lng: e.lngLat.lng })}
      >
        <NavigationControl position="top-right" showCompass={false} />
        {pin && <Marker latitude={pin.lat} longitude={pin.lng} draggable anchor="bottom"
          onDragEnd={e => void movePin({ lat: e.lngLat.lat, lng: e.lngLat.lng })}>
          <MapPin size={36} fill="#c2410c" color="#fff" aria-label={t('picker.pinLabel')} />
        </Marker>}
      </Map>
    </div>
    {lookup === 'loading' && <p className="muted" role="status">{t('picker.lookingUp')}</p>}
    {lookup === 'failed' && <p className="muted" role="status">{t('picker.lookupFailed')}</p>}
    {lookup === 'none' && <p className="muted" role="status">{t('picker.noAddress')}</p>}
    <p className="muted">{pin ? t('picker.pinPlaced', { coords: `${pin.lat.toFixed(5)}, ${pin.lng.toFixed(5)}` }) : t('picker.pinNeeded')} {t('picker.attribution')}</p>
  </div>
}
