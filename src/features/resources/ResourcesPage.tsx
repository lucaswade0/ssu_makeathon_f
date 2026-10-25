import { lazy, Suspense, useEffect, useState, type FormEvent } from 'react'
import { BatteryCharging, Bus, Droplets, Flag, HeartPulse, House, PawPrint, Plus, Trash2, type LucideIcon } from 'lucide-react'
import { useCommunitySession } from '../community/session'
import { cityCenter, hasLiveCoverage } from '../hazards/liveHazards'
import { useSimulation } from '../simulation/context'
import { checkResource, friendlyDbError } from './checks'
import { addressFromMap } from './geocode'
import { useI18n } from '../i18n/context'
import { htmlLang } from '../i18n/languages'
import { TranslatableText } from '../i18n/TranslatableText'
import { timeAgo } from './format'
import { useCreateResource, useRemoveResource, useReportResource, useResources } from './hooks'
import { sourceLabel } from '../i18n/sourceLabel'
import type { Vars } from '../i18n/context'
import type { MessageKey } from '../i18n/messages'
import { checkText } from './checkText'
import { sampleResources } from './sampleData'
import {
  categories, filterResources, isStale, reportReasons, statuses,
  type ReportReason, type Resource, type ResourceCategory, type ResourceFilter,
} from './schemas'

type T = (key: MessageKey, vars?: Vars) => string

const icons: Record<ResourceCategory, LucideIcon> = {
  shelter: House, water_food: Droplets, medical: HeartPulse, charging: BatteryCharging, pets: PawPrint, transportation: Bus,
}

function message(error: unknown, t: T) {
  return typeof error === 'object' && error && 'message' in error ? checkText(friendlyDbError(String(error.message)), t) : t('error.generic')
}

function ReportForm({ resource, onDone }: { resource: Resource; onDone: () => void }) {
  const { t } = useI18n()
  const report = useReportResource()
  const [reason, setReason] = useState<ReportReason>('inaccurate')
  const [details, setDetails] = useState('')
  async function submit(event: FormEvent) {
    event.preventDefault()
    try { await report.mutateAsync({ id: resource.id, reason, details }) } catch { /* Shown below. */ }
  }
  if (report.isSuccess) return <div className="report-form" role="status">
    <p>{t('report.thanks', { title: resource.title })}</p>
    <button type="button" onClick={onDone}>{t('report.close')}</button>
  </div>
  return <form className="report-form" onSubmit={submit} aria-label={t('report.formLabel', { title: resource.title })}>
    <label>{t('report.whatsWrong')}<select value={reason} onChange={e => setReason(e.target.value as ReportReason)} disabled={report.isPending}>
      {reportReasons.map(r => <option key={r} value={r}>{t(`report.reason.${r}`)}</option>)}
    </select></label>
    <label>{t('report.details')}<textarea rows={2} maxLength={1000} value={details} onChange={e => setDetails(e.target.value)} disabled={report.isPending} /></label>
    <div className="row"><button type="submit" disabled={report.isPending}>{report.isPending ? t('report.sending') : t('report.send')}</button><button type="button" disabled={report.isPending} onClick={onDone}>{t('entry.cancel')}</button></div>
    {report.isError && <p role="alert" className="error">{message(report.error, t)}</p>}
  </form>
}

function ResourceCard({ resource, now, canReport, onSignIn }: { resource: Resource; now: number; canReport: boolean; onSignIn: () => void }) {
  const { t, lang } = useI18n()
  const { session } = useCommunitySession()
  const remove = useRemoveResource()
  const [reporting, setReporting] = useState(false)
  const Icon = icons[resource.category]
  const stale = isStale(resource, now)
  const mine = Boolean(session) && session?.user.id === resource.author_id && resource.status === 'community_submitted'
  return <article className="resource-card" aria-label={resource.title}>
    <div className="resource-title"><Icon size={24} aria-hidden="true" /><h3>{resource.title}</h3></div>
    <p className="muted resource-where">{t(`category.${resource.category}`)} · {resource.location_text}</p>
    <span className={`status-badge ${resource.status}`}>{t(`status.${resource.status}`)}</span>
    <TranslatableText text={resource.description} className="resource-description" />
    <div className="resource-foot">
      <span>{sourceLabel(resource.source, t)}</span>
      <span>{t('resources.confirmed', { time: timeAgo(resource.last_confirmed_at, now, lang === 'en' ? undefined : htmlLang[lang]) })}{stale && <strong className="stale-tag"> · {t('resources.stale')}</strong>}</span>
      <div className="resource-actions">
        {canReport && (reporting
          ? null
          : session
            ? <button type="button" className="report-button" onClick={() => setReporting(true)}><Flag size={14} aria-hidden="true" />{t('resources.report')}</button>
            : <button type="button" className="report-button" onClick={onSignIn}><Flag size={14} aria-hidden="true" />{t('resources.signInToReport')}</button>)}
        {canReport && mine && <button type="button" className="ghost danger" disabled={remove.isPending} onClick={() => void remove.mutateAsync(resource.id).catch(() => {})}><Trash2 size={14} aria-hidden="true" />{remove.isPending ? t('resources.removing') : t('resources.remove')}</button>}
      </div>
    </div>
    {remove.isError && <p role="alert" className="error">{message(remove.error, t)}</p>}
    {reporting && <ReportForm resource={resource} onDone={() => setReporting(false)} />}
  </article>
}

const LocationPicker = lazy(() => import('./LocationPicker'))

export function AddResource({ city, existing, onDone }: { city: string; existing: Resource[]; onDone: () => void }) {
  const { t } = useI18n()
  const create = useCreateResource()
  const [category, setCategory] = useState<ResourceCategory>('water_food')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [location, setLocation] = useState('')
  const [addressEdited, setAddressEdited] = useState(false)
  const [pin, setPin] = useState<{ lat: number; lng: number } | null>(null)
  const [tried, setTried] = useState(false)
  const [confirmedDuplicate, setConfirmedDuplicate] = useState(false)
  // Looking up the city center is only a starting view for the map; it is never stored as the pin.
  const center = hasLiveCoverage(city) ? cityCenter(city) : cityCenter('Santa Rosa')
  const checks = pin ? checkResource({ category, title, description, city, latitude: pin.lat, longitude: pin.lng }, existing) : null
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!pin || !checks) return
    setTried(true)
    if (checks.problems.length || (checks.duplicate && !confirmedDuplicate)) return
    try {
      await create.mutateAsync({ category, title, description, location_text: location, city, latitude: pin.lat, longitude: pin.lng })
      onDone()
    } catch { /* Shown below; keep the draft. */ }
  }
  return <form className="panel add-resource" onSubmit={submit} aria-label={t('resources.add')}>
    <h3>{t('add.title', { city })}</h3>
    <p className="muted">{t('add.note')}</p>
    <label>{t('resources.groupType')}<select value={category} onChange={e => setCategory(e.target.value as ResourceCategory)} disabled={create.isPending}>
      {categories.map(c => <option key={c} value={c}>{t(`category.${c}`)}</option>)}
    </select></label>
    <label>{t('add.name')}<input value={title} onChange={e => setTitle(e.target.value)} required maxLength={180} disabled={create.isPending} /></label>
    <label>{t('add.available')}<textarea rows={3} value={description} onChange={e => setDescription(e.target.value)} required maxLength={2000} disabled={create.isPending} /></label>
    <fieldset className="pin-field">
      <legend>{t('add.where')}</legend>
      <Suspense fallback={<p className="muted" role="status">{t('add.loadingMap')}</p>}>
        <LocationPicker center={center} pin={pin} onPin={setPin} onLabel={label => setLocation(current => addressFromMap(label, current, addressEdited))} />
      </Suspense>
    </fieldset>
    <label>{t('add.address')}<input value={location} onChange={e => { setLocation(e.target.value); setAddressEdited(e.target.value.trim() !== '') }} required maxLength={240} disabled={create.isPending} placeholder={t('add.addressHint')} /></label>
    <div className="row"><button type="submit" disabled={create.isPending || !pin || !title.trim() || !description.trim() || !location.trim()}>{create.isPending ? t('add.submitting') : t('add.submit')}</button><button type="button" disabled={create.isPending} onClick={onDone}>{t('entry.cancel')}</button></div>
    {!pin && <p className="muted" role="status">{t('add.needPin')}</p>}
    {tried && checks && checks.problems.length > 0 && <ul role="alert" className="error check-list">{checks.problems.map(p => <li key={p}>{checkText(p, t)}</li>)}</ul>}
    {tried && checks?.duplicate && <div role="alert" className="detail-warning">
      <p>{t('add.duplicate', { title: checks.duplicate.title })}</p>
      <label className="check-confirm"><input type="checkbox" checked={confirmedDuplicate} onChange={e => setConfirmedDuplicate(e.target.checked)} />{t('add.duplicateConfirm')}</label>
    </div>}
    {create.isError && <p role="alert" className="error">{message(create.error, t)}</p>}
  </form>
}

export function ResourcesPage({ city, onSignIn }: { city: string; onSignIn: () => void }) {
  const { t, lang } = useI18n()
  const { session, configured } = useCommunitySession()
  const sim = useSimulation()
  const simulating = sim.active
  const query = useResources(city)
  const [filter, setFilter] = useState<ResourceFilter>('all')
  const [adding, setAdding] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000)
    return () => window.clearInterval(timer)
  }, [])

  const all = simulating ? sim.state?.resources ?? [] : configured ? query.data ?? [] : sampleResources
  const items = filterResources(all, filter)
  const live = configured && !simulating
  const loading = live && query.isPending
  const canReport = live

  return <section className="resources" aria-label={t('nav.resources')}>
    <div className="resources-heading">
      <div>
        <h2>{simulating ? t('resources.simTitle') : t('resources.title', { city })}</h2>
        <p className="muted">{t('resources.subtitle')}</p>
      </div>
      {live && (session
        ? <button type="button" className="new-post-button" onClick={() => setAdding(!adding)}><Plus size={16} aria-hidden="true" />{t('resources.add')}</button>
        : <button type="button" className="new-post-button" onClick={onSignIn}><Plus size={16} aria-hidden="true" />{t('resources.signInToAdd')}</button>)}
    </div>

    {simulating && <p className="notice" role="status">{t('resources.simNotice')}</p>}
    {!configured && !simulating && <p className="notice" role="status">{t('resources.sampleNotice')}</p>}
    {adding && live && session && <AddResource city={city} existing={all} onDone={() => setAdding(false)} />}

    <label className="resource-filter">{t('resources.show')}
      <select value={filter} onChange={e => setFilter(e.target.value as ResourceFilter)}>
        <option value="all">{t('resources.all')}</option>
        <optgroup label={t('resources.groupType')}>{categories.map(c => <option key={c} value={c}>{t(`category.${c}`)}</option>)}</optgroup>
        <optgroup label={t('resources.groupStatus')}>{statuses.map(s => <option key={s} value={s}>{t(`status.${s}`)}</option>)}</optgroup>
      </select>
    </label>

    {loading && <p role="status">{t('resources.loading')}</p>}
    {live && query.isError && <div role="alert" className="panel"><h3>{t('resources.loadFailed')}</h3><p className="error">{message(query.error, t)}</p><button type="button" onClick={() => void query.refetch()}>{t('resources.tryAgain')}</button></div>}
    {items.length > 0
      ? <div className="resource-grid">{items.map(resource => <ResourceCard key={resource.id} resource={resource} now={now} canReport={canReport} onSignIn={onSignIn} />)}</div>
      : !loading && !(live && query.isError) && <div className="panel">
        <h3>{all.length === 0 ? t('resources.emptyTitle', { city }) : t('resources.emptyFilter')}</h3>
        <p>{all.length === 0 ? simulating ? t('resources.emptySim') : t('resources.emptyHelp') : t('resources.tryFilter')}</p>
      </div>}

    {live && query.isSuccess && <p className="muted">{t('resources.lastChecked', { time: timeAgo(new Date(query.dataUpdatedAt).toISOString(), now, lang === 'en' ? undefined : htmlLang[lang]) })}</p>}
    <p className="muted">{t('resources.safetyNote')}</p>
  </section>
}
