import { useEffect, useState, useSyncExternalStore } from 'react'
import { Languages as LanguagesIcon } from 'lucide-react'
import { getTranslationEpoch, isPriming, primeTranslation, readinessFromStatus, subscribeTranslationEpoch, translationSupported, translatorStatus, type Readiness } from './browserTranslate'
import { useI18n } from './context'
import { languageNames } from './languages'

// The browser only downloads a translation language after a click, so until then posts and alerts stay in their own language.
// This says so plainly and gives one button that fixes it for every text on the page.
export function TranslationBannerView({ readiness, language, onDownload }: { readiness: Readiness; language: string; onDownload: () => void }) {
  const { t } = useI18n()
  if (readiness === 'ready') return null
  return <div className="translation-banner" role="status">
    <LanguagesIcon size={18} aria-hidden="true" />
    {readiness === 'downloading'
      ? <span>{t('translate.bannerWorking', { language })}</span>
      : <>
        <span>{t('translate.bannerNeeded', { language })}</span>
        <button type="button" onClick={onDownload}>{t('translate.bannerButton')}</button>
      </>}
  </div>
}

export function TranslationBanner() {
  const { lang } = useI18n()
  const epoch = useSyncExternalStore(subscribeTranslationEpoch, getTranslationEpoch, () => 0)
  const [checked, setChecked] = useState<{ lang: string; status: string } | null>(null)
  const relevant = translationSupported() && lang !== 'en'
  const busy = isPriming()

  useEffect(() => {
    if (!relevant || busy) return
    let cancelled = false
    translatorStatus('en', lang)
      .then(status => { if (!cancelled) setChecked({ lang, status }) })
      .catch(() => { if (!cancelled) setChecked(null) })
    return () => { cancelled = true }
  }, [lang, epoch, relevant, busy])

  const status = checked?.lang === lang ? checked.status : ''
  const readiness: Readiness = !relevant ? 'ready' : readinessFromStatus(status, busy)

  return <TranslationBannerView readiness={readiness} language={languageNames[lang]} onDownload={() => void primeTranslation(lang)} />
}
