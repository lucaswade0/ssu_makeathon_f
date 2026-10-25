import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import App from './App'
import { CommunityProvider } from './features/community/provider'
import { I18nProvider } from './features/i18n/I18nProvider'
import { SimulationProvider } from './features/simulation/SimulationProvider'

describe('App', () => {
  it('keeps Meet SAM mounted but hidden on other pages, so the chat survives switching tabs', () => {
    const html = renderToString(<CommunityProvider><I18nProvider><SimulationProvider><App /></SimulationProvider></I18nProvider></CommunityProvider>)
    expect(html).toContain('<div hidden=""><section class="sam"')
  })
})
