// Renders the small subset of Markdown SAM writes: paragraphs, "- " bullet lists, and **bold**.
// Builds React elements (never raw HTML), so an answer can't inject markup or scripts.

export type Block = { type: 'p'; text: string } | { type: 'ul'; items: string[] }

export function answerBlocks(text: string): Block[] {
  const blocks: Block[] = []
  for (const line of text.split('\n')) {
    const bullet = line.match(/^\s*[-*•]\s+(.*)$/)
    const last = blocks.at(-1)
    if (bullet) {
      if (last?.type === 'ul') last.items.push(bullet[1]!)
      else blocks.push({ type: 'ul', items: [bullet[1]!] })
    } else if (line.trim()) {
      if (last?.type === 'p') last.text += ` ${line.trim()}`
      else blocks.push({ type: 'p', text: line.trim() })
    } else {
      blocks.push({ type: 'p', text: '' }) // a blank line ends the current paragraph or list
    }
  }
  return blocks.filter(b => b.type === 'ul' || b.text)
}

/** Splits on **bold** markers; odd pieces are bold. An unclosed "**" (mid-stream) stays as plain text. */
export function boldParts(text: string) {
  const parts = text.split('**')
  if (parts.length % 2 === 0) parts[parts.length - 2] += `**${parts.pop()}`
  return parts.map((part, i) => ({ text: part, bold: i % 2 === 1 }))
}

function Inline({ text }: { text: string }) {
  return <>{boldParts(text).map((p, i) => p.bold ? <strong key={i}>{p.text}</strong> : p.text)}</>
}

export function FormattedAnswer({ text }: { text: string }) {
  return <div className="sam-answer">
    {answerBlocks(text).map((b, i) => b.type === 'ul'
      ? <ul key={i}>{b.items.map((item, j) => <li key={j}><Inline text={item} /></li>)}</ul>
      : <p key={i}><Inline text={b.text} /></p>)}
  </div>
}
