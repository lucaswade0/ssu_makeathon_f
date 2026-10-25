import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { answerBlocks, boldParts, FormattedAnswer } from './FormattedAnswer'

const answer = `**No evacuation order is listed.** It may lag behind real events.

What the app shows:
- **Cooley wildfire [I1]:** 1,365 acres
- **Coastal Flood Advisory [W1]:** minor

Call 911 if you see fire.`

describe('FormattedAnswer', () => {
  it('splits paragraphs and bullet lists', () => {
    expect(answerBlocks(answer).map(b => b.type)).toEqual(['p', 'p', 'ul', 'p'])
    expect(answerBlocks(answer)[2]).toEqual({ type: 'ul', items: ['**Cooley wildfire [I1]:** 1,365 acres', '**Coastal Flood Advisory [W1]:** minor'] })
  })

  it('bolds closed ** pairs and leaves an unfinished one (mid-stream) as text', () => {
    expect(boldParts('a **b** c')).toEqual([{ text: 'a ', bold: false }, { text: 'b', bold: true }, { text: ' c', bold: false }])
    expect(boldParts('a **still typing')).toEqual([{ text: 'a **still typing', bold: false }])
  })

  it('renders elements, not raw HTML, so answers cannot inject markup', () => {
    const html = renderToStaticMarkup(<FormattedAnswer text={'**Hi** <img src=x onerror=alert(1)>\n- one'} />)
    expect(html).toBe('<div class="sam-answer"><p><strong>Hi</strong> &lt;img src=x onerror=alert(1)&gt;</p><ul><li>one</li></ul></div>')
  })
})
