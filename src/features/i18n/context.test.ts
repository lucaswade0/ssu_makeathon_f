import { describe, expect, it } from 'vitest'
import { makeI18n, translate } from './context'
import { messages } from './messages'

describe('translate', () => {
  it('returns the message for the language', () => {
    expect(translate('es', 'nav.feed')).toBe(messages.es['nav.feed'])
    expect(translate('en', 'nav.feed')).toBe('Feed')
  })

  it('fills {placeholders} and leaves unknown ones visible', () => {
    expect(translate('en', 'feed.title', { city: 'Santa Rosa' })).toBe('Santa Rosa feed')
    expect(translate('en', 'feed.title', {})).toBe('{city} feed')
    expect(translate('zh', 'composer.placeholder', { city: '圣罗莎' })).toContain('圣罗莎')
  })

  it('accepts numbers as values', () => {
    expect(translate('en', 'sim.step', { n: 3, total: 8, title: 'Order' })).toBe('Step 3 of 8: Order')
  })

  it('falls back to English when a message is missing', () => {
    const original = messages.es['nav.feed']
    // @ts-expect-error simulating a dictionary that lost a key
    delete messages.es['nav.feed']
    try { expect(translate('es', 'nav.feed')).toBe('Feed') } finally { messages.es['nav.feed'] = original }
  })
})

describe('plurals', () => {
  const i18n = makeI18n('en', () => {})

  it('uses the singular for exactly one', () => {
    expect(i18n.tp('strip.fire', 1)).toBe('1 active wildfire')
    expect(i18n.tp('strip.weather', 1)).toBe('1 weather alert')
  })

  it('uses the plural for zero and many', () => {
    expect(i18n.tp('strip.fire', 0)).toBe('0 active wildfires')
    expect(i18n.tp('strip.quake', 2)).toBe('2 recent earthquakes')
  })

  it('works in other languages', () => {
    expect(makeI18n('es', () => {}).tp('strip.zone', 2)).toBe('2 zonas de evacuación')
    expect(makeI18n('zh', () => {}).tp('strip.zone', 1)).toContain('1')
  })

  it('exposes the language and setter it was made with', () => {
    let chosen = ''
    const custom = makeI18n('vi', code => { chosen = code })
    custom.setLang('zh')
    expect(custom.lang).toBe('vi')
    expect(chosen).toBe('zh')
  })
})
