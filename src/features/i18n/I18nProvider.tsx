import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { primeTranslation } from './browserTranslate'
import { I18nContext, makeI18n } from './context'
import { detectLanguage, htmlLang, isLanguage, type Language } from './languages'

const STORAGE_KEY = 'safety-sam-language'

// Only a language code is remembered on this device. Reads and writes can fail (private windows, blocked storage).
function readStored(): Language | null {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY)
    return isLanguage(value) ? value : null
  } catch {
    return null
  }
}

function initialLanguage(): Language {
  return readStored() ?? detectLanguage(typeof navigator === 'undefined' ? [] : navigator.languages)
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Language>(initialLanguage)

  const setLang = useCallback((next: Language) => {
    setLangState(next)
    try { window.localStorage.setItem(STORAGE_KEY, next) } catch { /* The choice just won't be remembered. */ }
  }, [])

  useEffect(() => {
    document.documentElement.lang = htmlLang[lang]
  }, [lang])

  // A saved language skips the click that normally starts the model download, so the first click on the page does it.
  useEffect(() => {
    if (lang === 'en') return
    const start = () => { void primeTranslation(lang) }
    // A completed click (not the press) is what the browser accepts as permission to download.
    document.addEventListener('click', start, { once: true, capture: true })
    document.addEventListener('keydown', start, { once: true, capture: true })
    return () => { document.removeEventListener('click', start, true); document.removeEventListener('keydown', start, true) }
  }, [lang])

  const value = useMemo(() => makeI18n(lang, setLang), [lang, setLang])
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}
