import { useState } from 'react'
import { useI18n } from './context'
import { htmlLang } from './languages'
import { TranslateControl } from './TranslateControl'

// A paragraph of user-written or agency text with a Translate button under it. The original stays one tap away.
export function TranslatableText({ text, className }: { text: string; className?: string }) {
  const { lang } = useI18n()
  const [translated, setTranslated] = useState<string | null>(null)
  // Marking the translated text with its language lets screen readers pronounce it correctly.
  return <>
    <p className={className} lang={translated === null ? undefined : htmlLang[lang]}>{translated ?? text}</p>
    <TranslateControl texts={[text]} onTranslated={result => setTranslated(result?.[0] ?? null)} />
  </>
}
