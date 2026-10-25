import { describe, expect, it } from 'vitest'
import { makeI18n } from './context'
import { sourceLabel } from './sourceLabel'

describe('sourceLabel', () => {
  const es = makeI18n('es', () => {}).t
  const en = makeI18n('en', () => {}).t

  it('translates our own labels and keeps the agency name', () => {
    expect(sourceLabel('Sample data (Sonoma County)', es)).toBe('Datos de muestra (Sonoma County)')
    expect(sourceLabel('Community submission', es)).toBe('Aporte de la comunidad')
  })

  it('leaves real source names alone', () => {
    expect(sourceLabel('NWS San Francisco CA', es)).toBe('NWS San Francisco CA')
    expect(sourceLabel('Cal OES (Sonoma County)', es)).toBe('Cal OES (Sonoma County)')
  })

  it('changes nothing in English', () => {
    expect(sourceLabel('Sample data (Sonoma County)', en)).toBe('Sample data (Sonoma County)')
    expect(sourceLabel('Community submission', en)).toBe('Community submission')
  })

  it('handles nested brackets and empty names', () => {
    expect(sourceLabel('Sample data (Red Cross listing)', makeI18n('zh', () => {}).t)).toBe('示例数据（Red Cross listing）')
    expect(sourceLabel('', es)).toBe('')
  })
})
