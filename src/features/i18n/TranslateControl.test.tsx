import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { I18nContext, makeI18n } from './context'
import { LanguageMenu } from './LanguageMenu'
import { TranslateControl, TranslateView, type TranslateState } from './TranslateControl'
import { TranslationBanner, TranslationBannerView } from './TranslationBanner'
import type { Language } from './languages'

const html = (node: React.ReactElement, lang: Language = 'en') =>
  renderToString(<I18nContext.Provider value={makeI18n(lang, () => {})}>{node}</I18nContext.Provider>).replaceAll('<!-- -->', '')
const view = (state: TranslateState, lang: Language = 'en') => html(<TranslateView state={state} onRun={() => {}} onToggle={() => {}} />, lang)

describe('TranslateView states', () => {
  it('offers a Translate button at first', () => {
    const out = view({ kind: 'idle' })
    expect(out).toContain('Translate')
    expect(out).toContain('<button')
  })

  it('shows progress while working, with no button', () => {
    const out = view({ kind: 'working' })
    expect(out).toContain('Translating…')
    expect(out).not.toContain('<button')
  })

  it('always labels a translation as machine translated and offers the original', () => {
    const out = view({ kind: 'done', source: 'es', texts: ['Fire nearby'], showing: true })
    expect(out).toContain('Translated from Spanish. Machine translated, may be wrong.')
    expect(out).toContain('Show original')
  })

  it('offers to show the translation again after showing the original', () => {
    const out = view({ kind: 'done', source: 'es', texts: ['Fire nearby'], showing: false })
    expect(out).toContain('Show translation')
    expect(out).not.toContain('Show original')
  })

  it('says when the text is already in the reader’s language, if the person asked', () => {
    expect(view({ kind: 'same', source: 'en', quiet: false })).toContain('This text is already in English.')
  })

  it('shows nothing while checking, or for text already in the reader’s language', () => {
    expect(view({ kind: 'checking' })).toBe('')
    expect(view({ kind: 'same', source: 'en', quiet: true })).toBe('')
  })

  it('asks for a click when the language still has to download', () => {
    const out = view({ kind: 'needs-download' })
    expect(out).toContain('Tap Translate to download this language once.')
    expect(out).toContain('<button')
  })

  it('shows an error and lets the person try again', () => {
    const out = view({ kind: 'error', reason: 'other' })
    expect(out).toContain('Couldn’t translate this text.')
    expect(out).toContain('Translate')
    expect(out).toContain('role="alert"')
  })

  it('explains why it failed', () => {
    expect(view({ kind: 'error', reason: 'detect' })).toContain('Couldn’t tell what language this text is in.')
    expect(view({ kind: 'error', reason: 'pair' })).toContain('This browser can’t translate between these languages.')
  })

  it('shows the labels in the reader’s language', () => {
    expect(view({ kind: 'done', source: 'en', texts: ['x'], showing: true }, 'es')).toContain('Traducción automática, puede contener errores')
    expect(view({ kind: 'idle' }, 'zh')).toContain('翻译')
  })
})

describe('TranslateControl', () => {
  it('renders nothing for empty text', () => {
    expect(html(<TranslateControl texts={["   "]} onTranslated={() => {}} supported />)).toBe('')
  })

  it('starts translating by itself instead of waiting for a click', () => {
    const out = html(<TranslateControl texts={["Hay un incendio"]} onTranslated={() => {}} supported />)
    expect(out).toBe('')
  })

  it('shows the button when automatic translation is turned off', () => {
    const out = html(<TranslateControl texts={["Hay un incendio"]} onTranslated={() => {}} supported auto={false} />)
    expect(out).toContain('Translate')
    expect(out).not.toContain('<a ')
  })

  it('without browser support, hides the button and links to an online translator with a privacy note', () => {
    const out = html(<TranslateControl texts={["Hay un incendio"]} onTranslated={() => {}} supported={false} />)
    expect(out).not.toContain('<button')
    expect(out).toContain('This browser can’t translate on its own.')
    expect(out).toContain('translate.google.com')
    expect(out).toContain('This sends the text to a third party.')
  })

  it('opens the online translator in the same tab', () => {
    const out = html(<TranslateControl texts={["Hola"]} onTranslated={() => {}} supported={false} />)
    expect(out).not.toContain('target=')
  })

  it('sends the online translator link the reader’s language', () => {
    const out = html(<TranslateControl texts={["Hola"]} onTranslated={() => {}} supported={false} />, 'vi')
    expect(out).toContain('tl=vi')
  })
})

describe('LanguageMenu', () => {
  it('lists every language in its own name and selects the current one', () => {
    const out = html(<LanguageMenu />, 'es')
    for (const name of ['English', 'Español', 'Tiếng Việt', '中文']) expect(out).toContain(name)
    expect(out).toMatch(/<option[^>]*value="es"[^>]*selected|<option[^>]*selected[^>]*value="es"/)
    expect(out).toContain('aria-label="Idioma"')
  })
})

describe('TranslationBanner', () => {
  const banner = (readiness: 'ready' | 'needs-download' | 'downloading', lang: Language = 'en') =>
    html(<TranslationBannerView readiness={readiness} language="Español" onDownload={() => {}} />, lang)

  it('shows nothing once the language is ready', () => {
    expect(banner('ready')).toBe('')
  })

  it('explains the one-time download and offers a button', () => {
    const out = banner('needs-download')
    expect(out).toContain('download the Español translation once')
    expect(out).toContain('Download translation')
    expect(out).toContain('<button')
  })

  it('shows progress while downloading, with no button', () => {
    const out = banner('downloading')
    expect(out).toContain('Downloading the Español translation')
    expect(out).not.toContain('<button')
  })

  it('is written in the reader’s language', () => {
    expect(banner('needs-download', 'es')).toContain('Descargar traducción')
    expect(banner('needs-download', 'zh')).toContain('下载翻译')
    expect(banner('downloading', 'vi')).toContain('Đang tải bản dịch')
  })

  it('shows nothing before it has checked, in English, or without browser translation', () => {
    expect(html(<TranslationBanner />, 'es')).toBe('')
    expect(html(<TranslationBanner />, 'en')).toBe('')
  })
})
