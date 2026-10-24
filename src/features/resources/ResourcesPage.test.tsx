import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { Session } from '@supabase/supabase-js'
import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { CommunityContext, type AuthState } from '../community/session'
import { deriveValue, idle, SimulationContext, simulationReducer } from '../simulation/context'
import { sampleExtras } from './sampleData'
import { AddResource, ResourcesPage } from './ResourcesPage'
import type { Resource } from './schemas'

const city = 'Santa Rosa'
const signedOut: AuthState = { session: null, loading: false, error: null, configured: true }
const signedIn = (id: string): AuthState => ({ ...signedOut, session: { user: { id } } as Session })

function render(auth: AuthState, rows: Resource[] | undefined, sim = idle) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  if (rows) client.setQueryData(['resources', city], rows)
  return renderToString(
    <QueryClientProvider client={client}>
      <CommunityContext.Provider value={auth}>
        <SimulationContext.Provider value={deriveValue(sim, () => {})}>
          <ResourcesPage city={city} onSignIn={() => {}} />
        </SimulationContext.Provider>
      </CommunityContext.Provider>
    </QueryClientProvider>,
  ).replaceAll('<!-- -->', '')
}

const rows: Resource[] = [
  { ...sampleExtras[0]!, id: '1', title: 'Evacuation shuttle', status: 'official' },
  { ...sampleExtras[4]!, id: '2', title: 'Phone charging', status: 'community_submitted', author_id: 'me' },
  { ...sampleExtras[1]!, id: '3', title: 'Old water point', status: 'verified', last_confirmed_at: '2026-01-01T00:00:00Z' },
]

describe('ResourcesPage', () => {
  it('shows loading while the first request is pending', () => {
    expect(render(signedOut, undefined)).toContain('Loading resources')
  })

  it('renders cards with their status, source, and report action', () => {
    const html = render(signedIn('someone'), rows)
    expect(html).toContain('Evacuation shuttle')
    expect(html).toContain('Official')
    expect(html).toContain('Community-submitted · unverified')
    expect(html).toContain('Report inaccurate or unsafe')
    expect(html).toContain('Sample data (Sonoma County)')
  })

  it('labels a resource nobody confirmed recently as out of date', () => {
    expect(render(signedOut, rows)).toContain('May be out of date')
  })

  it('asks signed-out visitors to sign in to report or add', () => {
    const html = render(signedOut, rows)
    expect(html).toContain('Sign in to report a problem')
    expect(html).toContain('Sign in to add a resource')
    expect(html).not.toContain('>Report inaccurate or unsafe<')
  })

  it('lets a signed-in user add a resource and remove only their own', () => {
    const html = render(signedIn('me'), rows)
    expect(html).toContain('Add a resource')
    expect(html.match(/Remove my submission/g)).toHaveLength(1)
    expect(render(signedIn('other'), rows)).not.toContain('Remove my submission')
  })

  it('offers filters by type and by status', () => {
    const html = render(signedOut, rows)
    expect(html).toContain('Water and food')
    expect(html).toContain('Transportation')
    expect(html).toContain('Verified')
  })

  it('shows an empty state that does not claim help is unavailable', () => {
    const html = render(signedOut, [])
    expect(html).toContain('No resources listed for Santa Rosa yet')
    expect(html).toContain('does not mean help is unavailable')
  })

  it('falls back to labeled sample resources when Supabase is not configured', () => {
    const html = render({ ...signedOut, configured: false }, undefined)
    expect(html).toContain('Sample resources')
    expect(html).toContain('Finley Community Center')
    expect(html).not.toContain('Report inaccurate or unsafe')
  })

  it('shows simulated resources that grow with the scenario, with reporting off', () => {
    const early = render(signedOut, undefined, { ...simulationReducer(idle, { type: 'start', now: Date.now() }), index: 0 })
    expect(early).toContain('Simulation running')
    expect(early).toContain('Resources open as the simulation runs')
    const late = render(signedOut, undefined, { ...simulationReducer(idle, { type: 'start', now: Date.now() }), index: 4 })
    expect(late).toContain('Water and meals')
    expect(late).toContain('Evacuation shuttle')
    expect(late).not.toContain('Report inaccurate or unsafe')
    expect(late).not.toContain('Add a resource')
  })

  it('asks for a map pin when adding a resource and blocks submitting without one', () => {
    const client = new QueryClient()
    const html = renderToString(<QueryClientProvider client={client}><AddResource city={city} onDone={() => {}} /></QueryClientProvider>).replaceAll('<!-- -->', '')
    expect(html).toContain('Where is it?')
    expect(html).toContain('Place a pin on the map to add this resource')
    expect(html).toMatch(/<button[^>]*disabled[^>]*>Add resource<\/button>|<button[^>]*type="submit"[^>]*disabled/)
    expect(html).not.toContain('Latitude')
  })

  it('does not load the map until the add form opens', () => {
    expect(render(signedIn('me'), rows)).not.toContain('Search for an address or place')
  })
})
