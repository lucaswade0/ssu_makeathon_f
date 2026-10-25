import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { I18nContext, makeI18n } from '../i18n/context'
import type { Language } from '../i18n/languages'
import { PostTypeTag } from './PostTypeTag'
import type { PostType } from './schemas'

const html = (type: PostType, lang: Language = 'en') =>
  renderToString(<I18nContext.Provider value={makeI18n(lang, () => {})}><PostTypeTag type={type} /></I18nContext.Provider>).replaceAll('<!-- -->', '')

describe('PostTypeTag', () => {
  it('shows each type as a tag with its own class and an icon', () => {
    for (const [type, label] of [['update', 'Update'], ['question', 'Question'], ['general', 'General']] as const) {
      const out = html(type)
      expect(out).toContain(`class="post-type ${type}"`)
      expect(out).toContain(label)
      expect(out).toContain('<svg')
    }
  })

  it('hides the icon from screen readers so only the word is read', () => {
    expect(html('update')).toContain('aria-hidden="true"')
  })

  it('is written in the reader’s language', () => {
    expect(html('question', 'es')).toContain('Pregunta')
    expect(html('update', 'vi')).toContain('Cập nhật')
    expect(html('general', 'zh')).toContain('综合')
  })
})
