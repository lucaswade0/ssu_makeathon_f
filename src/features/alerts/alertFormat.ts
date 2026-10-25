export type AlertKind = 'official' | 'nws' | 'sample'

export type AlertView = {
  kind: AlertKind
  severity: AlertSeverity
  title: string
  /** Full text, one entry per paragraph. The card previews the first one. */
  paragraphs: string[]
  issuedAt: string
  expiresAt?: string | null
  source: string
  sourceUrl?: string | null
  expired?: boolean
  /** Why this alert is pinned, for example "No local responder alert is posted for Santa Rosa". */
  note?: string
}

// Responder text is written by people, so keep their line breaks inside a paragraph and only split on blank lines.
export function responderParagraphs(text: string | null | undefined): string[] {
  if (!text) return []
  return text.replace(/\r\n?/g, '\n').split(/\n\s*\n/).map(part => part.trim()).filter(Boolean)
}

export const formatAlertTime = (value: string, locale?: string) => new Date(value).toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' })


// Only web links are ever rendered, so a bad value in the database can't become a javascript: link.
export function safeHttpUrl(url: string | null | undefined): string | null {
  return url && /^https?:\/\//i.test(url.trim()) ? url.trim() : null
}

// The human-readable National Weather Service page for a point: its current alerts and forecast.
export function nwsPointUrl(lat: number, lng: number) {
  return `https://forecast.weather.gov/MapClick.php?lat=${lat.toFixed(4)}&lon=${lng.toFixed(4)}`
}

// Falls back to the NWS home page when the city has no known coordinates.
export function nwsLink(center?: { lat: number; lng: number }) {
  return center ? nwsPointUrl(center.lat, center.lng) : 'https://www.weather.gov/'
}

export function sourceLinkLabel(kind: AlertKind) {
  return kind === 'nws' ? 'View on weather.gov' : 'Official instructions'
}

export type AlertSeverity = 'info' | 'warning' | 'critical'

// Words as well as color, so the level is clear to people who can't tell red from amber.
export const severityLabels: Record<AlertSeverity, string> = { info: 'Advisory', warning: 'Be ready', critical: 'Urgent' }

// NWS rates every alert Extreme, Severe, Moderate, Minor, or Unknown. Only Severe and Extreme turn red.
// Watches and warnings are at least amber. Advisories stay blue unless NWS rates them Moderate or higher.
export function nwsSeverity(severity: string, event: string): AlertSeverity {
  if (/^(extreme|severe)$/i.test(severity)) return 'critical'
  if (/watch|warning/i.test(event)) return 'warning'
  if (/^moderate$/i.test(severity) && !/advisory|statement/i.test(event)) return 'warning'
  return 'info'
}
