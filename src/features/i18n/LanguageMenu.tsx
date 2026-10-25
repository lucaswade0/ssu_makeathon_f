import { useRef } from 'react'
import { Languages as LanguagesIcon } from 'lucide-react'
import { primeTranslation } from './browserTranslate'
import { useI18n } from './context'
import { isLanguage, languageNames, languages } from './languages'

// Each option is written in its own language so a person can find theirs without reading English.
export function LanguageMenu() {
  const { lang, setLang, t } = useI18n()
  // A mouse choice lets go of focus so no focus ring lingers on the menu. Keyboard users keep their place.
  const usedPointer = useRef(false)
  return <label className="language-menu">
    <LanguagesIcon size={18} aria-hidden="true" />
    <select aria-label={t('language.label')} value={lang}
      onPointerDown={() => { usedPointer.current = true }}
      onKeyDown={() => { usedPointer.current = false }}
      onChange={event => {
      const next = event.target.value
      if (!isLanguage(next)) return
      setLang(next)
      // Choosing a language is a click, which is when the browser allows its translation model to download.
      void primeTranslation(next)
      if (usedPointer.current) event.target.blur()
    }}>
      {languages.map(code => <option key={code} value={code} lang={code}>{languageNames[code]}</option>)}
    </select>
  </label>
}
