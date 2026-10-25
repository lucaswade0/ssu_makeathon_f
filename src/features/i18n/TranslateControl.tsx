import { useEffect, useState, useSyncExternalStore } from 'react'
import { Languages as LanguagesIcon } from 'lucide-react'
import { useI18n } from './context'
import { languageLabel, translatorCode } from './languages'
import { bumpTranslationEpoch, getTranslationEpoch, guessLanguage, mainLanguage, onlineTranslatorUrl, subscribeTranslationEpoch, translateToLanguage, translationSupported, type TranslateResult } from './browserTranslate'

export type TranslateErrorReason = 'detect' | 'pair' | 'other'

export type TranslateState =
  | { kind: 'idle' }
  | { kind: 'checking' }
  | { kind: 'working' }
  | { kind: 'done'; source: string; texts: string[]; showing: boolean }
  | { kind: 'same'; source: string; quiet: boolean }
  | { kind: 'needs-download' }
  | { kind: 'error'; reason: TranslateErrorReason }

const errorKey = { detect: 'translate.errorDetect', pair: 'translate.errorPair', other: 'translate.error' } as const

// The buttons and labels for each state, kept apart from the translating so every state can be tested.
export function TranslateView({ state, onRun, onToggle }: { state: TranslateState; onRun: () => void; onToggle: () => void }) {
  const { lang, t } = useI18n()
  // While checking, and when the text is already in the reader's language, there is nothing to show.
  if (state.kind === 'checking' || (state.kind === 'same' && state.quiet)) return null
  return <div className="translate-control">
    {(state.kind === 'idle' || state.kind === 'needs-download' || state.kind === 'error') && <>
      <button type="button" className="translate-button" onClick={onRun}><LanguagesIcon size={14} aria-hidden="true" />{t('translate.button')}</button>
      {state.kind === 'needs-download' && <span className="muted"> {t('translate.needsDownload')}</span>}
      {state.kind === 'error' && <span role="alert" className="error"> {t(errorKey[state.reason])}</span>}
    </>}
    {state.kind === 'working' && <span role="status" className="muted">{t('translate.working')}</span>}
    {state.kind === 'same' && <span role="status" className="muted">{t('translate.same', { language: languageLabel(state.source, lang) })}</span>}
    {state.kind === 'done' && <>
      <span role="status" className="muted">{t('translate.done', { language: languageLabel(state.source, lang) })}</span>{' '}
      <button type="button" className="translate-button" onClick={onToggle}>{state.showing ? t('translate.showOriginal') : t('translate.showTranslation')}</button>
    </>}
  </div>
}

function reasonOf(error: unknown): TranslateErrorReason {
  const message = error instanceof Error ? error.message : ''
  if (message === 'detect-failed') return 'detect'
  if (message === 'pair-unavailable') return 'pair'
  return 'other'
}

/**
 * Translates text into the reader's language. It starts by itself when the page language changes or new text
 * appears, and always labels the result as machine translated with the original one tap away. The page shows
 * `translated` when it is not null and the original otherwise. If the browser still has to download the language (it only
 * allows that after a click), a Translate button is shown instead.
 */
export function TranslateControl({ texts, onTranslated, supported = translationSupported(), auto = true }: {
  /** One or more pieces of text, such as a title and its paragraphs. They come back in the same order. */
  texts: string[]
  onTranslated: (translated: string[] | null) => void
  supported?: boolean
  auto?: boolean
}) {
  const { lang, t } = useI18n()
  const joined = texts.join('\n\n')
  const hasText = joined.trim().length > 0
  const epoch = useSyncExternalStore(subscribeTranslationEpoch, getTranslationEpoch, () => 0)
  const [state, setState] = useState<TranslateState>(supported && auto ? { kind: 'checking' } : { kind: 'idle' })

  function apply(result: TranslateResult, quiet: boolean) {
    if (result.kind === 'same') { setState({ kind: 'same', source: result.source, quiet }); onTranslated(null) }
    else if (result.kind === 'needs-download') { setState({ kind: 'needs-download' }); onTranslated(null) }
    else { setState({ kind: 'done', source: result.source, texts: result.texts, showing: true }); onTranslated(result.texts) }
  }

  // In automatic mode, text whose language can't be told (one word, an emoji) is simply left alone instead of showing an error.
  function fail(error: unknown, automatic = false) {
    const reason = reasonOf(error)
    if (reason === 'other') console.warn('Translation failed:', error)
    setState(automatic && reason === 'detect' ? { kind: 'same', source: '', quiet: true } : { kind: 'error', reason })
    onTranslated(null)
  }

  useEffect(() => {
    if (!supported || !auto || !hasText) return
    let cancelled = false
    onTranslated(null)
    setState({ kind: 'checking' })
    translateToLanguage(texts, lang, { onTranslating: () => { if (!cancelled) setState({ kind: 'working' }) } })
      .then(result => { if (!cancelled) apply(result, true) })
      .catch(error => { if (!cancelled) fail(error, true) })
    return () => { cancelled = true }
    // apply, fail and onTranslated only set state, so they never need to restart the translation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [joined, lang, epoch, supported, auto])

  if (!hasText) return null

  if (!supported) {
    // Text already in the reader's language needs no translator link.
    const guessed = guessLanguage(joined)
    if (guessed && mainLanguage(guessed) === translatorCode[lang]) return null
    return <p className="translate-control">
      <span>{t('translate.unsupported')}</span>{' '}
      <a href={onlineTranslatorUrl(joined, lang)}>{t('translate.online')}</a>
      <span className="muted"> {t('translate.onlineNote')}</span>
    </p>
  }

  async function run() {
    setState({ kind: 'working' })
    try {
      const result = await translateToLanguage(texts, lang, { allowDownload: true })
      apply(result, false)
      // The language has downloaded now, so other texts waiting for it can translate by themselves.
      if (result.kind === 'translated') bumpTranslationEpoch()
    }
    catch (error) { fail(error) }
  }

  function toggle() {
    if (state.kind !== 'done') return
    setState({ ...state, showing: !state.showing })
    onTranslated(state.showing ? null : state.texts)
  }

  return <TranslateView state={state} onRun={() => void run()} onToggle={toggle} />
}
