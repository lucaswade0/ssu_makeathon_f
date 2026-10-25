import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { bumpTranslationEpoch, clearTranslationCache, detectSource, getTranslationEpoch, guessLanguage, isPriming, readinessFromStatus, mainLanguage, onlineTranslatorUrl, primeTranslation, subscribeTranslationEpoch, translateText, translateToLanguage, translationSupported } from './browserTranslate'

type Fake = Record<string, unknown>
const scope = globalThis as unknown as Fake

type Setup = {
  detected?: { detectedLanguage: string; confidence: number }[]
  detector?: 'available' | 'unavailable' | 'none'
  availability?: string
  translate?: (text: string) => Promise<string>
}

function installBrowser({ detected = [{ detectedLanguage: 'es', confidence: 0.99 }], detector = 'available', availability = 'available', translate = async (text: string) => `[${text}]` }: Setup = {}) {
  const create = vi.fn(async () => ({ translate: vi.fn(translate) }))
  scope.Translator = { availability: vi.fn(async () => availability), create }
  if (detector === 'none') delete scope.LanguageDetector
  else scope.LanguageDetector = { availability: vi.fn(async () => detector), create: vi.fn(async () => ({ detect: vi.fn(async () => detected) })) }
  return { create }
}

beforeEach(() => clearTranslationCache())
afterEach(() => { delete scope.Translator; delete scope.LanguageDetector })

describe('support', () => {
  it('reports no support when the browser has no translator', () => {
    expect(translationSupported()).toBe(false)
  })

  it('needs only the translator, because the detector is often missing', () => {
    installBrowser({ detector: 'none' })
    expect(translationSupported()).toBe(true)
  })

  it('refuses to translate without the API', async () => {
    await expect(translateText('hola', 'es', 'en')).rejects.toThrow('unsupported')
  })
})

describe('guessLanguage', () => {
  it('recognizes Chinese by its characters', () => expect(guessLanguage('附近有火灾，请注意安全')).toBe('zh'))
  it('recognizes Vietnamese by its letters', () => expect(guessLanguage('Cháy rừng gần nhà tôi, xin hãy cẩn thận')).toBe('vi'))
  it('recognizes Spanish by its marks', () => expect(guessLanguage('¿Alguien sabe dónde hay agua?')).toBe('es'))
  it('recognizes Spanish by its common words', () => expect(guessLanguage('Hay un incendio cerca de la casa')).toBe('es'))
  it('recognizes English by its common words', () => expect(guessLanguage('Packed the car just in case. Neighbors are doing the same.')).toBe('en'))
  it('prefers English when the words are mostly English', () => expect(guessLanguage('The road is closed at Maple, no through traffic')).toBe('en'))
  it('recognizes French, so it is not mistaken for Spanish', () => {
    expect(guessLanguage('Il y a un incendie près de chez moi, nous avons besoin d’aide.')).toBe('fr')
    expect(guessLanguage('Merci pour votre aide, la route est fermée')).toBe('fr')
  })
  it('recognizes Portuguese, so it is not mistaken for Spanish', () => {
    expect(guessLanguage('Há um incêndio perto da minha casa, preciso de ajuda.')).toBe('pt')
    expect(guessLanguage('Não temos água em casa')).toBe('pt')
  })
  it('keeps Spanish as Spanish', () => {
    expect(guessLanguage('Necesito ayuda por favor, hay un incendio cerca')).toBe('es')
  })
  it('says it does not know for text with no recognizable words', () => {
    expect(guessLanguage('')).toBeNull()
    expect(guessLanguage('12345 !!!')).toBeNull()
    expect(guessLanguage('xqz wvk')).toBeNull()
  })
})

describe('detectSource', () => {
  it('uses the browser detector when it is available and confident', async () => {
    installBrowser({ detected: [{ detectedLanguage: 'fr', confidence: 0.9 }] })
    expect(await detectSource('Il y a un incendie')).toBe('fr')
  })

  it('falls back to the built-in guess when the detector is unavailable', async () => {
    installBrowser({ detector: 'unavailable' })
    expect(await detectSource('Hay un incendio cerca de la casa')).toBe('es')
  })

  it('falls back to the built-in guess when there is no detector at all', async () => {
    installBrowser({ detector: 'none' })
    expect(await detectSource('Packed the car just in case')).toBe('en')
  })

  it('falls back to the guess when the detector is unsure', async () => {
    installBrowser({ detected: [{ detectedLanguage: 'fr', confidence: 0.2 }] })
    expect(await detectSource('Hay un incendio cerca de la casa')).toBe('es')
  })

  it('returns null when nothing is sure', async () => {
    installBrowser({ detector: 'unavailable' })
    expect(await detectSource('xqz wvk')).toBeNull()
  })
})

describe('translateToLanguage', () => {
  it('translates Spanish into English even though the detector is unavailable', async () => {
    installBrowser({ detector: 'unavailable' })
    expect(await translateToLanguage(['Hay un incendio cerca de la casa'], 'en')).toEqual({ kind: 'translated', source: 'es', texts: ['[Hay un incendio cerca de la casa]'] })
  })

  it('translates English posts into the other languages', async () => {
    installBrowser({ detector: 'none' })
    for (const target of ['es', 'vi', 'zh'] as const) {
      expect((await translateToLanguage(['Packed the car just in case'], target)).kind).toBe('translated')
    }
  })

  it('does not translate text that is already in the target language', async () => {
    installBrowser({ detected: [{ detectedLanguage: 'en', confidence: 0.98 }] })
    expect(await translateToLanguage(['Fire nearby'], 'en')).toEqual({ kind: 'same', source: 'en' })
  })

  it('treats a regional tag as the same language', async () => {
    installBrowser({ detected: [{ detectedLanguage: 'es-MX', confidence: 0.9 }] })
    expect((await translateToLanguage(['Hola'], 'es')).kind).toBe('same')
  })

  it('fails with a clear reason when the language cannot be told', async () => {
    installBrowser({ detector: 'unavailable' })
    await expect(translateToLanguage(['xqz wvk'], 'en')).rejects.toThrow('detect-failed')
  })

  it('fails with a clear reason when the language pair is unavailable', async () => {
    installBrowser({ availability: 'unavailable' })
    await expect(translateToLanguage(['Hay un incendio cerca de la casa'], 'en')).rejects.toThrow('pair-unavailable')
  })

  it('does not download a language model without a click', async () => {
    const { create } = installBrowser({ availability: 'downloadable' })
    expect(await translateToLanguage(['Hay un incendio cerca de la casa'], 'en')).toEqual({ kind: 'needs-download', source: 'es' })
    expect(create).not.toHaveBeenCalled()
  })

  it('downloads and translates after a click', async () => {
    installBrowser({ availability: 'downloadable' })
    expect((await translateToLanguage(['Hay un incendio cerca de la casa'], 'en', { allowDownload: true })).kind).toBe('translated')
  })

  it('reports when translation starts only if the text needs translating', async () => {
    installBrowser()
    const started = vi.fn()
    await translateToLanguage(['Hay un incendio cerca de la casa'], 'en', { onTranslating: started })
    expect(started).toHaveBeenCalledTimes(1)
    started.mockClear()
    clearTranslationCache()
    installBrowser({ detected: [{ detectedLanguage: 'en', confidence: 0.99 }] })
    await translateToLanguage(['The road is closed at Maple'], 'en', { onTranslating: started })
    expect(started).not.toHaveBeenCalled()
  })

  it('translates a title and paragraphs one by one so they stay separate', async () => {
    installBrowser()
    const result = await translateToLanguage(['Orden de evacuación', 'Salga ahora', 'Lleve a sus mascotas'], 'en')
    expect(result).toEqual({ kind: 'translated', source: 'es', texts: ['[Orden de evacuación]', '[Salga ahora]', '[Lleve a sus mascotas]'] })
  })

  it('keeps empty pieces of text as they are', async () => {
    installBrowser()
    expect(await translateToLanguage(['Hay un incendio cerca de la casa', ''], 'en')).toMatchObject({ texts: ['[Hay un incendio cerca de la casa]', ''] })
  })

  it('translates from cache without asking about the model again', async () => {
    installBrowser()
    await translateToLanguage(['Hay un incendio cerca de la casa'], 'en')
    ;(scope.Translator as { availability: ReturnType<typeof vi.fn> }).availability.mockResolvedValue('downloadable')
    expect((await translateToLanguage(['Hay un incendio cerca de la casa'], 'en')).kind).toBe('translated')
  })
})

describe('translateText', () => {
  it('translates the same text only once', async () => {
    const translate = vi.fn(async (text: string) => `[${text}]`)
    installBrowser({ translate })
    await translateText('Hola', 'es', 'en')
    await translateText('Hola', 'es', 'en')
    expect(translate).toHaveBeenCalledTimes(1)
  })

  it('shares one request between identical texts asked for at the same time', async () => {
    const translate = vi.fn(async (text: string) => `[${text}]`)
    installBrowser({ translate })
    const results = await Promise.all([translateText('Hola', 'es', 'en'), translateText('Hola', 'es', 'en')])
    expect(results).toEqual(['[Hola]', '[Hola]'])
    expect(translate).toHaveBeenCalledTimes(1)
  })

  it('translates one text at a time', async () => {
    let active = 0
    let peak = 0
    installBrowser({ translate: async text => { active++; peak = Math.max(peak, active); await new Promise(r => setTimeout(r, 5)); active--; return `[${text}]` } })
    await Promise.all(['uno', 'dos', 'tres', 'cuatro'].map(text => translateText(text, 'es', 'en')))
    expect(peak).toBe(1)
  })

  it('creates one translator per language pair', async () => {
    const { create } = installBrowser()
    await translateText('Hola', 'es', 'en')
    await translateText('Adiós', 'es', 'en')
    await translateText('Hola', 'es', 'zh')
    expect(create).toHaveBeenCalledTimes(2)
  })

  it('does not remember a translator that failed to start', async () => {
    const create = vi.fn().mockRejectedValueOnce(new Error('download declined')).mockResolvedValue({ translate: async (text: string) => `[${text}]` })
    scope.Translator = { availability: async () => 'downloadable', create }
    await expect(translateText('Hola', 'es', 'en')).rejects.toThrow('download declined')
    expect(await translateText('Hola', 'es', 'en')).toBe('[Hola]')
  })

  it('keeps going after one translation fails', async () => {
    let calls = 0
    installBrowser({ translate: async text => { if (calls++ === 0) throw new Error('boom'); return `[${text}]` } })
    await expect(translateText('uno', 'es', 'en')).rejects.toThrow('boom')
    expect(await translateText('dos', 'es', 'en')).toBe('[dos]')
  })
})

describe('primeTranslation', () => {
  it('starts the English-to-language download', async () => {
    const { create } = installBrowser()
    await primeTranslation('es')
    expect(create).toHaveBeenCalledWith({ sourceLanguage: 'en', targetLanguage: 'es' })
  })

  it('does nothing for English or without the API', async () => {
    const { create } = installBrowser()
    await primeTranslation('en')
    expect(create).not.toHaveBeenCalled()
    delete scope.Translator
    await expect(primeTranslation('es')).resolves.toBeUndefined()
  })

  it('tells waiting pages to try again, even when the download fails', async () => {
    scope.Translator = { availability: async () => 'downloadable', create: vi.fn().mockRejectedValue(new Error('declined')) }
    const listener = vi.fn()
    const stop = subscribeTranslationEpoch(listener)
    const before = getTranslationEpoch()
    await primeTranslation('zh')
    // Once when the download starts and once when it ends.
    expect(listener).toHaveBeenCalledTimes(2)
    expect(getTranslationEpoch()).toBe(before + 2)
    stop()
    await primeTranslation('zh')
    expect(listener).toHaveBeenCalledTimes(2)
  })
})

describe('helpers', () => {
  it('reads the main part of a language tag', () => {
    expect(mainLanguage('ES-mx')).toBe('es')
    expect(mainLanguage('zh')).toBe('zh')
  })

  it('builds an online translator link for browsers without support', () => {
    const url = new URL(onlineTranslatorUrl('Hay un incendio', 'zh'))
    expect(url.origin).toBe('https://translate.google.com')
    expect(url.searchParams.get('tl')).toBe('zh')
    expect(url.searchParams.get('text')).toBe('Hay un incendio')
  })

  it('caps very long text in the link', () => {
    const url = new URL(onlineTranslatorUrl('a'.repeat(5000), 'en'))
    expect(url.searchParams.get('text')!.length).toBe(1500)
  })
})

describe('download readiness', () => {
  it('maps the browser status to what the page should say', () => {
    expect(readinessFromStatus('available', false)).toBe('ready')
    expect(readinessFromStatus('downloadable', false)).toBe('needs-download')
    expect(readinessFromStatus('downloading', false)).toBe('downloading')
    expect(readinessFromStatus('unavailable', false)).toBe('ready')
    expect(readinessFromStatus('', false)).toBe('ready')
  })

  it('says downloading while a download that we started is running', () => {
    expect(readinessFromStatus('downloadable', true)).toBe('downloading')
  })

  it('is busy only while a download runs', async () => {
    let finish: (value: { translate: (text: string) => Promise<string> }) => void = () => {}
    scope.Translator = { availability: async () => 'downloadable', create: () => new Promise(resolve => { finish = resolve }) }
    expect(isPriming()).toBe(false)
    const running = primeTranslation('es')
    expect(isPriming()).toBe(true)
    finish({ translate: async text => text })
    await running
    expect(isPriming()).toBe(false)
  })
})

describe('translation epoch', () => {
  it('tells waiting pages to try again when asked, and stops after unsubscribing', () => {
    const listener = vi.fn()
    const stop = subscribeTranslationEpoch(listener)
    const before = getTranslationEpoch()
    bumpTranslationEpoch()
    expect(listener).toHaveBeenCalledTimes(1)
    expect(getTranslationEpoch()).toBe(before + 1)
    stop()
    bumpTranslationEpoch()
    expect(listener).toHaveBeenCalledTimes(1)
  })
})
