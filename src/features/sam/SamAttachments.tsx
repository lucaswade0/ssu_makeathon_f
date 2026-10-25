import { lazy, Suspense, useState } from 'react'
import { MapPinned } from 'lucide-react'
import { cityCenter, hasLiveCoverage } from '../hazards/liveHazards'
import { useI18n } from '../i18n/context'
import type { MapSelection } from '../map/sampleData'
import { NewsCard } from '../news/NewsPage'
import { incidentItems, isExpired, zoneItems } from '../news/newsItems'
import { ResourceCard } from '../resources/ResourcesPage'
import { hasPins, pinCenter, type Attachments } from './attachments'

const SamMap = lazy(() => import('./SamMap'))

/**
 * The map and resource cards for the items an answer cited. They are drawn from the app's own data, so each keeps its
 * source, time, and trust label. Only the newest answer keeps a live map (`liveMap`); older answers offer a button.
 */
export function SamAttachments({ attachments, city, simulated, liveMap, onOpenMap }: {
  attachments: Attachments
  city: string
  simulated: boolean
  liveMap: boolean
  onOpenMap: () => void
}) {
  const { t } = useI18n()
  const [showMap, setShowMap] = useState(false)
  const [selection, setSelection] = useState<MapSelection | null>(null)
  const [now] = useState(() => Date.now())
  if (attachments.empty) return null

  const pins = hasPins(attachments.map)
  const fallback = cityCenter(hasLiveCoverage(city) ? city : 'Santa Rosa')

  function selected() {
    if (!selection) return null
    if (selection.type === 'shelter') {
      const resource = attachments.mapResources.find(r => r.id === selection.id)
      return resource ? <ResourceCard resource={resource} now={now} canReport={false} onSignIn={() => {}} /> : null
    }
    const items = selection.type === 'incident'
      ? incidentItems(attachments.map.incidents.filter(i => i.id === selection.id), simulated)
      : zoneItems(attachments.map.zones.filter(z => z.properties.zone_id === selection.id).map(z => z.properties), simulated)
    return items[0] ? <NewsCard item={items[0]} expired={isExpired(items[0], now)} /> : null
  }

  return <div className="sam-attachments">
    {pins && (liveMap || showMap
      ? <div className="sam-map-block">
        <div className="sam-map" role="region" aria-label={t('sam.mapLabel')}>
          <Suspense fallback={<p className="muted">…</p>}>
            <SamMap map={attachments.map} center={pinCenter(attachments.map, fallback)} selection={selection} onSelect={setSelection} />
          </Suspense>
        </div>
        {selected()}
        <button type="button" className="sam-open-map" onClick={onOpenMap}><MapPinned size={16} aria-hidden="true" />{t('sam.openMap')}</button>
      </div>
      : <button type="button" className="sam-open-map" onClick={() => setShowMap(true)}><MapPinned size={16} aria-hidden="true" />{t('sam.showMap')}</button>)}

    {attachments.resources.map(resource => <ResourceCard key={resource.id} resource={resource} now={now} canReport={false} onSignIn={() => {}} />)}

    <p className="muted sam-from-app">{t('sam.fromApp')}</p>
  </div>
}
