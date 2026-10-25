import { noPerimeters } from '../hazards/liveHazards'
import { noShakeMaps, type MapSelection } from '../map/sampleData'
import { ShelterMap } from '../shelters/ShelterMap'
import { pinBounds, type Attachments } from './attachments'

// The small map inside a SAM answer: only the places the answer cited. Loaded on demand so the chat stays light.
export default function SamMap({ map, center, selection, onSelect }: {
  map: Attachments['map']
  center: { lat: number; lng: number }
  selection: MapSelection | null
  onSelect: (selection: MapSelection) => void
}) {
  return <ShelterMap
    shelters={map.shelters} incidents={map.incidents} zones={{ type: 'FeatureCollection', features: map.zones }}
    perimeters={noPerimeters} shakeMaps={noShakeMaps} center={center} bounds={pinBounds(map)} selection={selection} onSelect={onSelect}
  />
}
