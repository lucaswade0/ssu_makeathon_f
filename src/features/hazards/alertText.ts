// National Weather Service text is hard-wrapped at about 70 characters, so showing it as-is leaves ragged
// lines. Join each wrapped paragraph into one line and keep the blank-line paragraph breaks.
export function alertParagraphs(text: string | null | undefined): string[] {
  if (!text) return []
  return text
    .replace(/\r\n?/g, '\n')
    .split(/\n\s*\n/)
    .map(paragraph => paragraph.replace(/\s*\n\s*/g, ' ').replace(/[ \t]{2,}/g, ' ').trim())
    .filter(Boolean)
}
