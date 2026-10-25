import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { CircleHelp, Megaphone, MessageCircle, MessageSquare, Pencil, SquarePen, Trash2 } from 'lucide-react'
import { communityApi } from './features/community/api'
import { useCommunityFeed, useOfficialAlert, usePostMutation, usePostReplies, useReplyMutation } from './features/community/hooks'
import { PostTypeTag } from './features/community/PostTypeTag'
import { useCommunitySession } from './features/community/session'
import type { CommunityPost, CommunityReply, PostType } from './features/community/schemas'
import { AlertSummary, AlertTags } from './features/alerts/AlertSummary'
import { nwsLink, nwsSeverity, responderParagraphs, safeHttpUrl, type AlertSeverity } from './features/alerts/alertFormat'
import { alertParagraphs } from './features/hazards/alertText'
import { cityCenter, hasLiveCoverage, topWeatherAlert, useEarthquakes, useFireIncidents, useWeatherAlerts } from './features/hazards/liveHazards'
import { MapPage } from './features/map/MapPage'
import { NewsPage } from './features/news/NewsPage'
import { ResourcesPage } from './features/resources/ResourcesPage'
import { SamPage } from './features/sam/SamPage'
import { useI18n } from './features/i18n/context'
import { dateLocale } from './features/i18n/languages'
import { TranslatableText } from './features/i18n/TranslatableText'
import { useSimulation } from './features/simulation/context'
import { AppShell, type Page } from './layout/AppShell'
import './App.css'

function ErrorMessage({ error }: { error: unknown }) {
  const { t } = useI18n()
  if (!error) return null
  const message = typeof error === 'object' && 'message' in error ? String(error.message) : t('error.generic')
  return <p role="alert" className="error">{message}</p>
}

function Timestamp({ value }: { value: string }) {
  const { lang } = useI18n()
  return <time dateTime={value}>{new Date(value).toLocaleString(dateLocale(lang), { dateStyle: 'medium', timeStyle: 'short' })}</time>
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part.charAt(0).toUpperCase()).join('') || '?'
}

function Account() {
  const { t } = useI18n()
  const { session, loading, configured, error: sessionError } = useCommunitySession()
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [confirmEmail, setConfirmEmail] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const signingUp = mode === 'signup'
  async function submit(event: FormEvent) {
    event.preventDefault()
    setBusy(true); setError(null); setConfirmEmail(false)
    try {
      if (signingUp) {
        const { needsConfirmation } = await communityApi.signUp(email, password, name)
        if (needsConfirmation) setConfirmEmail(true)
      } else await communityApi.signIn(email, password)
      setPassword('')
    }
    catch (failure) { setError(failure) }
    finally { setBusy(false) }
  }
  async function signOut() {
    setBusy(true); setError(null)
    try { await communityApi.signOut(); setConfirmEmail(false); setEmail(''); setPassword(''); setName('') }
    catch (failure) { setError(failure) }
    finally { setBusy(false) }
  }
  return <section className="panel" aria-labelledby="account-heading">
    <h2 id="account-heading">{session ? t('account.title.signedIn') : signingUp ? t('account.title.signUp') : t('account.title.signIn')}</h2>
    <ErrorMessage error={sessionError || error} />
    {loading ? <p role="status">{t('account.checking')}</p> : session ? <>
      <p>{t('account.signedInNote')}</p>
      <button onClick={() => void signOut()} disabled={busy}>{busy ? t('profile.signingOut') : t('profile.signOut')}</button>
    </> : <form onSubmit={submit}>
      <p className="muted">{t('account.readNote')}</p>
      {signingUp && <label>{t('account.displayName')}<input value={name} onChange={e => setName(e.target.value)} required maxLength={80} autoComplete="nickname" disabled={busy} /></label>}
      <label>{t('account.email')}<input type="email" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" disabled={busy} /></label>
      <label>{t('account.password')}<input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={signingUp ? 8 : undefined} autoComplete={signingUp ? 'new-password' : 'current-password'} disabled={busy} /></label>
      {signingUp && <p className="muted">{t('account.emailPrivate')}</p>}
      <button type="submit" disabled={busy || !configured || (signingUp && !name.trim())}>{busy ? t('account.wait') : signingUp ? t('account.create') : t('profile.signIn')}</button>
      <button type="button" className="link-button" disabled={busy} onClick={() => { setMode(signingUp ? 'signin' : 'signup'); setError(null); setConfirmEmail(false) }}>{signingUp ? t('account.haveOne') : t('account.newHere')}</button>
      {confirmEmail && <p role="status">{t('account.confirmEmail')}</p>}
    </form>}
  </section>
}

function SignInPage({ onBack }: { onBack: () => void }) {
  const { t } = useI18n()
  return <div className="sign-in-page">
    <button type="button" className="link-button" onClick={onBack}>{t('account.back')}</button>
    <Account />
  </div>
}

const postFilters = [
  { id: 'all', label: 'filter.all' },
  { id: 'update', label: 'filter.update' },
  { id: 'question', label: 'filter.question' },
  { id: 'general', label: 'filter.general' },
] as const

const postTypes = [
  { id: 'update', label: 'type.update', Icon: Megaphone },
  { id: 'question', label: 'type.question', Icon: CircleHelp },
  { id: 'general', label: 'type.general', Icon: MessageCircle },
] as const

function PostComposer({ city }: { city: string }) {
  const { t } = useI18n()
  const { session } = useCommunitySession()
  const [body, setBody] = useState('')
  const [type, setType] = useState<'update' | 'question' | 'general'>('update')
  const mutation = usePostMutation()
  const name = String(session?.user.user_metadata?.display_name || t('post.resident'))
  async function submit(event: FormEvent) {
    event.preventDefault()
    try {
      await mutation.mutateAsync({ action: 'create', input: { city, body, post_type: type } })
      setBody('')
    } catch { /* The error is rendered below; keep the draft. */ }
  }
  return <form className="composer" onSubmit={submit} aria-label={t('composer.label', { city })}>
    <span className="avatar" aria-hidden="true">{initials(name)}</span>
    <div className="composer-main">
      <textarea className="composer-input" aria-label={t('composer.label', { city })} placeholder={t('composer.placeholder', { city })} value={body} onChange={e => setBody(e.target.value)} rows={1} maxLength={5000} disabled={mutation.isPending} />
      <div className="composer-bar">
        <div className="composer-types" role="radiogroup" aria-label={t('type.label')}>
          {postTypes.map(({ id, label, Icon }) => <button key={id} type="button" role="radio" aria-checked={type === id} className="type-chip" disabled={mutation.isPending} onClick={() => setType(id)}><Icon size={16} aria-hidden="true" />{t(label)}</button>)}
        </div>
        {body.length > 4500 && <span className="muted">{body.length}/5000</span>}
        <button type="submit" className="post-button" disabled={mutation.isPending || !body.trim()}>{mutation.isPending ? t('composer.posting') : t('composer.post')}</button>
      </div>
      <ErrorMessage error={mutation.error} />
    </div>
  </form>
}

// Returns the icon buttons (for a header) and the edit form or delete confirmation (for below the text).
function useEntryActions({ body, maxLength, onSave, onDelete, busy, post }: {
  body: string; maxLength: number; onSave: (body: string) => Promise<unknown>
  onDelete: () => Promise<unknown>; busy: boolean; post?: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [draft, setDraft] = useState(body)
  const { t } = useI18n()
  const editLabel = post ? t('entry.editPost') : t('entry.editReply')
  const deleteLabel = post ? t('entry.deletePost') : t('entry.deleteReply')
  async function save(event: FormEvent) {
    event.preventDefault()
    try { await onSave(draft); setEditing(false) } catch { /* Keep edits on failure. */ }
  }
  const buttons = <div className="actions">
    <button className="ghost icon" aria-label={editLabel} title={t('entry.edit')} disabled={busy || editing || deleting} onClick={() => { setDraft(body); setEditing(true) }}><Pencil size={18} aria-hidden="true" /></button>
    <button className="ghost icon danger" aria-label={deleteLabel} title={t('entry.delete')} disabled={busy || editing || deleting} onClick={() => setDeleting(true)}><Trash2 size={18} aria-hidden="true" /></button>
  </div>
  const panel = editing ? <form onSubmit={save} className="edit-form">
    <label>{editLabel}<textarea value={draft} onChange={e => setDraft(e.target.value)} required maxLength={maxLength} rows={3} disabled={busy} autoFocus /></label>
    <div className="row"><button type="submit" disabled={busy || !draft.trim()}>{busy ? t('entry.saving') : t('entry.save')}</button><button type="button" disabled={busy} onClick={() => setEditing(false)}>{t('entry.cancel')}</button></div>
  </form> : deleting ? <div className="delete-confirm" role="alertdialog" aria-label={deleteLabel}>
    <p><strong>{post ? t('entry.confirmPost') : t('entry.confirmReply')}</strong> {t('entry.undone')}</p>
    <div className="row"><button className="danger-solid" disabled={busy} onClick={() => void onDelete().then(() => setDeleting(false)).catch(() => {})}>{busy ? t('entry.deleting') : t('entry.delete')}</button><button disabled={busy} onClick={() => setDeleting(false)}>{t('entry.keep')}</button></div>
  </div> : null
  return { buttons, panel }
}

function ReplyItem({ reply }: { reply: CommunityReply }) {
  const { t } = useI18n()
  const { session } = useCommunitySession()
  const mutation = useReplyMutation()
  const actions = useEntryActions({ body: reply.body, maxLength: 2000, busy: mutation.isPending,
    onSave: body => mutation.mutateAsync({ action: 'edit', id: reply.id, body }),
    onDelete: () => mutation.mutateAsync({ action: 'delete', id: reply.id }) })
  const mine = session?.user.id === reply.author_id
  return <li className="reply">
    <div className="reply-head">
      <div className="meta"><strong>{reply.author?.display_name || t('post.resident')}</strong><Timestamp value={reply.created_at} />{reply.updated_at !== reply.created_at && <span>{t('post.edited')}</span>}</div>
      {mine && actions.buttons}
    </div>
    <TranslatableText text={reply.body} className="body-text" />
    {mine && actions.panel}
    <ErrorMessage error={mutation.error} />
  </li>
}

function Replies({ postId, onSignIn }: { postId: string; onSignIn: () => void }) {
  const { t } = useI18n()
  const { session } = useCommunitySession()
  const query = usePostReplies(postId)
  const mutation = useReplyMutation()
  const [body, setBody] = useState('')
  const replies = query.data?.pages.flatMap(page => page.replies) || []
  async function submit(event: FormEvent) {
    event.preventDefault()
    try { await mutation.mutateAsync({ action: 'create', postId, body }); setBody('') } catch { /* Preserve draft. */ }
  }
  return <section className="replies" aria-label={t('reply.region')}>
    {query.isPending && <p role="status">{t('reply.loading')}</p>}
    {query.isError && <><ErrorMessage error={query.error} /><button onClick={() => void query.refetch()}>{t('reply.retry')}</button></>}
    {query.isSuccess && !replies.length && <p className="muted">{t('reply.none')}</p>}
    <ul className="reply-list">{replies.map(reply => <ReplyItem key={reply.id} reply={reply} />)}</ul>
    {query.hasNextPage && <button disabled={query.isFetchingNextPage} onClick={() => void query.fetchNextPage()}>{t('reply.more')}</button>}
    {session ? <form key={session.user.id} onSubmit={submit}>
      <label>{t('reply.yours')}<textarea rows={2} maxLength={2000} required value={body} onChange={e => setBody(e.target.value)} disabled={mutation.isPending} /></label>
      <button type="submit" disabled={mutation.isPending || !body.trim()}>{mutation.isPending ? t('reply.replying') : t('reply.publish')}</button>
      <ErrorMessage error={mutation.error} />
    </form> : <button type="button" className="sign-in-button" onClick={onSignIn}>{t('reply.signIn')}</button>}
  </section>
}

function PostCard({ post, sample = false, onSignIn }: { post: CommunityPost; sample?: boolean; onSignIn: () => void }) {
  const { t } = useI18n()
  const { session } = useCommunitySession()
  const mutation = usePostMutation()
  const [showReplies, setShowReplies] = useState(false)
  const actions = useEntryActions({ body: post.body, maxLength: 5000, busy: mutation.isPending, post: true,
    onSave: body => mutation.mutateAsync({ action: 'edit', id: post.id, input: { body } }),
    onDelete: () => mutation.mutateAsync({ action: 'delete', id: post.id }) })
  const mine = !sample && session?.user.id === post.author_id
  return <article className="panel post" aria-label={t('post.by', { name: post.author?.display_name || t('post.resident') })}>
    <div className="post-head">
      <span className="avatar" aria-hidden="true">{initials(post.author?.display_name || 'Resident')}</span>
      <div>
        <strong>{post.author?.display_name || t('post.resident')}</strong>
        <div className="meta"><Timestamp value={post.created_at} /><PostTypeTag type={post.post_type} />{post.updated_at !== post.created_at && <span>{t('post.edited')}</span>}</div>
      </div>
      <span className="badge community">{sample ? t('post.sample') : t('post.community')}</span>
      {mine && actions.buttons}
    </div>
    <TranslatableText text={post.body} className="body-text" />
    {mine && actions.panel}
    {!sample && <>
      <div className="post-footer">
        <button className="reply-toggle" aria-expanded={showReplies} onClick={() => setShowReplies(!showReplies)}><MessageSquare size={14} aria-hidden="true" />{showReplies ? t('post.hideReplies') : t('post.viewReplies')}</button>
      </div>
      <ErrorMessage error={mutation.error} />
      {showReplies && <Replies key={session?.user.id || 'guest'} postId={post.id} onSignIn={onSignIn} />}
    </>}
  </article>
}

function Feed({ city, onOpenMap, onSignIn }: { city: string; onOpenMap: () => void; onSignIn: () => void }) {
  const { t, tp, lang } = useI18n()
  const sim = useSimulation()
  const sample = sim.active
  const { session, configured } = useCommunitySession()
  const [typeFilter, setTypeFilter] = useState<'all' | PostType>('all')
  const feed = useCommunityFeed(sample ? '' : city, typeFilter === 'all' ? undefined : typeFilter)
  const alert = useOfficialAlert(sample ? '' : city)
  const fires = useFireIncidents(city)
  const quakes = useEarthquakes(city)
  const weather = useWeatherAlerts(city)
  const posts = sample ? (sim.state?.posts ?? []).filter(post => typeFilter === 'all' || post.post_type === typeFilter) : feed.data?.pages.flatMap(page => page.posts) || []
  const [refreshing, setRefreshing] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000)
    return () => window.clearInterval(timer)
  }, [])
  async function refresh() {
    setRefreshing(true)
    try { await Promise.all([feed.refetch(), alert.refetch()]) } finally { setRefreshing(false) }
  }
  const official = sample ? sim.state?.alert ?? null : alert.data
  const sourceUrl = safeHttpUrl(official?.source_url)
  const expired = official?.expires_at && Date.parse(official.expires_at) <= now
  // With no responder alert, pin the most serious live NWS alert instead, labelled as NWS public data.
  const nws = !sample && !official && (!configured || !alert.isPending) ? topWeatherAlert(weather.data ?? []) : null
  const severity: AlertSeverity = nws ? nwsSeverity(nws.severity, nws.event) : official?.severity ?? 'info'
  return <>
    <div className="row feed-heading"><h2>{sample ? t('feed.simTitle') : t('feed.title', { city })}</h2>
      <div className="row">
        {!sample && configured && !session && <button type="button" className="new-post-button" onClick={onSignIn}><SquarePen size={16} aria-hidden="true" />{t('feed.newPost')}</button>}
        {!sample && <button disabled={!configured || refreshing || feed.isFetching} onClick={() => void refresh()}>{refreshing ? t('feed.refreshing') : t('feed.refresh')}</button>}
      </div>
    </div>
    {sample && <>
      <p role="status" className="notice">{t('feed.simNotice')}</p>
      <section className={`official-card sev-${severity}`} aria-label={t('alert.region')}>
        <AlertTags kind="sample" severity={severity} />
        {official
          ? <AlertSummary alert={{ kind: 'sample', severity, title: official.title, paragraphs: responderParagraphs(official.instructions), issuedAt: official.issued_at, source: official.source_name }} />
          : <p>{t('feed.noSimAlert')}</p>}
      </section>
      <div className="incident-strip">
        <span className="live-dot" aria-hidden="true" />
        <strong>{tp('strip.fire', sim.state?.incidents.length ?? 0)} · {tp('strip.zone', sim.state?.zones.features.length ?? 0)} {t('strip.inSim')}</strong>
        <button type="button" onClick={onOpenMap}>{t('feed.viewMap')}</button>
        <span className="muted">{t('feed.sampleData')}</span>
      </div>
    </>}
    {!sample && <>
      {!configured && <p role="status" className="notice">{t('feed.notConfigured')}</p>}
      {(configured || nws) && <section className={`official-card sev-${severity}${expired ? ' expired' : ''}`} aria-label={t('alert.region')}>
        <AlertTags kind={nws ? 'nws' : 'official'} severity={severity} label={nws ? 'weather alert' : 'alert'} />
        {configured && alert.isPending && <p role="status">{t('feed.checkingAlerts')}</p>}
        {alert.isError && <><p>{t('feed.alertsFailed')}</p><ErrorMessage error={alert.error} /></>}
        {nws
          ? <AlertSummary
            alert={{
              kind: 'nws', severity, title: nws.event, paragraphs: alertParagraphs(nws.instruction ?? nws.headline), issuedAt: nws.effective, expiresAt: nws.expires,
              source: nws.senderName, sourceUrl: nwsLink(hasLiveCoverage(city) ? cityCenter(city) : undefined), note: t('feed.nwsNote', { city }),
            }}
            extra={(weather.data?.length ?? 0) > 1 ? <button type="button" className="link-button" onClick={onOpenMap}>{t('feed.moreOnMap', { n: (weather.data?.length ?? 0) - 1 })}</button> : null}
          />
          : <>
            {alert.isSuccess && !official && <p>{t('feed.noAlert', { city })}</p>}
            {alert.isError && official && <p className="error">{t('feed.alertStale')}</p>}
            {official && <AlertSummary alert={{
              kind: 'official', severity, title: official.title, paragraphs: responderParagraphs(official.instructions), issuedAt: official.issued_at,
              expiresAt: official.expires_at, source: official.source_name, sourceUrl, expired: Boolean(expired),
            }} />}
          </>}
      </section>}
      <div className="incident-strip">
        <span className="live-dot" aria-hidden="true" />
        {fires.isSuccess && quakes.isSuccess && weather.isSuccess
          ? <strong>{tp('strip.fire', fires.data.length)} · {tp('strip.quake', quakes.data.length)} · {tp('strip.weather', weather.data.length)} {t('strip.near', { city })}</strong>
          : <strong>{!hasLiveCoverage(city) ? t('feed.noCoverage') : fires.isError || quakes.isError || weather.isError ? t('feed.hazardUnavailable') : t('feed.hazardChecking')}</strong>}
        <button type="button" onClick={onOpenMap}>{t('feed.viewMap')}</button>
        <span className="muted">{t('feed.sources')}</span>
      </div>
      {session && configured && <PostComposer key={session.user.id} city={city} />}
      {configured && feed.isPending && <p role="status">{t('feed.loading')}</p>}
      {feed.isError && <section className="panel"><h3>{t('feed.loadFailed')}</h3><ErrorMessage error={feed.error} /><p>{t('feed.loadFailedHelp')}</p><button onClick={() => void refresh()}>{t('feed.tryAgain')}</button></section>}
      {feed.isError && posts.length > 0 && <p className="error">{t('feed.stalePosts')}</p>}
      {feed.isSuccess && !posts.length && <div className="panel"><h3>{typeFilter === 'all' ? t('feed.noPosts') : t('feed.noPostsFiltered')}</h3><p>{typeFilter === 'all' ? t('feed.beFirst', { city }) : t('feed.tryFilter', { city })}</p></div>}
    </>}
    {(sample || configured) && <div className="post-filter" role="radiogroup" aria-label={t('filter.label')}>
      {postFilters.map(({ id, label }) => <button key={id} type="button" role="radio" aria-checked={typeFilter === id} className="type-chip" onClick={() => setTypeFilter(id)}>{t(label)}</button>)}
    </div>}
    {sample && !posts.length && <p className="muted">{t('feed.noSimPosts')}</p>}
    <div className="posts">{posts.map(post => <PostCard key={post.id} post={post} sample={sample} onSignIn={onSignIn} />)}</div>
    {!sample && feed.hasNextPage && <button disabled={feed.isFetchingNextPage} onClick={() => void feed.fetchNextPage()}>{feed.isFetchingNextPage ? t('feed.loadingMore') : t('feed.loadOlder')}</button>}
    {!sample && feed.dataUpdatedAt > 0 && <p className="muted">{t('feed.lastChecked', { time: new Date(feed.dataUpdatedAt).toLocaleString(dateLocale(lang), { dateStyle: 'medium', timeStyle: 'short' }) })}</p>}
  </>
}

function App() {
  const { t } = useI18n()
  const [page, setPage] = useState<Page>('feed')
  const [city, setCity] = useState('Santa Rosa')

  function openSignIn() {
    setPage('signin')
    window.scrollTo(0, 0)
  }

  return <AppShell page={page} onNavigate={setPage} city={city} onCityChange={setCity}>
    {page === 'feed' && <section className="feed" aria-label={t('feed.region')}>
      <Feed key={city} city={city} onOpenMap={() => setPage('map')} onSignIn={openSignIn} />
    </section>}
    {page === 'map' && <MapPage city={city} />}
    {page === 'news' && <NewsPage city={city} />}
    {page === 'resources' && <ResourcesPage city={city} onSignIn={openSignIn} />}
    {page === 'sam' && <SamPage city={city} onOpenMap={() => setPage('map')} />}
    {page === 'signin' && <SignInPage onBack={() => setPage('feed')} />}
  </AppShell>
}

export default App
