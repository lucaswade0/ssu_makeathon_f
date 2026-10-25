import { createContext, useContext } from 'react'
import type { Language } from './languages'
import { messages, type MessageKey, type PluralBase } from './messages'

export type Vars = Record<string, string | number>

// Fills {placeholders}. A missing key or variable never breaks the page: it falls back to English, then to the key.
export function translate(lang: Language, key: MessageKey, vars?: Vars): string {
  const text = messages[lang][key] ?? messages.en[key] ?? key
  return vars ? text.replace(/\{(\w+)\}/g, (match, name: string) => (name in vars ? String(vars[name]) : match)) : text
}

export type I18n = {
  lang: Language
  setLang: (lang: Language) => void
  t: (key: MessageKey, vars?: Vars) => string
  /** Plural form by count: uses "<base>.one" for 1 and "<base>.other" otherwise, with {n} filled in. */
  tp: (base: PluralBase, count: number, vars?: Vars) => string
}

export function makeI18n(lang: Language, setLang: (lang: Language) => void): I18n {
  return {
    lang,
    setLang,
    t: (key, vars) => translate(lang, key, vars),
    tp: (base, count, vars) => translate(lang, `${base}.${count === 1 ? 'one' : 'other'}` as MessageKey, { n: count, ...vars }),
  }
}

// Without a provider (in tests, for example) everything is English.
export const I18nContext = createContext<I18n>(makeI18n('en', () => {}))

export function useI18n() {
  return useContext(I18nContext)
}
