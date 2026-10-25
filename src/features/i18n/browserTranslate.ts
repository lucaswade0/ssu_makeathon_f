import { translatorCode, type Language } from './languages'

// The browser's built-in Translator and LanguageDetector run on the device: no server, no key, and the text is not
// sent anywhere. They exist only in recent desktop Chrome, and TypeScript has no types for them yet.
type TranslatorInstance = { translate(text: string): Promise<string> }
type TranslatorStatic = {
  availability(options: { sourceLanguage: string; targetLanguage: string }): Promise<string>
  create(options: { sourceLanguage: string; targetLanguage: string }): Promise<TranslatorInstance>
}
type DetectorInstance = { detect(text: string): Promise<{ detectedLanguage: string; confidence: number }[]> }
type DetectorStatic = { availability(): Promise<string>; create(): Promise<DetectorInstance> }

type BrowserScope = { Translator?: TranslatorStatic; LanguageDetector?: DetectorStatic }
const scope = () => globalThis as unknown as BrowserScope

// Only the translator is required. Chrome often has it without the language detector, so detection falls back to a
// built-in guess for the languages this app supports.
export function translationSupported(): boolean {
  return Boolean(scope().Translator)
}

const MIN_CONFIDENCE = 0.5
const translators = new Map<string, Promise<TranslatorInstance>>()
const results = new Map<string, string>()
const pending = new Map<string, Promise<string>>()
let detector: Promise<DetectorInstance | null> | null = null
let queue: Promise<unknown> = Promise.resolve()

export function clearTranslationCache() {
  translators.clear()
  results.clear()
  pending.clear()
  detector = null
  queue = Promise.resolve()
}

// The main part of a language tag: "es-MX" is "es".
export const mainLanguage = (tag: string) => tag.toLowerCase().split('-')[0]!

// ---------- Language guess, used when the browser has no language detector ----------

const VIETNAMESE = /[ăđơưĂĐƠƯ]|[ạảấầẩẫậắằẳẵặẹẻẽếềểễệỉịọỏốồổỗộớờởỡợụủứừửữựỳỵỷỹ]/i
const CJK = /[㐀-鿿]/
const SPANISH_MARKS = /[ñ¿¡]/i
const SPANISH_WORDS = new Set(['el', 'la', 'los', 'las', 'de', 'del', 'que', 'y', 'en', 'un', 'una', 'por', 'con', 'para', 'es', 'está', 'están', 'hay', 'no', 'se', 'mi', 'su', 'al', 'muy', 'pero', 'como', 'más', 'qué', 'cómo', 'dónde', 'estoy', 'tengo', 'necesito', 'casa', 'agua', 'fuego', 'incendio', 'ayuda', 'por favor', 'hola', 'gracias', 'vecinos', 'calle'])
const FRENCH_WORDS = new Set(['le', 'les', 'des', 'une', 'est', 'sont', 'dans', 'pour', 'avec', 'pas', 'qui', 'je', 'nous', 'vous', 'il', 'besoin', 'aide', 'près', 'chez', 'moi', 'incendie', 'merci', 'suis', 'très', 'mais', 'sur'])
const PORTUGUESE_WORDS = new Set(['os', 'um', 'uma', 'é', 'está', 'são', 'em', 'no', 'na', 'para', 'com', 'não', 'eu', 'nós', 'você', 'há', 'perto', 'minha', 'preciso', 'ajuda', 'incêndio', 'obrigado', 'mas', 'muito'])
const ENGLISH_WORDS = new Set(['the', 'and', 'is', 'are', 'to', 'of', 'in', 'for', 'on', 'with', 'this', 'that', 'it', 'my', 'we', 'you', 'have', 'has', 'not', 'there', 'please', 'do', 'be', 'at', 'from', 'all', 'will', 'can', 'i', 'if', 'was', 'our', 'your', 'out', 'just', 'road', 'fire', 'help', 'water'])

/**
 * A best guess at which language a text is in, or null when it can't tell. It knows the app's four languages and also
 * French and Portuguese, so those posts aren't mistaken for Spanish and translated into nonsense.
 */
export function guessLanguage(text: string): string | null {
  if (CJK.test(text)) return 'zh'
  if (VIETNAMESE.test(text)) return 'vi'
  if (SPANISH_MARKS.test(text)) return 'es'
  if (/[ãõ]/i.test(text)) return 'pt'
  const words = text.toLowerCase().match(/\p{L}+/gu) ?? []
  const scores: [string, number][] = [['en', 0], ['es', 0], ['fr', 0], ['pt', 0]]
  for (const word of words) {
    if (ENGLISH_WORDS.has(word)) scores[0]![1]++
    if (SPANISH_WORDS.has(word)) scores[1]![1]++
    if (FRENCH_WORDS.has(word)) scores[2]![1]++
    if (PORTUGUESE_WORDS.has(word)) scores[3]![1]++
  }
  // Ties go to the earlier language in the list above (English first).
  const best = scores.reduce((top, next) => (next[1] > top[1] ? next : top))
  return best[1] > 0 ? best[0] : null
}

async function getDetector(): Promise<DetectorInstance | null> {
  const { LanguageDetector } = scope()
  if (!LanguageDetector) return null
  detector ??= (async () => {
    try { return (await LanguageDetector.availability()) === 'available' ? await LanguageDetector.create() : null }
    catch { return null }
  })()
  return detector
}

/** The language of a piece of text, or null when neither the browser nor the built-in guess is sure. */
export async function detectSource(text: string): Promise<string | null> {
  const instance = await getDetector()
  if (instance) {
    try {
      const [best] = await instance.detect(text)
      if (best && best.confidence >= MIN_CONFIDENCE && best.detectedLanguage !== 'und') return best.detectedLanguage
    } catch { /* Fall through to the guess. */ }
  }
  return guessLanguage(text)
}

// ---------- Translating ----------

// One translation at a time, so a long feed doesn't ask the browser for dozens at once.
function inQueue<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(task, task)
  queue = run.then(() => undefined, () => undefined)
  return run
}

const pairKey = (source: string, target: string) => `${mainLanguage(source)}>${target}`

/** 'available', 'downloadable', 'downloading', or 'unavailable'. Anything but available needs a click to download. */
export async function translatorStatus(source: string, target: Language): Promise<string> {
  const { Translator } = scope()
  if (!Translator) throw new Error('unsupported')
  return Translator.availability({ sourceLanguage: mainLanguage(source), targetLanguage: translatorCode[target] })
}

export async function translateText(text: string, source: string, target: Language): Promise<string> {
  const { Translator } = scope()
  if (!Translator) throw new Error('unsupported')
  const options = { sourceLanguage: mainLanguage(source), targetLanguage: translatorCode[target] }
  const cacheKey = `${pairKey(source, translatorCode[target])}:${text}`
  const hit = results.get(cacheKey)
  if (hit !== undefined) return hit
  const inFlight = pending.get(cacheKey)
  if (inFlight) return inFlight

  const job = inQueue(async () => {
    const pair = pairKey(source, translatorCode[target])
    let translator = translators.get(pair)
    if (!translator) {
      if ((await Translator.availability(options)) === 'unavailable') throw new Error('pair-unavailable')
      translator = Translator.create(options)
      translators.set(pair, translator)
      // A failed setup (for example a declined model download) must not be remembered.
      translator.catch(() => translators.delete(pair))
    }
    const translated = await (await translator).translate(text)
    results.set(cacheKey, translated)
    return translated
  })
  pending.set(cacheKey, job)
  job.then(() => pending.delete(cacheKey), () => pending.delete(cacheKey))
  return job
}

export type TranslateResult =
  | { kind: 'same'; source: string }
  | { kind: 'needs-download'; source: string }
  | { kind: 'translated'; source: string; texts: string[] }

type TranslateOptions = {
  /** True when a person just clicked: the browser only lets a language model download after a click. */
  allowDownload?: boolean
  /** Called once the text is known to need translating, so the page can show "Translating…". */
  onTranslating?: () => void
}

/**
 * Works out the language of the text, then translates it unless it is already in the target language. Several pieces
 * of text (a title and its paragraphs) are translated one by one, so the translator can't merge them together.
 */
export async function translateToLanguage(texts: string[], target: Language, { allowDownload = false, onTranslating }: TranslateOptions = {}): Promise<TranslateResult> {
  const source = await detectSource(texts.join('\n\n'))
  if (!source) throw new Error('detect-failed')
  if (mainLanguage(source) === translatorCode[target]) return { kind: 'same', source }
  const allCached = texts.every(text => results.has(`${pairKey(source, translatorCode[target])}:${text}`))
  if (!allCached) {
    const status = await translatorStatus(source, target)
    if (status === 'unavailable') throw new Error('pair-unavailable')
    if (status !== 'available' && !allowDownload) return { kind: 'needs-download', source }
  }
  onTranslating?.()
  const translated: string[] = []
  for (const text of texts) translated.push(text.trim() ? await translateText(text, source, target) : text)
  return { kind: 'translated', source, texts: translated }
}

// ---------- Getting the language ready ----------

let epoch = 0
const listeners = new Set<() => void>()

/** Changes whenever a language finished downloading, so pages waiting on it can try again. */
export const getTranslationEpoch = () => epoch
export function bumpTranslationEpoch() {
  epoch++
  listeners.forEach(listener => listener())
}
export function subscribeTranslationEpoch(listener: () => void) {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

/**
 * Starts the download of the English-to-this-language model. Call it from a click (choosing a language), because the
 * browser only allows downloads after a click. Failures are fine: each text still offers a Translate button.
 */
export async function primeTranslation(target: Language): Promise<void> {
  const { Translator } = scope()
  if (!Translator || target === 'en') return
  priming = true
  bumpTranslationEpoch()
  try {
    await Translator.create({ sourceLanguage: 'en', targetLanguage: translatorCode[target] })
  } catch { /* The Translate button on each text can try again. */ }
  priming = false
  bumpTranslationEpoch()
}

let priming = false
/** True while a language is downloading because of primeTranslation. */
export const isPriming = () => priming

export type Readiness = 'ready' | 'needs-download' | 'downloading'

/** What the page should tell the reader about the English-to-reader-language model. */
export function readinessFromStatus(status: string, busy: boolean): Readiness {
  if (busy || status === 'downloading') return 'downloading'
  return status === 'downloadable' ? 'needs-download' : 'ready'
}

const MAX_LINK_CHARS = 1500

// For browsers without the built-in translator. Opening this sends the text to a third party.
export function onlineTranslatorUrl(text: string, target: Language): string {
  const params = new URLSearchParams({ sl: 'auto', tl: translatorCode[target], text: text.slice(0, MAX_LINK_CHARS), op: 'translate' })
  return `https://translate.google.com/?${params}`
}
