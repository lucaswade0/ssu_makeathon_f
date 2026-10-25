import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { CommunityPost, OfficialAlert } from '../community/schemas'
import { CommunityContext, type AuthState } from '../community/session'
import { I18nContext, makeI18n } from '../i18n/context'
import type { Language } from '../i18n/languages'
import type { Incident } from '../map/sampleData'
import { sampleResources } from '../resources/sampleData'
import { attachmentsFor } from './attachments'
import { buildSamContext } from './context'
import { PostSnippet } from './PostSnippet'
import { SamAttachments } from './SamAttachments'

const now = Date.parse('2026-10-25T12:00:00Z')
const iso = new Date(now - 5 * 60_000).toISOString()
const signedOut: AuthState = { session: null, loading: false, error: null, configured: true }

const alert = { id: 'a', city: 'Santa Rosa', title: 'Evacuation order: Zone E1', instructions: 'Leave now.', source_name: 'Sonoma County', source_url: null, severity: 'critical', issued_at: iso, expires_at: null, created_at: iso, updated_at: iso } as OfficialAlert
const incident: Incident = { id: 'i1', kind: 'fire', title: 'Wildfire · Test', location_text: 'Sonoma County', latitude: 38.5, longitude: -122.7, acres: 60, source: 'NIFC', updated_at: iso }
const post = { id: 'p', author_id: 'u', city: 'Santa Rosa', post_type: 'question', body: 'Is there water?', photo_paths: [], created_at: iso, updated_at: iso, author: { id: 'u', display_name: 'Priya S.' } } as CommunityPost

const { entries } = buildSamContext({ city: 'Santa Rosa', now, alert, incidents: [incident], resources: sampleResources, posts: [post] })

function render(answer: string, { lang = 'en', simulated = false, liveMap = false }: { lang?: Language; simulated?: boolean; liveMap?: boolean } = {}) {
  const attachments = attachmentsFor(answer, entries, { simulated })
  return renderToString(
    <QueryClientProvider client={new QueryClient()}>
      <CommunityContext.Provider value={signedOut}>
        <I18nContext.Provider value={makeI18n(lang, () => {})}>
          <SamAttachments attachments={attachments} city="Santa Rosa" simulated={simulated} liveMap={liveMap} onOpenMap={() => {}} />
        </I18nContext.Provider>
      </CommunityContext.Provider>
    </QueryClientProvider>,
  ).replaceAll('<!-- -->', '')
}

describe('SamAttachments', () => {
  it('shows nothing when the answer cites nothing', () => {
    expect(render('Pack water and call 911 in an emergency.')).toBe('')
  })

  it('shows a cited resource as its real card, with trust label, source, and no report button', () => {
    const out = render('Finley [R1] is a shelter.')
    expect(out).toContain('Finley Community Center')
    expect(out).toContain('Official')
    expect(out).toContain('Sample data (county emergency services)')
    expect(out).not.toContain('Report inaccurate or unsafe')
    expect(out).not.toContain('Sign in to report')
  })

  it('shows a community-submitted resource as unverified', () => {
    expect(render('[R3]')).toContain('Community-submitted · unverified')
  })

  it('shows the alert card with its urgency word', () => {
    const out = render('There is an order [A1].')
    expect(out).toContain('Evacuation order: Zone E1')
    expect(out).toContain('Urgent')
    expect(out).toContain('sev-critical')
    expect(out).toContain('Read full alert')
  })

  it('shows incidents as news cards, marked as sample data in a simulation', () => {
    expect(render('[I1]')).toContain('Public data')
    expect(render('[I1]', { simulated: true })).toContain('Sample data')
    expect(render('[I1]')).toContain('Wildfire · Test')
  })

  it('shows a post as unverified, with no edit, delete, or reply', () => {
    const out = render('Someone asked [P1].')
    expect(out).toContain('Is there water?')
    expect(out).toContain('Community · unverified')
    expect(out).not.toContain('Edit')
    expect(out).not.toContain('Reply')
  })

  it('offers a map button for older answers and an open-map button for the live one', () => {
    expect(render('[R1] [I1]')).toContain('Show map')
    expect(render('[R1] [I1]', { liveMap: true })).toContain('Open on the Map page')
    expect(render('[R1] [I1]', { liveMap: true })).toContain('Map of the places in this answer')
  })

  it('does not show a map for answers with nothing to pin', () => {
    const out = render('[A1] and [P1]')
    expect(out).not.toContain('Show map')
    expect(out).not.toContain('Open on the Map page')
  })

  it('says the cards come from the app’s data', () => {
    expect(render('[R1]')).toContain('Shown from the app’s data. Each item keeps its source and trust label.')
  })

  it('is translated', () => {
    expect(render('[R1] [I1]', { lang: 'es' })).toContain('Mostrar mapa')
    expect(render('[R1]', { lang: 'zh' })).toContain('内容来自应用的数据')
    expect(render('[R1] [I1]', { lang: 'vi', liveMap: true })).toContain('Mở trên trang Bản đồ')
  })
})

describe('PostSnippet', () => {
  const html = (sample: boolean) => renderToString(<I18nContext.Provider value={makeI18n('en', () => {})}><PostSnippet post={post} sample={sample} /></I18nContext.Provider>).replaceAll('<!-- -->', '')

  it('marks a real post unverified and a simulated one as a sample', () => {
    expect(html(false)).toContain('Community · unverified')
    expect(html(true)).toContain('Sample post')
  })

  it('shows the author, the type tag, and the text', () => {
    const out = html(false)
    expect(out).toContain('Priya S.')
    expect(out).toContain('post-type question')
    expect(out).toContain('Is there water?')
  })
})
