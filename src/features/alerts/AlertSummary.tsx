import { useEffect, useRef, useState } from 'react'
import { BadgeCheck, ExternalLink, Pin, X } from 'lucide-react'
import { formatAlertTime, safeHttpUrl, severityLabels, sourceLinkLabel } from './alertFormat'
import type { AlertKind, AlertSeverity, AlertView } from './alertFormat'

export function AlertTags({ kind, label = 'alert', severity = 'info' }: { kind: AlertKind; label?: string; severity?: AlertSeverity }) {
  return <div className={`official-tags sev-${severity}`}>
    <span className="official-badge"><BadgeCheck size={14} aria-hidden="true" />{kind === 'nws' ? 'NWS' : 'OFFICIAL'}</span>
    {kind === 'nws' && <span className="badge community">Public data</span>}
    {kind === 'sample' && <span className="badge community">Sample data</span>}
    <span className="severity-chip">{severityLabels[severity]}</span>
    <span className="pinned"><Pin size={13} aria-hidden="true" />Pinned · Latest {label}</span>
  </div>
}

function AlertModal({ alert, onClose }: { alert: AlertView; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  const link = safeHttpUrl(alert.sourceUrl)
  useEffect(() => {
    const dialog = ref.current
    if (dialog && !dialog.open) dialog.showModal()
  }, [])
  return <dialog ref={ref} className={`alert-modal sev-${alert.severity}`} aria-labelledby="alert-modal-title" onClose={onClose}
    onClick={event => { if (event.target === event.currentTarget) onClose() }}>
    <div className="alert-modal-head">
      <AlertTags kind={alert.kind} severity={alert.severity} label={alert.kind === 'nws' ? 'weather alert' : 'alert'} />
      <button type="button" className="ghost icon" aria-label="Close" onClick={onClose}><X size={18} aria-hidden="true" /></button>
    </div>
    <h2 id="alert-modal-title">{alert.title}</h2>
    {alert.expired && <p className="error">This alert has expired. Check the source for current instructions.</p>}
    <div className="alert-copy">{alert.paragraphs.map(paragraph => <p key={paragraph} className="alert-paragraph">{paragraph}</p>)}</div>
    <dl className="alert-facts">
      <div><dt>Issued</dt><dd>{formatAlertTime(alert.issuedAt)}</dd></div>
      {alert.expiresAt && <div><dt>Expires</dt><dd>{formatAlertTime(alert.expiresAt)}</dd></div>}
      <div><dt>Source</dt><dd>{link ? <a href={link} target="_blank" rel="noreferrer">{alert.source}</a> : alert.source}</dd></div>
    </dl>
    {alert.note && <p className="alert-note-text">{alert.note}</p>}
    <div className="row">
      {link && <a className="official-link" href={link} target="_blank" rel="noreferrer">{sourceLinkLabel(alert.kind)}<ExternalLink size={14} aria-hidden="true" /></a>}
      <button type="button" onClick={onClose}>Close</button>
    </div>
  </dialog>
}

// A compact card: title, a short preview, one line of facts, and a button that opens the full notice.
export function AlertSummary({ alert, defaultOpen = false, extra }: { alert: AlertView; defaultOpen?: boolean; extra?: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen)
  const [preview] = alert.paragraphs
  const link = safeHttpUrl(alert.sourceUrl)
  return <>
    <h2 className="alert-title">{alert.title}</h2>
    {alert.expired && <p className="error">This alert has expired. Check the source for current instructions.</p>}
    {preview && <p className="alert-preview">{preview}</p>}
    <div className="alert-line">
      <span>Issued {formatAlertTime(alert.issuedAt)}</span>
      {link
        ? <a className="alert-source" href={link} target="_blank" rel="noreferrer">{alert.source}<ExternalLink size={12} aria-hidden="true" /></a>
        : <span>{alert.source}</span>}
      {extra}
      <button type="button" className="alert-open" aria-haspopup="dialog" onClick={() => setOpen(true)}>Read full alert</button>
    </div>
    {open && <AlertModal alert={alert} onClose={() => setOpen(false)} />}
  </>
}
