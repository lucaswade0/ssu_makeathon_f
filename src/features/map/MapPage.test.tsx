import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { CommunityContext, type AuthState } from '../community/session'
import { deriveValue, idle, SimulationContext } from '../simulation/context'
import { MapPage } from './MapPage'

const offline: AuthState = { session: null, loading: false, error: null, configured: false }

function render() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, enabled: false } } })
  return renderToString(
    <QueryClientProvider client={client}>
      <CommunityContext.Provider value={offline}>
        <SimulationContext.Provider value={deriveValue(idle, () => {})}>
          <MapPage city="Santa Rosa" />
        </SimulationContext.Provider>
      </CommunityContext.Provider>
    </QueryClientProvider>,
  ).replaceAll('<!-- -->', '')
}

describe('MapPage phone controls', () => {
  it('has a list button that controls the side panel, closed at first', () => {
    const html = render()
    expect(html).toContain('aria-label="Incidents, resources and alerts" aria-controls="map-panel" aria-expanded="false"')
    expect(html).toContain('id="map-panel"')
    expect(html).not.toContain('panel-open')
    expect(html).not.toContain('map-scrim')
  })

  it('has Filters and Legend buttons, with the filter card closed and the legend open off phones', () => {
    const html = render()
    expect(html).toMatch(/<button type="button" class="map-fab" aria-expanded="false">.*?Filters/)
    expect(html).toMatch(/<button type="button" class="map-fab" aria-expanded="true">.*?Legend/)
    expect(html).not.toContain('map-filters-pop')
    expect(html).toContain('<details class="map-legend" open="">')
  })

  it('keeps the hazard filters in the side panel for desktop', () => {
    expect(render()).toMatch(/<aside id="map-panel"[^>]*>.*?<fieldset class="hazard-filters">/)
  })
})
