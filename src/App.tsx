import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { BadgeCheck, CircleHelp, ExternalLink, Megaphone, MessageCircle, MessageSquare, Pencil, Pin, SquarePen, Trash2 } from 'lucide-react'
import { communityApi } from './features/community/api'
import { useCommunityFeed, useOfficialAlert, usePostMutation, usePostReplies, useReplyMutation } from './features/community/hooks'
import { useCommunitySession } from './features/community/session'
import type { CommunityPost, CommunityReply, PostType } from './features/community/schemas'
import { hasLiveCoverage, NO_COVERAGE, useEarthquakes, useFireIncidents, useWeatherAlerts } from './features/hazards/liveHazards'
import { MapPage } from './features/map/MapPage'
import { NewsPage } from './features/news/NewsPage'
import { useSimulation } from './features/simulation/context'
import { AppShell, ComingSoon, type Page } from './layout/AppShell'
import './App.css'

function ErrorMessage({ error }: { error: unknown }) {
  if (!error) return null
  const message = typeof error === 'object' && 'message' in error ? String(error.message) : 'Something went wrong. Please try again.'
  return <p role="alert" className="error">{message}</p>
}

function Timestamp({ value }: { value: string }) {
  return <time dateTime={value}>{new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</time>
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part.charAt(0).toUpperCase()).join('') || '?'
}

function Account() {
  const { session, loading, configured, error: sessionError } = useCommunitySession()
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState<unknown>(null)
  const signingUp = mode === 'signup'
  async function submit(event: FormEvent) {
    event.preventDefault()
    setBusy(true); setError(null); setNotice('')
    try {
      if (signingUp) {
        const { needsConfirmation } = await communityApi.signUp(email, password, name)
        if (needsConfirmation) setNotice('Account created. Confirm your email, then sign in.')
      } else await communityApi.signIn(email, password)
      setPassword('')
    }
    catch (failure) { setError(failure) }
    finally { setBusy(false) }
  }
  async function signOut() {
    setBusy(true); setError(null)
    try { await communityApi.signOut(); setNotice(''); setEmail(''); setPassword(''); setName('') }
    catch (failure) { setError(failure) }
    finally { setBusy(false) }
  }
  return <section className="panel" aria-labelledby="account-heading">
    <h2 id="account-heading">{session ? 'Your account' : signingUp ? 'Create an account' : 'Sign in to post'}</h2>
    <ErrorMessage error={sessionError || error} />
    {loading ? <p role="status">Checking your session…</p> : session ? <>
      <p>You’re signed in. Your posts show your public display name.</p>
      <button onClick={() => void signOut()} disabled={busy}>{busy ? 'Signing out…' : 'Sign out'}</button>
    </> : <form onSubmit={submit}>
      <p className="muted">Anyone can read the feed. Sign in to contribute.</p>
      {signingUp && <label>Public display name<input value={name} onChange={e => setName(e.target.value)} required maxLength={80} autoComplete="nickname" disabled={busy} /></label>}
      <label>Email<input type="email" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" disabled={busy} /></label>
      <label>Password<input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={signingUp ? 8 : undefined} autoComplete={signingUp ? 'new-password' : 'current-password'} disabled={busy} /></label>
      {signingUp && <p className="muted">Your email won’t appear on posts.</p>}
      <button type="submit" disabled={busy || !configured || (signingUp && !name.trim())}>{busy ? 'Please wait…' : signingUp ? 'Create account' : 'Sign in'}</button>
      <button type="button" className="link-button" disabled={busy} onClick={() => { setMode(signingUp ? 'signin' : 'signup'); setError(null); setNotice('') }}>{signingUp ? 'Have an account? Sign in' : 'New here? Create an account'}</button>
      {notice && <p role="status">{notice}</p>}
    </form>}
  </section>
}

function SignInPage({ onBack }: { onBack: () => void }) {
  return <div className="sign-in-page">
    <button type="button" className="link-button" onClick={onBack}>← Back to feed</button>
    <Account />
  </div>
}

const postFilters = [
  { id: 'all', label: 'All' },
  { id: 'update', label: 'Updates' },
  { id: 'question', label: 'Questions' },
  { id: 'general', label: 'General' },
] as const

const postTypes = [
  { id: 'update', label: 'Update', Icon: Megaphone },
  { id: 'question', label: 'Question', Icon: CircleHelp },
  { id: 'general', label: 'General', Icon: MessageCircle },
] as const

function PostComposer({ city }: { city: string }) {
  const { session } = useCommunitySession()
  const [body, setBody] = useState('')
  const [type, setType] = useState<'update' | 'question' | 'general'>('update')
  const mutation = usePostMutation()
  const name = String(session?.user.user_metadata?.display_name || 'Resident')
  async function submit(event: FormEvent) {
    event.preventDefault()
    try {
      await mutation.mutateAsync({ action: 'create', input: { city, body, post_type: type } })
      setBody('')
    } catch { /* The error is rendered below; keep the draft. */ }
  }
  return <form className="composer" onSubmit={submit} aria-label={`Post to ${city}`}>
    <span className="avatar" aria-hidden="true">{initials(name)}</span>
    <div className="composer-main">
      <textarea className="composer-input" aria-label={`Post to ${city}`} placeholder={`What’s happening in ${city}?`} value={body} onChange={e => setBody(e.target.value)} rows={1} maxLength={5000} disabled={mutation.isPending} />
      <div className="composer-bar">
        <div className="composer-types" role="radiogroup" aria-label="Post type">
          {postTypes.map(({ id, label, Icon }) => <button key={id} type="button" role="radio" aria-checked={type === id} className="type-chip" disabled={mutation.isPending} onClick={() => setType(id)}><Icon size={16} aria-hidden="true" />{label}</button>)}
        </div>
        {body.length > 4500 && <span className="muted">{body.length}/5000</span>}
        <button type="submit" className="post-button" disabled={mutation.isPending || !body.trim()}>{mutation.isPending ? 'Posting…' : 'Post'}</button>
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
  const noun = post ? 'post' : 'reply'
  async function save(event: FormEvent) {
    event.preventDefault()
    try { await onSave(draft); setEditing(false) } catch { /* Keep edits on failure. */ }
  }
  const buttons = <div className="actions">
    <button className="ghost icon" aria-label={`Edit ${noun}`} title="Edit" disabled={busy || editing || deleting} onClick={() => { setDraft(body); setEditing(true) }}><Pencil size={18} aria-hidden="true" /></button>
    <button className="ghost icon danger" aria-label={`Delete ${noun}`} title="Delete" disabled={busy || editing || deleting} onClick={() => setDeleting(true)}><Trash2 size={18} aria-hidden="true" /></button>
  </div>
  const panel = editing ? <form onSubmit={save} className="edit-form">
    <label>Edit {noun}<textarea value={draft} onChange={e => setDraft(e.target.value)} required maxLength={maxLength} rows={3} disabled={busy} autoFocus /></label>
    <div className="row"><button type="submit" disabled={busy || !draft.trim()}>{busy ? 'Saving…' : 'Save changes'}</button><button type="button" disabled={busy} onClick={() => setEditing(false)}>Cancel</button></div>
  </form> : deleting ? <div className="delete-confirm" role="alertdialog" aria-label={`Delete this ${noun}`}>
    <p><strong>Delete this {post ? 'post and its replies' : 'reply'}?</strong> This can’t be undone.</p>
    <div className="row"><button className="danger-solid" disabled={busy} onClick={() => void onDelete().then(() => setDeleting(false)).catch(() => {})}>{busy ? 'Deleting…' : 'Delete'}</button><button disabled={busy} onClick={() => setDeleting(false)}>Keep it</button></div>
  </div> : null
  return { buttons, panel }
}

function ReplyItem({ reply }: { reply: CommunityReply }) {
  const { session } = useCommunitySession()
  const mutation = useReplyMutation()
  const actions = useEntryActions({ body: reply.body, maxLength: 2000, busy: mutation.isPending,
    onSave: body => mutation.mutateAsync({ action: 'edit', id: reply.id, body }),
    onDelete: () => mutation.mutateAsync({ action: 'delete', id: reply.id }) })
  const mine = session?.user.id === reply.author_id
  return <li className="reply">
    <div className="reply-head">
      <div className="meta"><strong>{reply.author?.display_name || 'Resident'}</strong><Timestamp value={reply.created_at} />{reply.updated_at !== reply.created_at && <span>Edited</span>}</div>
      {mine && actions.buttons}
    </div>
    <p className="body-text">{reply.body}</p>
    {mine && actions.panel}
    <ErrorMessage error={mutation.error} />
  </li>
}

function Replies({ postId, onSignIn }: { postId: string; onSignIn: () => void }) {
  const { session } = useCommunitySession()
  const query = usePostReplies(postId)
  const mutation = useReplyMutation()
  const [body, setBody] = useState('')
  const replies = query.data?.pages.flatMap(page => page.replies) || []
  async function submit(event: FormEvent) {
    event.preventDefault()
    try { await mutation.mutateAsync({ action: 'create', postId, body }); setBody('') } catch { /* Preserve draft. */ }
  }
  return <section className="replies" aria-label="Post replies">
    {query.isPending && <p role="status">Loading replies…</p>}
    {query.isError && <><ErrorMessage error={query.error} /><button onClick={() => void query.refetch()}>Retry replies</button></>}
    {query.isSuccess && !replies.length && <p className="muted">No replies yet.</p>}
    <ul className="reply-list">{replies.map(reply => <ReplyItem key={reply.id} reply={reply} />)}</ul>
    {query.hasNextPage && <button disabled={query.isFetchingNextPage} onClick={() => void query.fetchNextPage()}>Load more replies</button>}
    {session ? <form key={session.user.id} onSubmit={submit}>
      <label>Your reply<textarea rows={2} maxLength={2000} required value={body} onChange={e => setBody(e.target.value)} disabled={mutation.isPending} /></label>
      <button type="submit" disabled={mutation.isPending || !body.trim()}>{mutation.isPending ? 'Replying…' : 'Publish reply'}</button>
      <ErrorMessage error={mutation.error} />
    </form> : <button type="button" className="sign-in-button" onClick={onSignIn}>Sign in to reply</button>}
  </section>
}

function PostCard({ post, sample = false, onSignIn }: { post: CommunityPost; sample?: boolean; onSignIn: () => void }) {
  const { session } = useCommunitySession()
  const mutation = usePostMutation()
  const [showReplies, setShowReplies] = useState(false)
  const actions = useEntryActions({ body: post.body, maxLength: 5000, busy: mutation.isPending, post: true,
    onSave: body => mutation.mutateAsync({ action: 'edit', id: post.id, input: { body } }),
    onDelete: () => mutation.mutateAsync({ action: 'delete', id: post.id }) })
  const mine = !sample && session?.user.id === post.author_id
  return <article className="panel post" aria-label={`Post by ${post.author?.display_name || 'Resident'}`}>
    <div className="post-head">
      <span className="avatar" aria-hidden="true">{initials(post.author?.display_name || 'Resident')}</span>
      <div>
        <strong>{post.author?.display_name || 'Resident'}</strong>
        <div className="meta"><Timestamp value={post.created_at} /><span className="post-type">{post.post_type}</span>{post.updated_at !== post.created_at && <span>Edited</span>}</div>
      </div>
      <span className="badge community">{sample ? 'Sample post' : 'Community · unverified'}</span>
      {mine && actions.buttons}
    </div>
    <p className="body-text">{post.body}</p>
    {mine && actions.panel}
    {!sample && <>
      <div className="post-footer">
        <button className="reply-toggle" aria-expanded={showReplies} onClick={() => setShowReplies(!showReplies)}><MessageSquare size={14} aria-hidden="true" />{showReplies ? 'Hide replies' : 'View replies'}</button>
      </div>
      <ErrorMessage error={mutation.error} />
      {showReplies && <Replies key={session?.user.id || 'guest'} postId={post.id} onSignIn={onSignIn} />}
    </>}
  </article>
}

function Feed({ city, onOpenMap, onSignIn }: { city: string; onOpenMap: () => void; onSignIn: () => void }) {
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
  const sourceUrl = official?.source_url && /^https?:\/\//i.test(official.source_url) ? official.source_url : null
  const expired = official?.expires_at && Date.parse(official.expires_at) <= now
  return <>
    <div className="row feed-heading"><h2>{sample ? 'Simulated feed' : `${city} feed`}</h2>
      <div className="row">
        {!sample && configured && !session && <button type="button" className="new-post-button" onClick={onSignIn}><SquarePen size={16} aria-hidden="true" />New post</button>}
        {!sample && <button disabled={!configured || refreshing || feed.isFetching} onClick={() => void refresh()}>{refreshing ? 'Refreshing…' : 'Refresh'}</button>}
      </div>
    </div>
    {sample && <>
      <p role="status" className="notice">Simulation running: these alerts and posts are sample data, not real events. Posting is turned off.</p>
      <section className="official-card" aria-label="Latest official alert">
        <div>
          <div className="official-tags">
            <span className="official-badge"><BadgeCheck size={14} aria-hidden="true" />OFFICIAL</span>
            <span className="pinned"><Pin size={13} aria-hidden="true" />Pinned · Latest alert</span>
            <span className="badge community">Sample data</span>
          </div>
          {official ? <>
            <h2>{official.title}</h2>
            <p className="body-text">{official.instructions}</p>
          </> : <p>No official alert has been issued yet in this simulation.</p>}
        </div>
        {official && <div className="official-meta">
          <div>Issued <Timestamp value={official.issued_at} /></div>
          <div>Source: {official.source_name}</div>
        </div>}
      </section>
      <div className="incident-strip">
        <span className="live-dot" aria-hidden="true" />
        <strong>{sim.state?.incidents.length ?? 0} active {(sim.state?.incidents.length ?? 0) === 1 ? 'wildfire' : 'wildfires'} · {sim.state?.zones.features.length ?? 0} evacuation {(sim.state?.zones.features.length ?? 0) === 1 ? 'zone' : 'zones'} in the simulation</strong>
        <button type="button" onClick={onOpenMap}>View map</button>
        <span className="muted">Sample data</span>
      </div>
    </>}
    {!sample && <>
      {!configured && <p role="status" className="notice">The live feed isn’t configured. Add your Supabase settings, or run the disaster simulation.</p>}
      {configured && <section className={`official-card${expired ? ' expired' : ''}`} aria-label="Latest official alert">
        <div>
          <div className="official-tags">
            <span className="official-badge"><BadgeCheck size={14} aria-hidden="true" />OFFICIAL</span>
            <span className="pinned"><Pin size={13} aria-hidden="true" />Pinned · Latest alert</span>
          </div>
          {alert.isPending && <p role="status">Checking official alerts…</p>}
          {alert.isError && <><p>Official alerts could not be loaded. Check your local emergency authority for current instructions.</p><ErrorMessage error={alert.error} /></>}
          {alert.isSuccess && !official && <p>No official alert is listed here for {city}. This does not confirm that the area is safe.</p>}
          {official && <>
            <h2>{official.title}</h2>
            {expired && <p className="error">This alert has expired. Check the source for current instructions.</p>}
            {alert.isError && <p className="error">Showing the last loaded alert; it may be out of date.</p>}
            <p className="body-text">{official.instructions}</p>
          </>}
        </div>
        {official && <div className="official-meta">
          <div>Issued <Timestamp value={official.issued_at} /></div>
          {official.expires_at && <div>Expires <Timestamp value={official.expires_at} /></div>}
          <div>Source: {official.source_name}</div>
          {sourceUrl && <a className="official-link" href={sourceUrl} target="_blank" rel="noreferrer">Official instructions<ExternalLink size={14} aria-hidden="true" /></a>}
        </div>}
      </section>}
      <div className="incident-strip">
        <span className="live-dot" aria-hidden="true" />
        {fires.isSuccess && quakes.isSuccess && weather.isSuccess
          ? <strong>{fires.data.length} active {fires.data.length === 1 ? 'wildfire' : 'wildfires'} · {quakes.data.length} recent {quakes.data.length === 1 ? 'earthquake' : 'earthquakes'} · {weather.data.length} weather {weather.data.length === 1 ? 'alert' : 'alerts'} near {city}</strong>
          : <strong>{!hasLiveCoverage(city) ? NO_COVERAGE : fires.isError || quakes.isError || weather.isError ? 'Live hazard data is unavailable right now' : 'Checking live hazard data…'}</strong>}
        <button type="button" onClick={onOpenMap}>View map</button>
        <span className="muted">Sources: NIFC, USGS, National Weather Service</span>
      </div>
      {session && configured && <PostComposer key={session.user.id} city={city} />}
      {configured && feed.isPending && <p role="status">Loading community posts…</p>}
      {feed.isError && <section className="panel"><h3>Couldn’t load the feed</h3><ErrorMessage error={feed.error} /><p>Check your connection. If this is a new project, make sure the database migrations have been applied.</p><button onClick={() => void refresh()}>Try again</button></section>}
      {feed.isError && posts.length > 0 && <p className="error">Showing previously loaded posts. They may be out of date.</p>}
      {feed.isSuccess && !posts.length && <div className="panel"><h3>{typeFilter === 'all' ? 'No community posts yet' : `No ${typeFilter} posts yet`}</h3><p>{typeFilter === 'all' ? `Be the first to share an update or ask a question in ${city}.` : `Try another filter, or be the first to post one in ${city}.`}</p></div>}
    </>}
    {(sample || configured) && <div className="post-filter" role="radiogroup" aria-label="Filter posts by type">
      {postFilters.map(({ id, label }) => <button key={id} type="button" role="radio" aria-checked={typeFilter === id} className="type-chip" onClick={() => setTypeFilter(id)}>{label}</button>)}
    </div>}
    {sample && !posts.length && <p className="muted">No {typeFilter === 'all' ? '' : `${typeFilter} `}posts yet in this simulation step.</p>}
    <div className="posts">{posts.map(post => <PostCard key={post.id} post={post} sample={sample} onSignIn={onSignIn} />)}</div>
    {!sample && feed.hasNextPage && <button disabled={feed.isFetchingNextPage} onClick={() => void feed.fetchNextPage()}>{feed.isFetchingNextPage ? 'Loading…' : 'Load older posts'}</button>}
    {!sample && feed.dataUpdatedAt > 0 && <p className="muted">Last checked <Timestamp value={new Date(feed.dataUpdatedAt).toISOString()} /> · Updates every 30 seconds.</p>}
  </>
}

function App() {
  const [page, setPage] = useState<Page>('feed')
  const [city, setCity] = useState('Santa Rosa')

  function openSignIn() {
    setPage('signin')
    window.scrollTo(0, 0)
  }

  return <AppShell page={page} onNavigate={setPage} city={city} onCityChange={setCity}>
    {page === 'feed' && <section className="feed" aria-label="Community feed">
      <Feed key={city} city={city} onOpenMap={() => setPage('map')} onSignIn={openSignIn} />
    </section>}
    {page === 'map' && <MapPage city={city} />}
    {page === 'news' && <NewsPage city={city} />}
    {page === 'resources' && <ComingSoon title={`Resources in ${city}`} text="Shelters and supplies, labeled by who confirmed them. Coming in the next update." />}
    {page === 'sam' && <ComingSoon title="Meet SAM" text="SAM will answer general preparedness questions and point you to official instructions. Coming soon." />}
    {page === 'signin' && <SignInPage onBack={() => setPage('feed')} />}
  </AppShell>
}

export default App
