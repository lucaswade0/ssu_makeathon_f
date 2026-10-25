import { describe, expect, it } from 'vitest'
import { languages } from './languages'
import { messages, type MessageKey } from './messages'

const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map(match => match[1]).sort()
const keys = Object.keys(messages.en) as MessageKey[]

describe('message dictionaries', () => {
  it('has the same keys in every language', () => {
    for (const lang of languages) expect(Object.keys(messages[lang]).sort()).toEqual([...keys].sort())
  })

  it('keeps the same {placeholders} in every language', () => {
    for (const lang of languages) {
      for (const key of keys) expect(placeholders(messages[lang][key]), `${lang}: ${key}`).toEqual(placeholders(messages.en[key]))
    }
  })

  it('has no empty or whitespace-only messages', () => {
    for (const lang of languages) {
      for (const key of keys) expect(messages[lang][key].trim().length, `${lang}: ${key}`).toBeGreaterThan(0)
    }
  })

  it('translates every message that is not an intentional match with English', () => {
    // Words that are identical on purpose: acronyms, shared terms, and "acres" (Spanish) and "Email" (Vietnamese), which those languages also use.
    const allowed = new Set<MessageKey>(['alert.nws', 'type.general', 'filter.general', 'map.acres', 'account.email'])
    for (const lang of languages.filter(code => code !== 'en')) {
      for (const key of keys) {
        if (allowed.has(key)) continue
        expect(messages[lang][key], `${lang}: ${key} is still English`).not.toBe(messages.en[key])
      }
    }
  })

  it('always keeps the 911 safety line in every disclaimer', () => {
    for (const lang of languages) {
      expect(messages[lang]['shell.disclaimer']).toContain('911')
      expect(messages[lang]['news.safetyNote']).toContain('911')
      expect(messages[lang]['resources.safetyNote']).toContain('911')
    }
  })

  it('has a one and other form for every plural', () => {
    const bases = keys.filter(key => key.endsWith('.one')).map(key => key.replace(/\.one$/, ''))
    expect(bases.length).toBeGreaterThan(0)
    for (const base of bases) expect(keys).toContain(`${base}.other`)
  })

  it('translates the machine-translation warning in every language', () => {
    for (const lang of languages) expect(messages[lang]['translate.done']).toMatch(/\{language\}/)
  })
})
