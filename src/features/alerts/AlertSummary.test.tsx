import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { AlertSummary, AlertTags } from './AlertSummary'
import { formatAlertTime, nwsLink, nwsPointUrl, nwsSeverity, responderParagraphs, safeHttpUrl, severityLabels, sourceLinkLabel, type AlertView } from './alertFormat'

const alert: AlertView = {
  kind: 'nws', severity: 'info', title: 'Coastal Flood Advisory',
  paragraphs: ['Allow extra time as some roads may be closed.', 'Do not drive around barricades.'],
  issuedAt: '2026-10-24T20:34:00Z', expiresAt: '2026-10-25T12:00:00Z', source: 'NWS San Francisco CA',
  note: 'No local responder alert is posted for Santa Rosa.',
}
const html = (node: React.ReactElement) => renderToString(node).replaceAll('<!-- -->', '')

describe('AlertSummary card', () => {
  it('shows the title, only the first paragraph as a preview, and a button to read more', () => {
    const out = html(<AlertSummary alert={alert} />)
    expect(out).toContain('Coastal Flood Advisory')
    expect(out).toContain('Allow extra time as some roads may be closed.')
    expect(out).not.toContain('Do not drive around barricades.')
    expect(out).toContain('Read full alert')
    expect(out).toContain('NWS San Francisco CA')
  })

  it('keeps the full notice out of the page until it is opened', () => {
    const out = html(<AlertSummary alert={alert} />)
    expect(out).not.toContain('<dialog')
    expect(out).not.toContain('No local responder alert is posted')
  })

  it('shows every paragraph, the times, source, and why it is pinned when opened', () => {
    const out = html(<AlertSummary alert={alert} defaultOpen />)
    expect(out).toContain('<dialog')
    expect(out).toContain('Do not drive around barricades.')
    expect(out).toContain('Issued')
    expect(out).toContain('Expires')
    expect(out).toContain('No local responder alert is posted for Santa Rosa.')
    expect(out).toContain('aria-labelledby="alert-modal-title"')
  })

  it('links to the official source only when there is one', () => {
    expect(html(<AlertSummary alert={alert} defaultOpen />)).not.toContain('Official instructions')
    expect(html(<AlertSummary alert={{ ...alert, kind: 'official', sourceUrl: 'https://example.gov/alert' }} defaultOpen />)).toContain('href="https://example.gov/alert"')
  })

  it('makes the source name on the card a link that opens in the same tab', () => {
    const out = html(<AlertSummary alert={{ ...alert, sourceUrl: 'https://forecast.weather.gov/x' }} />)
    expect(out).toMatch(/<a[^>]*href="https:\/\/forecast\.weather\.gov\/x"[^>]*>NWS San Francisco CA/)
    expect(html(<AlertSummary alert={alert} />)).not.toContain('alert-source')
  })

  it('never opens a new tab from any alert link', () => {
    const out = html(<AlertSummary alert={{ ...alert, sourceUrl: 'https://forecast.weather.gov/x' }} defaultOpen />)
    expect(out).toContain('href="https://forecast.weather.gov/x"')
    expect(out).not.toContain('target=')
  })

  it('labels the modal link for each kind and also links the source in the facts list', () => {
    const out = html(<AlertSummary alert={{ ...alert, sourceUrl: 'https://forecast.weather.gov/x' }} defaultOpen />)
    expect(out).toContain('View on weather.gov')
    expect(out.match(/href="https:\/\/forecast\.weather\.gov\/x"/g)?.length).toBeGreaterThanOrEqual(3)
  })

  it('never renders a link for an unsafe URL', () => {
    const out = html(<AlertSummary alert={{ ...alert, sourceUrl: 'javascript:alert(1)' }} defaultOpen />)
    expect(out).not.toContain('javascript:')
    expect(out).not.toContain('View on weather.gov')
  })

  it('warns when the alert has expired', () => {
    expect(html(<AlertSummary alert={{ ...alert, expired: true }} />)).toContain('This alert has expired')
    expect(html(<AlertSummary alert={alert} />)).not.toContain('This alert has expired')
  })

  it('renders without a preview when the alert has no text', () => {
    const out = html(<AlertSummary alert={{ ...alert, paragraphs: [] }} />)
    expect(out).toContain('Coastal Flood Advisory')
    expect(out).not.toContain('alert-preview')
  })
})

describe('alert badges', () => {
  it('labels NWS alerts as public data and responder alerts as official', () => {
    const nws = html(<AlertTags kind="nws" label="weather alert" />)
    expect(nws).toContain('NWS')
    expect(nws).toContain('Public data')
    expect(nws).toContain('Latest weather alert')
    expect(html(<AlertTags kind="official" />)).toContain('OFFICIAL')
    expect(html(<AlertTags kind="official" />)).not.toContain('Public data')
  })

  it('marks simulated alerts as sample data', () => {
    expect(html(<AlertTags kind="sample" />)).toContain('Sample data')
  })
})

describe('responderParagraphs', () => {
  it('splits on blank lines and keeps line breaks inside a paragraph', () => {
    expect(responderParagraphs('Leave now.\nTake pets.\n\nRoute: Highway 12.')).toEqual(['Leave now.\nTake pets.', 'Route: Highway 12.'])
  })

  it('returns nothing for empty text', () => {
    expect(responderParagraphs('')).toEqual([])
    expect(responderParagraphs(null)).toEqual([])
  })

  it('formats times for display', () => {
    expect(formatAlertTime('2026-10-24T20:34:00Z')).toMatch(/2026/)
  })
})

describe('source links', () => {
  it('only accepts http and https links', () => {
    expect(safeHttpUrl('https://example.gov/a')).toBe('https://example.gov/a')
    expect(safeHttpUrl('  http://example.gov  ')).toBe('http://example.gov')
    expect(safeHttpUrl('javascript:alert(1)')).toBeNull()
    expect(safeHttpUrl('data:text/html,hi')).toBeNull()
    expect(safeHttpUrl('')).toBeNull()
    expect(safeHttpUrl(null)).toBeNull()
  })

  it('builds the NWS page for a point with four decimals', () => {
    expect(nwsPointUrl(38.4404, -122.7141)).toBe('https://forecast.weather.gov/MapClick.php?lat=38.4404&lon=-122.7141')
    expect(nwsPointUrl(38.44, -122.7)).toBe('https://forecast.weather.gov/MapClick.php?lat=38.4400&lon=-122.7000')
  })

  it('falls back to weather.gov without coordinates', () => {
    expect(nwsLink()).toBe('https://www.weather.gov/')
    expect(nwsLink({ lat: 38.2324, lng: -122.6367 })).toContain('lat=38.2324&lon=-122.6367')
  })

  it('names the link by alert kind', () => {
    expect(sourceLinkLabel('nws')).toBe('View on weather.gov')
    expect(sourceLinkLabel('official')).toBe('Official instructions')
  })
})

describe('alert severity', () => {
  it('rates NWS Severe and Extreme alerts as urgent', () => {
    expect(nwsSeverity('Extreme', 'Tornado Warning')).toBe('critical')
    expect(nwsSeverity('Severe', 'Red Flag Warning')).toBe('critical')
    expect(nwsSeverity('severe', 'Flash Flood Watch')).toBe('critical')
  })

  it('rates watches, warnings, and moderate non-advisories as be ready', () => {
    expect(nwsSeverity('Moderate', 'Flood Watch')).toBe('warning')
    expect(nwsSeverity('Minor', 'Wind Warning')).toBe('warning')
    expect(nwsSeverity('Moderate', 'Air Quality Alert')).toBe('warning')
  })

  it('keeps advisories and unknown ratings as plain information', () => {
    expect(nwsSeverity('Minor', 'Coastal Flood Advisory')).toBe('info')
    expect(nwsSeverity('Moderate', 'Wind Advisory')).toBe('info')
    expect(nwsSeverity('Moderate', 'Special Weather Statement')).toBe('info')
    expect(nwsSeverity('Unknown', 'Dense Fog Advisory')).toBe('info')
    expect(nwsSeverity('', '')).toBe('info')
  })

  it('has words for every level, so color is never the only signal', () => {
    expect(severityLabels).toEqual({ info: 'Advisory', warning: 'Be ready', critical: 'Urgent' })
  })

  it('shows the level in the badges row and the modal for each severity', () => {
    for (const severity of ['info', 'warning', 'critical'] as const) {
      const tags = html(<AlertTags kind="official" severity={severity} />)
      expect(tags).toContain(`sev-${severity}`)
      expect(tags).toContain(severityLabels[severity])
      const modal = html(<AlertSummary alert={{ ...alert, kind: 'official', severity }} defaultOpen />)
      expect(modal).toContain(`alert-modal sev-${severity}`)
      expect(modal).toContain(severityLabels[severity])
    }
  })
})
