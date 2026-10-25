import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { NewsPage } from './NewsPage'
import { deriveValue, idle, SimulationContext, simulationReducer } from '../simulation/context'

const city = 'Santa Rosa'

// Fills the cache with the exact shapes the live hooks return, so the page renders with data and no network.
// If two hooks ever share a query key but return different shapes, rendering here throws.
function render(city_: string, seed: (client: QueryClient) => void = () => {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  seed(client)
  // React separates adjacent text nodes with comment markers; drop them so text assertions read naturally.
  return renderToString(<QueryClientProvider client={client}><NewsPage city={city_} /></QueryClientProvider>).replaceAll('<!-- -->', '')
}

describe('NewsPage', () => {
  it('renders the heading, filter, and data sources while loading', () => {
    const html = render(city)
    expect(html).toContain('News for Santa Rosa')
    expect(html).toContain('Checking public sources')
    expect(html).toContain('Data sources')
    expect(html).toContain('In an emergency, call 911')
  })

  it('shows the coverage message for a city without live data', () => {
    const html = render('Springfield')
    expect(html).toContain('only set up for Sonoma County')
    expect(html).not.toContain('Checking public sources')
  })

  it('renders live earthquakes from the shared earthquake cache shape', () => {
    const html = render(city, client => {
      client.setQueryData(['hazards', 'earthquakes', city], [{
        id: 'usgs-nc1', kind: 'earthquake', title: 'M3.1 earthquake', location_text: '7 km W of Cobb, CA',
        latitude: 38.8, longitude: -122.8, source: 'USGS earthquake catalog', updated_at: new Date().toISOString(),
      }])
    })
    expect(html).toContain('M3.1 earthquake')
    expect(html).toContain('7 km W of Cobb, CA')
    expect(html).toContain('USGS earthquake catalog')
  })

  it('renders live weather alerts, fires, and evacuation zones together', () => {
    const html = render(city, client => {
      client.setQueryData(['hazards', 'weather', city], [{
        id: 'urn:1', event: 'Red Flag Warning', severity: 'Severe', headline: 'Red Flag Warning until 8 PM',
        areaDesc: 'North Bay Mountains', senderName: 'NWS San Francisco CA',
        effective: new Date().toISOString(), expires: new Date(Date.now() + 3_600_000).toISOString(),
      }])
      client.setQueryData(['hazards', 'fires', city], [{
        id: 'wfigs-1', kind: 'fire', title: 'Wildfire · Test Fire', location_text: 'Sonoma County',
        latitude: 38.5, longitude: -122.7, source: 'NIFC WFIGS', updated_at: new Date().toISOString(),
      }])
      client.setQueryData(['hazards', 'zones', city], {
        type: 'FeatureCollection',
        features: [{
          type: 'Feature', geometry: { type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]] },
          properties: { zone_id: 'SRO-1', level: 'order', hazard: 'fire', instructions: 'Leave now.', source: 'Cal OES', issued_at: new Date().toISOString() },
        }],
      })
    })
    expect(html).toContain('Red Flag Warning until 8 PM')
    expect(html).toContain('Wildfire · Test Fire')
    expect(html).toContain('Evacuation order · Zone SRO-1')
    expect(html).toContain('Public data')
  })

  it('shows an empty state that does not claim the area is safe', () => {
    const html = render(city, client => {
      for (const key of ['weather', 'fires', 'earthquakes']) client.setQueryData(['hazards', key, city], [])
      client.setQueryData(['hazards', 'zones', city], { type: 'FeatureCollection', features: [] })
    })
    expect(html).toContain('No updates listed for Santa Rosa')
    expect(html).toContain('does not confirm the area is safe')
  })

  it('labels an expired alert', () => {
    const html = render(city, client => {
      client.setQueryData(['hazards', 'weather', city], [{
        id: 'urn:old', event: 'Flood Watch', severity: 'Minor', headline: 'Old flood watch', areaDesc: 'Creek', senderName: 'NWS',
        effective: new Date(Date.now() - 7_200_000).toISOString(), expires: new Date(Date.now() - 3_600_000).toISOString(),
      }])
    })
    expect(html).toContain('Old flood watch')
    expect(html).toContain('Expired')
  })

  it('shows simulated updates, labeled as sample data, while the simulation runs', () => {
    const machine = { ...simulationReducer(idle, { type: 'start', now: Date.now() }), index: 3 }
    const client = new QueryClient()
    const html = renderToString(<QueryClientProvider client={client}><SimulationContext.Provider value={deriveValue(machine, () => {})}><NewsPage city={city} /></SimulationContext.Provider></QueryClientProvider>).replaceAll('<!-- -->', '')
    expect(html).toContain('Simulation running')
    expect(html).toContain('Evacuation order · Zone SRO-E011')
    expect(html).toContain('Sample data')
    expect(html).not.toContain('Checking public sources')
  })

  it('opens source links in the same tab', () => {
    const html = render(city, client => {
      client.setQueryData(['hazards', 'weather', city], [{
        id: 'urn:1', event: 'Red Flag Warning', severity: 'Severe', headline: 'Red Flag Warning until 8 PM',
        areaDesc: 'North Bay Mountains', senderName: 'NWS San Francisco CA',
        effective: new Date().toISOString(), expires: new Date(Date.now() + 3_600_000).toISOString(),
      }])
    })
    expect(html).toContain('View source')
    expect(html).toContain('href="https://www.weather.gov/"')
    expect(html).not.toContain('target=')
  })
})
