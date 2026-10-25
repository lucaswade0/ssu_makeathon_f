import { useEffect, useRef, useState } from 'react'
import { BadgeCheck, ExternalLink, Pin, X } from 'lucide-react'
import { useI18n } from '../i18n/context'
import { dateLocale, htmlLang } from '../i18n/languages'
import { TranslateControl } from '../i18n/TranslateControl'
import { formatAlertTime, safeHttpUrl } from './alertFormat'
import type { AlertKind, AlertSeverity, AlertView } from './alertFormat'

export function AlertTags({ kind, label = 'alert', severity = 'info' }: { kind: AlertKind; label?: string; severity?: AlertSeverity }) {
  const { t } = useI18n()
  return <div className={`official-tags sev-${severity}`}>
    <span className="official-badge"><BadgeCheck size={14} aria-hidden="true" />{kind === 'nws' ? t('alert.nws') : t('alert.official')}</span>
    {kind === 'nws' && <span className="badge community">{t('alert.public')}</span>}
    {kind === 'sample' && <span className="badge community">{t('alert.sample')}</span>}
    <span className="severity-chip">{t(`alert.sev.${severity}`)}</span>
    <span className="pinned"><Pin size={13} aria-hidden="true" />{label === 'weather alert' ? t('alert.pinnedWeather') : t('alert.pinnedAlert')}</span>
  </div>
}

function AlertModal({ alert, translated, onClose }: { alert: AlertView; translated: boolean; onClose: () => void }) {
  const { t, lang } = useI18n()
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
      <button type="button" className="ghost icon" aria-label={t('alert.close')} onClick={onClose}><X size={18} aria-hidden="true" /></button>
    </div>
    <h2 id="alert-modal-title">{alert.title}</h2>
    {alert.expired && <p className="error">{t('alert.expiredWarn')}</p>}
    <div className="alert-copy">{alert.paragraphs.map(paragraph => <p key={paragraph} className="alert-paragraph">{paragraph}</p>)}</div>
    {translated && <p className="muted">{t('translate.badge')}</p>}
    <dl className="alert-facts">
      <div><dt>{t('alert.issued')}</dt><dd>{formatAlertTime(alert.issuedAt, dateLocale(lang))}</dd></div>
      {alert.expiresAt && <div><dt>{t('alert.expires')}</dt><dd>{formatAlertTime(alert.expiresAt, dateLocale(lang))}</dd></div>}
      <div><dt>{t('alert.source')}</dt><dd>{link ? <a href={link}>{alert.source}</a> : alert.source}</dd></div>
    </dl>
    {alert.note && <p className="alert-note-text">{alert.note}</p>}
    <div className="row">
      {link && <a className="official-link" href={link}>{alert.kind === 'nws' ? t('alert.linkNws') : t('alert.linkOfficial')}<ExternalLink size={14} aria-hidden="true" /></a>}
      <button type="button" onClick={onClose}>{t('alert.close')}</button>
    </div>
  </dialog>
}

// A compact card: title, a short preview, one line of facts, and a button that opens the full notice.
export function AlertSummary({ alert, defaultOpen = false, extra }: { alert: AlertView; defaultOpen?: boolean; extra?: React.ReactNode }) {
  const { t, lang } = useI18n()
  const [open, setOpen] = useState(defaultOpen)
  // The title and text are translated together, and the dialog shows the same translation.
  const [parts, setParts] = useState<string[] | null>(null)
  const shown: AlertView = parts ? { ...alert, title: parts[0] ?? alert.title, paragraphs: parts.slice(1) } : alert
  const translated = parts !== null
  const [preview] = shown.paragraphs
  const link = safeHttpUrl(alert.sourceUrl)
  return <>
    <h2 className="alert-title" lang={translated ? htmlLang[lang] : undefined}>{shown.title}</h2>
    {alert.expired && <p className="error">{t('alert.expiredWarn')}</p>}
    {preview && <p className="alert-preview" lang={translated ? htmlLang[lang] : undefined}>{preview}</p>}
    <TranslateControl texts={[alert.title, ...alert.paragraphs]} onTranslated={setParts} />
    <div className="alert-line">
      <span>{t('alert.issuedAt', { time: formatAlertTime(alert.issuedAt, dateLocale(lang)) })}</span>
      {link
        ? <a className="alert-source" href={link}>{alert.source}<ExternalLink size={12} aria-hidden="true" /></a>
        : <span>{alert.source}</span>}
      {extra}
      <button type="button" className="alert-open" aria-haspopup="dialog" onClick={() => setOpen(true)}>{t('alert.readFull')}</button>
    </div>
    {open && <AlertModal alert={shown} translated={translated} onClose={() => setOpen(false)} />}
  </>
}
