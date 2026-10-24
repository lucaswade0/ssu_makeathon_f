import { describe, expect, it } from 'vitest'
import { alertParagraphs } from './alertText'

describe('alertParagraphs', () => {
  it('joins hard-wrapped lines into one paragraph', () => {
    expect(alertParagraphs('If travel is required, allow extra time as some roads may be\nclosed. Do not drive around barricades.')).toEqual([
      'If travel is required, allow extra time as some roads may be closed. Do not drive around barricades.',
    ])
  })

  it('keeps blank-line paragraph breaks', () => {
    expect(alertParagraphs('First paragraph\nwrapped.\n\nSecond paragraph.')).toEqual(['First paragraph wrapped.', 'Second paragraph.'])
  })

  it('handles Windows line endings and extra blank lines', () => {
    expect(alertParagraphs('One\r\nline.\r\n\r\n\r\nTwo.')).toEqual(['One line.', 'Two.'])
  })

  it('keeps NWS bullet sections as separate paragraphs', () => {
    const text = '* WHAT...Minor flooding.\n\n* WHEN...Until 3 PM\nthis afternoon.'
    expect(alertParagraphs(text)).toEqual(['* WHAT...Minor flooding.', '* WHEN...Until 3 PM this afternoon.'])
  })

  it('collapses repeated spaces and trims', () => {
    expect(alertParagraphs('  Avoid   flooded   roads.  ')).toEqual(['Avoid flooded roads.'])
  })

  it('returns nothing for empty, blank, or missing text', () => {
    expect(alertParagraphs('')).toEqual([])
    expect(alertParagraphs('  \n \n  ')).toEqual([])
    expect(alertParagraphs(null)).toEqual([])
    expect(alertParagraphs(undefined)).toEqual([])
  })
})
