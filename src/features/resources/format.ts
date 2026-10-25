// "45 min ago". With a locale ("es", "zh-Hans") it uses the browser's own wording; without one it stays English.
export function timeAgo(iso: string, now = Date.now(), locale?: string) {
  const minutes = Math.round((now - Date.parse(iso)) / 60_000)
  if (locale) {
    const format = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })
    if (minutes < 1) return format.format(0, 'minute')
    if (minutes < 60) return format.format(-minutes, 'minute')
    if (minutes < 48 * 60) return format.format(-Math.round(minutes / 60), 'hour')
    return format.format(-Math.round(minutes / 1440), 'day')
  }
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes} min ago`
  if (minutes < 48 * 60) return `${Math.round(minutes / 60)} h ago`
  return `${Math.round(minutes / 1440)} days ago`
}
