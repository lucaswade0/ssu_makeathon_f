import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { AppShell, type Page } from './AppShell'

const render = (page: Page) => renderToString(<AppShell page={page} onNavigate={() => {}}><p>content</p></AppShell>)

describe('AppShell', () => {
  it('marks Ask SAM and Profile so phones hide the simulation button there', () => {
    expect(render('sam')).toContain('class="app no-sim-start"')
    expect(render('profile')).toContain('class="app no-sim-start"')
  })

  it('keeps the simulation button on the other pages', () => {
    for (const page of ['feed', 'news', 'map', 'resources'] as const) expect(render(page)).toContain('class="app"')
  })
})
