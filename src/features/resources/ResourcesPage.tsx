import { lazy, Suspense, useEffect, useState, type FormEvent } from 'react'
import { BatteryCharging, Bus, Droplets, Flag, HeartPulse, House, PawPrint, Plus, Trash2, type LucideIcon } from 'lucide-react'
import { useCommunitySession } from '../community/session'
import { cityCenter, hasLiveCoverage } from '../hazards/liveHazards'
import { useSimulation } from '../simulation/context'
import { addressFromMap } from './geocode'
import { timeAgo } from './format'
import { useCreateResource, useRemoveResource, useReportResource, useResources } from './hooks'
import { sampleResources } from './sampleData'
import {
  categories, categoryLabels, filterResources, isStale, reasonLabels, reportReasons, statusLabels, statuses,
  type ReportReason, type Resource, type ResourceCategory, type ResourceFilter,
} from './schemas'

const icons: Record<ResourceCategory, LucideIcon> = {
  shelter: House, water_food: Droplets, medical: HeartPulse, charging: BatteryCharging, pets: PawPrint, transportation: Bus,
}

function message(error: unknown) {
  return typeof error === 'object' && error && 'message' in error ? String(error.message) : 'Something went wrong. Please try again.'
}

function ReportForm({ resource, onDone }: { resource: Resource; onDone: () => void }) {
  const report = useReportResource()
  const [reason, setReason] = useState<ReportReason>('inaccurate')
  const [details, setDetails] = useState('')
  async function submit(event: FormEvent) {
    event.preventDefault()
    try { await report.mutateAsync({ id: resource.id, reason, details }) } catch { /* Shown below. */ }
  }
  if (report.isSuccess) return <div className="report-form" role="status">
    <p>Thanks. Your report on “{resource.title}” was sent for review.</p>
    <button type="button" onClick={onDone}>Close</button>
  </div>
  return <form className="report-form" onSubmit={submit} aria-label={`Report ${resource.title}`}>
    <label>What’s wrong?<select value={reason} onChange={e => setReason(e.target.value as ReportReason)} disabled={report.isPending}>
      {reportReasons.map(r => <option key={r} value={r}>{reasonLabels[r]}</option>)}
    </select></label>
    <label>Details (optional)<textarea rows={2} maxLength={1000} value={details} onChange={e => setDetails(e.target.value)} disabled={report.isPending} /></label>
    <div className="row"><button type="submit" disabled={report.isPending}>{report.isPending ? 'Sending…' : 'Send report'}</button><button type="button" disabled={report.isPending} onClick={onDone}>Cancel</button></div>
    {report.isError && <p role="alert" className="error">{message(report.error)}</p>}
  </form>
}

function ResourceCard({ resource, now, canReport, onSignIn }: { resource: Resource; now: number; canReport: boolean; onSignIn: () => void }) {
  const { session } = useCommunitySession()
  const remove = useRemoveResource()
  const [reporting, setReporting] = useState(false)
  const Icon = icons[resource.category]
  const stale = isStale(resource, now)
  const mine = Boolean(session) && session?.user.id === resource.author_id && resource.status === 'community_submitted'
  return <article className="resource-card" aria-label={resource.title}>
    <div className="resource-title"><Icon size={24} aria-hidden="true" /><h3>{resource.title}</h3></div>
    <p className="muted resource-where">{categoryLabels[resource.category]} · {resource.location_text}</p>
    <span className={`status-badge ${resource.status}`}>{statusLabels[resource.status]}</span>
    <p className="resource-description">{resource.description}</p>
    <div className="resource-foot">
      <span>{resource.source}</span>
      <span>Confirmed {timeAgo(resource.last_confirmed_at, now)}{stale && <strong className="stale-tag"> · May be out of date</strong>}</span>
      <div className="resource-actions">
        {canReport && (reporting
          ? null
          : session
            ? <button type="button" className="report-button" onClick={() => setReporting(true)}><Flag size={14} aria-hidden="true" />Report inaccurate or unsafe</button>
            : <button type="button" className="report-button" onClick={onSignIn}><Flag size={14} aria-hidden="true" />Sign in to report a problem</button>)}
        {canReport && mine && <button type="button" className="ghost danger" disabled={remove.isPending} onClick={() => void remove.mutateAsync(resource.id).catch(() => {})}><Trash2 size={14} aria-hidden="true" />{remove.isPending ? 'Removing…' : 'Remove my submission'}</button>}
      </div>
    </div>
    {remove.isError && <p role="alert" className="error">{message(remove.error)}</p>}
    {reporting && <ReportForm resource={resource} onDone={() => setReporting(false)} />}
  </article>
}

const LocationPicker = lazy(() => import('./LocationPicker'))

export function AddResource({ city, onDone }: { city: string; onDone: () => void }) {
  const create = useCreateResource()
  const [category, setCategory] = useState<ResourceCategory>('water_food')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [location, setLocation] = useState('')
  const [addressEdited, setAddressEdited] = useState(false)
  const [pin, setPin] = useState<{ lat: number; lng: number } | null>(null)
  // Looking up the city center is only a starting view for the map; it is never stored as the pin.
  const center = hasLiveCoverage(city) ? cityCenter(city) : cityCenter('Santa Rosa')
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!pin) return
    try {
      await create.mutateAsync({ category, title, description, location_text: location, city, latitude: pin.lat, longitude: pin.lng })
      onDone()
    } catch { /* Shown below; keep the draft. */ }
  }
  return <form className="panel add-resource" onSubmit={submit} aria-label="Add a resource">
    <h3>Add a resource in {city}</h3>
    <p className="muted">Shown as community-submitted and unverified until a reviewer confirms it.</p>
    <label>Type<select value={category} onChange={e => setCategory(e.target.value as ResourceCategory)} disabled={create.isPending}>
      {categories.map(c => <option key={c} value={c}>{categoryLabels[c]}</option>)}
    </select></label>
    <label>Name<input value={title} onChange={e => setTitle(e.target.value)} required maxLength={180} disabled={create.isPending} /></label>
    <label>What’s available<textarea rows={3} value={description} onChange={e => setDescription(e.target.value)} required maxLength={2000} disabled={create.isPending} /></label>
    <fieldset className="pin-field">
      <legend>Where is it?</legend>
      <Suspense fallback={<p className="muted" role="status">Loading map…</p>}>
        <LocationPicker center={center} pin={pin} onPin={setPin} onLabel={label => setLocation(current => addressFromMap(label, current, addressEdited))} />
      </Suspense>
    </fieldset>
    <label>Address or landmark<input value={location} onChange={e => { setLocation(e.target.value); setAddressEdited(e.target.value.trim() !== '') }} required maxLength={240} disabled={create.isPending} placeholder="Fills in as you place the pin. You can edit it." /></label>
    <div className="row"><button type="submit" disabled={create.isPending || !pin || !title.trim() || !description.trim() || !location.trim()}>{create.isPending ? 'Adding…' : 'Add resource'}</button><button type="button" disabled={create.isPending} onClick={onDone}>Cancel</button></div>
    {!pin && <p className="muted" role="status">Place a pin on the map to add this resource.</p>}
    {create.isError && <p role="alert" className="error">{message(create.error)}</p>}
  </form>
}

export function ResourcesPage({ city, onSignIn }: { city: string; onSignIn: () => void }) {
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

  return <section className="resources" aria-label="Resources">
    <div className="resources-heading">
      <div>
        <h2>{simulating ? 'Simulated resources' : `Resources in ${city}`}</h2>
        <p className="muted">Shelters and supplies, labeled by who confirmed them. Confirm with the source before you travel.</p>
      </div>
      {live && (session
        ? <button type="button" className="new-post-button" onClick={() => setAdding(!adding)}><Plus size={16} aria-hidden="true" />Add a resource</button>
        : <button type="button" className="new-post-button" onClick={onSignIn}><Plus size={16} aria-hidden="true" />Sign in to add a resource</button>)}
    </div>

    {simulating && <p className="notice" role="status">Simulation running: these resources are sample data and open and close with the scenario. Adding and reporting are turned off.</p>}
    {!configured && !simulating && <p className="notice" role="status">Sample resources. Connect Supabase to load live data.</p>}
    {adding && live && session && <AddResource city={city} onDone={() => setAdding(false)} />}

    <label className="resource-filter">Show
      <select value={filter} onChange={e => setFilter(e.target.value as ResourceFilter)}>
        <option value="all">All resources</option>
        <optgroup label="Type">{categories.map(c => <option key={c} value={c}>{categoryLabels[c]}</option>)}</optgroup>
        <optgroup label="Status">{statuses.map(s => <option key={s} value={s}>{statusLabels[s]}</option>)}</optgroup>
      </select>
    </label>

    {loading && <p role="status">Loading resources…</p>}
    {live && query.isError && <div role="alert" className="panel"><h3>Couldn’t load resources</h3><p className="error">{message(query.error)}</p><button type="button" onClick={() => void query.refetch()}>Try again</button></div>}
    {items.length > 0
      ? <div className="resource-grid">{items.map(resource => <ResourceCard key={resource.id} resource={resource} now={now} canReport={canReport} onSignIn={onSignIn} />)}</div>
      : !loading && !(live && query.isError) && <div className="panel">
        <h3>{all.length === 0 ? `No resources listed for ${city} yet` : 'No resources match this filter'}</h3>
        <p>{all.length === 0 ? simulating ? 'Resources open as the simulation runs. Step forward to see them.' : 'This does not mean help is unavailable. Check official sources and call 911 in an emergency.' : 'Try another filter.'}</p>
      </div>}

    {live && query.isSuccess && <p className="muted">Last checked {timeAgo(new Date(query.dataUpdatedAt).toISOString(), now)} · Updates every 30 seconds.</p>}
    <p className="muted">Community resources are unverified unless marked verified or official. Follow instructions from local officials. In an emergency, call 911.</p>
  </section>
}
