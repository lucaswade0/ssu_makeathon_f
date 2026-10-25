import { describe, expect, it } from 'vitest'
import { dateLocale, detectLanguage, htmlLang, isLanguage, languageLabel, languageNames, languages, translatorCode } from './languages'

describe('detectLanguage', () => {
  it('uses the main part of the browser language', () => {
    expect(detectLanguage(['es-MX'])).toBe('es')
    expect(detectLanguage(['zh-TW'])).toBe('zh')
    expect(detectLanguage(['vi'])).toBe('vi')
    expect(detectLanguage(['EN-us'])).toBe('en')
  })

  it('takes the first supported language in the browser’s order', () => {
    expect(detectLanguage(['fr-FR', 'es-ES', 'en-US'])).toBe('es')
  })

  it('falls back to English for unsupported, empty, or missing languages', () => {
    expect(detectLanguage(['fr', 'de'])).toBe('en')
    expect(detectLanguage([])).toBe('en')
    expect(detectLanguage(undefined)).toBe('en')
  })
})

describe('language list', () => {
  it('has a native name, html code, and translator code for every language', () => {
    for (const code of languages) {
      expect(languageNames[code]).toBeTruthy()
      expect(htmlLang[code]).toBeTruthy()
      expect(translatorCode[code]).toBeTruthy()
    }
  })

  it('shows each language in its own name', () => {
    expect(languageNames).toEqual({ en: 'English', es: 'Español', vi: 'Tiếng Việt', zh: '中文' })
  })

  it('defaults Chinese to Simplified', () => {
    expect(htmlLang.zh).toBe('zh-Hans')
  })

  it('recognizes only supported codes', () => {
    expect(isLanguage('es')).toBe(true)
    expect(isLanguage('fr')).toBe(false)
    expect(isLanguage(undefined)).toBe(false)
    expect(isLanguage(7)).toBe(false)
  })

  it('names a language in the reader’s language, and never throws on a bad code', () => {
    expect(languageLabel('es', 'en')).toBe('Spanish')
    expect(languageLabel('not a real code!!', 'en')).toBeTruthy()
  })
})

describe('dateLocale', () => {
  it('keeps the browser format for English and uses the language for the others', () => {
    expect(dateLocale('en')).toBeUndefined()
    expect(dateLocale('es')).toBe('es')
    expect(dateLocale('zh')).toBe('zh-Hans')
  })
})
