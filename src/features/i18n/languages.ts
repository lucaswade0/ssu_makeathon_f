export const languages = ['en', 'es', 'vi', 'zh'] as const
export type Language = (typeof languages)[number]

// Each language is shown in its own name so people can find theirs without reading English.
export const languageNames: Record<Language, string> = {
  en: 'English',
  es: 'Español',
  vi: 'Tiếng Việt',
  zh: '中文',
}

// Chinese defaults to Simplified. Switch to 'zh-Hant' here if the team prefers Traditional.
export const htmlLang: Record<Language, string> = { en: 'en', es: 'es', vi: 'vi', zh: 'zh-Hans' }

// Codes for the browser Translator API.
export const translatorCode: Record<Language, string> = { en: 'en', es: 'es', vi: 'vi', zh: 'zh' }

// The locale for dates and times. English keeps the browser's own format; other languages use their own.
export function dateLocale(lang: Language): string | undefined {
  return lang === 'en' ? undefined : htmlLang[lang]
}

export function isLanguage(value: unknown): value is Language {
  return typeof value === 'string' && (languages as readonly string[]).includes(value)
}

// Picks the first browser language we support, comparing only the main part ("es-MX" is Spanish).
export function detectLanguage(browserLanguages: readonly string[] | undefined): Language {
  for (const tag of browserLanguages ?? []) {
    const main = tag.toLowerCase().split('-')[0]
    if (isLanguage(main)) return main
  }
  return 'en'
}

// A language's name in the language the person is reading, for "Translated from Spanish".
export function languageLabel(code: string, uiLanguage: Language): string {
  try {
    return new Intl.DisplayNames([htmlLang[uiLanguage]], { type: 'language' }).of(code) ?? code
  } catch {
    return code
  }
}
