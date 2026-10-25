import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { Session } from '@supabase/supabase-js'
import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { AlertSummary, AlertTags } from '../alerts/AlertSummary'
import type { AlertView } from '../alerts/alertFormat'
import { CommunityContext, type AuthState } from '../community/session'
import { AppShell, ProfilePage } from '../../layout/AppShell'
import { NewsPage } from '../news/NewsPage'
import { AddResource, ResourcesPage } from '../resources/ResourcesPage'
import { sampleExtras } from '../resources/sampleData'
import { deriveValue, idle, SimulationContext, simulationReducer } from '../simulation/context'
import { SimulationBar } from '../simulation/SimulationBar'
import { I18nContext, makeI18n } from './context'
import { I18nProvider } from './I18nProvider'
import { TranslatableText } from './TranslatableText'
import { messages } from './messages'
import type { Language } from './languages'

const city = 'Santa Rosa'
const browser = globalThis as unknown as Record<string, unknown>

// Pretends the browser has the built-in Translator, so the Translate button shows instead of the fallback link.
function withTranslator<T>(run: () => T): T {
  browser.Translator = { availability: async () => 'available', create: async () => ({ translate: async (text: string) => text }) }
  browser.LanguageDetector = { create: async () => ({ detect: async () => [] }) }
  try { return run() } finally { delete browser.Translator; delete browser.LanguageDetector }
}
const signedOut: AuthState = { session: null, loading: false, error: null, configured: true }
const signedIn: AuthState = { ...signedOut, session: { user: { id: 'me', user_metadata: { display_name: 'Rosa' } } } as unknown as Session }

type PageOptions = { auth?: AuthState; sim?: typeof idle; seed?: (client: QueryClient) => void }

function page(node: React.ReactElement, lang: Language, { auth = signedOut, sim = idle, seed }: PageOptions = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  seed?.(client)
  return renderToString(
    <QueryClientProvider client={client}>
      <CommunityContext.Provider value={auth}>
        <SimulationContext.Provider value={deriveValue(sim, () => {})}>
          <I18nContext.Provider value={makeI18n(lang, () => {})}>{node}</I18nContext.Provider>
        </SimulationContext.Provider>
      </CommunityContext.Provider>
    </QueryClientProvider>,
  ).replaceAll('<!-- -->', '')
}

const shell = (lang: Language, auth = signedOut) => page(<AppShell page="feed" onNavigate={() => {}}>content</AppShell>, lang, { auth })
const running = { ...simulationReducer(idle, { type: 'start', now: Date.now() }), index: 3 }

describe('app shell', () => {
  it('stays in English by default', () => {
    const out = page(<AppShell page="feed" onNavigate={() => {}}>x</AppShell>, 'en')
    for (const word of ['Feed', 'News', 'Map', 'Resources', 'Meet SAM']) expect(out).toContain(word)
  })

  it('shows the header and navigation in Spanish', () => {
    const out = shell('es')
    expect(out).toContain('Comunidad')
    expect(out).toContain('Noticias')
    expect(out).toContain('Recursos')
    expect(out).toContain('Conoce a SAM')
  })

  it('shows the header and navigation in Chinese', () => {
    const out = shell('zh')
    expect(out).toContain('社区')
    expect(out).toContain('新闻')
    expect(out).toContain('地图')
    expect(out).toContain('认识 SAM')
  })

  it('shows the profile navigation label in Vietnamese', () => {
    expect(shell('vi', signedIn)).toContain('Hồ sơ')
    expect(shell('vi')).toContain('Hồ sơ')
  })

  it('puts location and language controls in the profile menu', () => {
    const out = page(<ProfilePage city={city} onCityChange={() => {}} onSignIn={() => {}} />, 'es', { auth: signedIn })
    expect(out).toContain('Santa Rosa')
    expect(out).toContain('Ubicación aproximada, puede no ser exacta.')
    expect(out).toContain('aria-label="Idioma"')
  })

  it('translates the simulation start button and the running bar', () => {
    expect(page(<SimulationBar />, 'es')).toContain('Ejecutar simulación de desastre')
    const bar = page(<SimulationBar />, 'zh', { sim: running })
    expect(bar).toContain('模拟 · 示例数据，并非真实事件')
    expect(bar).toContain('第 4 步，共 8 步')
    expect(bar).toContain('上一步')
  })
})

describe('dates', () => {
  it('shows alert dates in the reader’s language', () => {
    const alert: AlertView = { kind: 'official', severity: 'info', title: 'x', paragraphs: ['y'], issuedAt: '2026-10-24T20:34:00Z', source: 's' }
    expect(page(<AlertSummary alert={alert} />, 'es')).toMatch(/Emitida 24 oct 2026/)
    expect(page(<AlertSummary alert={alert} />, 'zh')).toContain('2026年10月24日')
  })
})

describe('alert card', () => {
  const alert: AlertView = {
    kind: 'official', severity: 'critical', title: 'Evacuation order', paragraphs: ['Leave now.'], issuedAt: '2026-10-24T20:34:00Z',
    expiresAt: '2026-10-25T20:34:00Z', source: 'Sonoma County', sourceUrl: 'https://example.gov/a', expired: true,
  }

  it('shows the badges and severity word in Spanish', () => {
    const out = page(<AlertTags kind="official" severity="critical" />, 'es')
    expect(out).toContain('OFICIAL')
    expect(out).toContain('Urgente')
    expect(out).toContain('Fijada · Última alerta')
  })

  it('shows the labels, expiry warning, and button in Chinese', () => {
    const out = page(<AlertSummary alert={alert} />, 'zh')
    expect(out).toContain('阅读完整警报')
    expect(out).toContain('此警报已过期')
    expect(out).toContain('发布于')
  })

  it('translates the full alert dialog and keeps the alert text', () => {
    const out = withTranslator(() => page(<AlertSummary alert={alert} defaultOpen />, 'vi'))
    expect(out).toContain('Ban hành')
    expect(out).toContain('Hướng dẫn chính thức')
    expect(out).toContain('Leave now.')
    expect(out).not.toContain('translate.google.com')
  })

  it('labels weather alert pins in the reader’s language', () => {
    expect(page(<AlertTags kind="nws" label="weather alert" severity="info" />, 'es')).toContain('Fijada · Última alerta meteorológica')
  })
})

describe('pages', () => {
  it('shows the News page in Chinese and translates each card by itself', () => {
    const out = withTranslator(() => page(<NewsPage city={city} />, 'zh', { sim: running }))
    expect(out).toContain('新闻')
    expect(out).toContain('模拟运行中')
    expect(out).not.toContain('translate-button')
    expect(out).not.toContain('translate.google.com')
    expect(out).toContain('查看来源')
  })

  it('shows the Resources page in Spanish with translated categories and statuses', () => {
    const rows = [{ ...sampleExtras[0]!, id: 'a', status: 'official' as const }, { ...sampleExtras[4]!, id: 'b', status: 'community_submitted' as const }]
    const out = withTranslator(() => page(<ResourcesPage city={city} onSignIn={() => {}} />, 'es', { seed: client => client.setQueryData(['resources', city], rows) }))
    expect(out).toContain('Recursos en Santa Rosa')
    expect(out).toContain('Transporte')
    expect(out).toContain('Oficial')
    expect(out).toContain('Aportado por la comunidad · sin verificar')
    expect(out).toContain('Inicie sesión para reportar un problema')
    expect(out).not.toContain('translate.google.com')
  })

  it('keeps the 911 safety line on every page, in every language', () => {
    for (const lang of ['en', 'es', 'vi', 'zh'] as const) {
      expect(page(<NewsPage city={city} />, lang, { sim: running })).toContain('911')
      expect(page(<ResourcesPage city={city} onSignIn={() => {}} />, lang, { sim: running })).toContain('911')
    }
  })
})

describe('translatable text', () => {
  it('shows the original text first, then translates by itself when the browser can', () => {
    const out = withTranslator(() => page(<TranslatableText text="Hay un incendio cerca" className="body-text" />, 'en'))
    expect(out).toContain('Hay un incendio cerca')
    expect(out).not.toContain('translate.google.com')
  })

  it('falls back to an online translator link when the browser cannot translate', () => {
    const out = page(<TranslatableText text="Packed the car just in case" />, 'es')
    expect(out).toContain('Este navegador no puede traducir por sí solo.')
    expect(out).toContain('translate.google.com')
    expect(out).not.toContain('translate-button')
  })

  it('shows no translator link for text that is already in the reader’s language', () => {
    expect(page(<TranslatableText text="Packed the car just in case" />, 'en')).not.toContain('translate.google.com')
    expect(page(<TranslatableText text="Hay un incendio cerca de la casa" />, 'es')).not.toContain('translate.google.com')
  })

  it('still offers the link when the language cannot be told', () => {
    expect(page(<TranslatableText text="xqz wvk" />, 'en')).toContain('translate.google.com')
  })

  it('shows nothing extra for empty text', () => {
    expect(page(<TranslatableText text="  " />, 'en')).not.toContain('Translate')
  })
})

describe('provider', () => {
  it('renders in English when the browser has no stored choice', () => {
    const out = renderToString(<I18nProvider><SimulationBar /></I18nProvider>)
    expect(out).toContain('Run disaster simulation')
  })
})

describe('every wired message exists', () => {
  it('has the keys the pages use', () => {
    for (const key of ['nav.feed', 'feed.title', 'alert.readFull', 'resources.title', 'news.title', 'sim.start', 'translate.button', 'sam.soon'] as const) {
      expect(messages.en[key]).toBeTruthy()
    }
  })
})

describe('forms and sign-in text', () => {
  const addForm = (lang: Language) => page(<AddResource city={city} existing={[]} onDone={() => {}} />, lang)

  it('shows the add-resource form in Spanish', () => {
    const out = addForm('es')
    expect(out).toContain('Agregar un recurso en Santa Rosa')
    expect(out).toContain('Dirección o punto de referencia')
    expect(out).toContain('Coloque un marcador en el mapa para agregar este recurso.')
    expect(out).toContain('Agua y comida')
  })

  it('shows the add-resource form in Chinese and Vietnamese', () => {
    expect(addForm('zh')).toContain('在Santa Rosa添加资源')
    expect(addForm('vi')).toContain('Thêm một điểm hỗ trợ tại Santa Rosa')
  })

  it('keeps the form in English by default', () => {
    expect(addForm('en')).toContain('Add a resource in Santa Rosa')
    expect(addForm('en')).toContain('Place a pin on the map to add this resource.')
  })
})
