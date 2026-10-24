import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { communityApi } from './features/community/api'
import { useCommunityFeed, useOfficialAlert, usePostMutation, usePostReplies, useReplyMutation } from './features/community/hooks'
import { useCommunitySession } from './features/community/session'
import type { CommunityPost, CommunityReply } from './features/community/schemas'
import { MapPage } from './features/map/MapPage'
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

function Account() {
  const { session, loading, configured, error: sessionError } = useCommunitySession()
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<unknown>(null)
  async function submit(event: FormEvent) {
    event.preventDefault()
    setBusy(true); setError(null); setSent(false)
    try { await communityApi.signIn(email, name); setSent(true) }
    catch (failure) { setError(failure) }
    finally { setBusy(false) }
  }
  async function signOut() {
    setBusy(true); setError(null)
    try { await communityApi.signOut(); setSent(false); setEmail(''); setName('') }
    catch (failure) { setError(failure) }
    finally { setBusy(false) }
  }
  return <section className="panel" aria-labelledby="account-heading">
    <h2 id="account-heading">{session ? 'Your account' : 'Sign in to post'}</h2>
    <ErrorMessage error={sessionError || error} />
    {loading ? <p role="status">Checking your session…</p> : session ? <>
      <p>You’re signed in. Your posts show your public display name.</p>
      <button onClick={() => void signOut()} disabled={busy}>{busy ? 'Signing out…' : 'Sign out'}</button>
    </> : <form onSubmit={submit}>
      <p className="muted">Anyone can read the feed. Use an email link to contribute.</p>
      <label>Public display name<input value={name} onChange={e => setName(e.target.value)} required maxLength={80} autoComplete="nickname" disabled={busy} /></label>
      <label>Email<input type="email" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" disabled={busy} /></label>
      <p className="muted">Your email won’t appear on posts.</p>
      <button type="submit" disabled={busy || !configured || !name.trim()}>{busy ? 'Sending…' : 'Send sign-in link'}</button>
      {sent && <p role="status">Check your email and open the sign-in link in this browser.</p>}
    </form>}
  </section>
}

function PostComposer({ city }: { city: string }) {
  const [body, setBody] = useState('')
  const [type, setType] = useState<'update' | 'question' | 'general'>('update')
  const mutation = usePostMutation()
  async function submit(event: FormEvent) {
    event.preventDefault()
    try {
      await mutation.mutateAsync({ action: 'create', input: { city, body, post_type: type } })
      setBody('')
    } catch { /* The error is rendered below; keep the draft. */ }
  }
  return <section className="panel" aria-labelledby="composer-heading">
    <h2 id="composer-heading">Post to {city}</h2>
    <form onSubmit={submit}>
      <label>Post type<select value={type} onChange={e => setType(e.target.value as typeof type)} disabled={mutation.isPending}>
        <option value="update">Update</option><option value="question">Question</option><option value="general">General</option>
      </select></label>
      <label>Your post<textarea value={body} onChange={e => setBody(e.target.value)} rows={4} maxLength={5000} required disabled={mutation.isPending} /></label>
      <div className="row"><button type="submit" disabled={mutation.isPending || !body.trim()}>{mutation.isPending ? 'Posting…' : 'Publish post'}</button><span className="muted">{body.length}/5000</span></div>
      <ErrorMessage error={mutation.error} />
    </form>
  </section>
}

function EntryActions({ body, maxLength, onSave, onDelete, busy, post }: {
  body: string; maxLength: number; onSave: (body: string) => Promise<unknown>
  onDelete: () => Promise<unknown>; busy: boolean; post?: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [draft, setDraft] = useState(body)
  async function save(event: FormEvent) {
    event.preventDefault()
    try { await onSave(draft); setEditing(false) } catch { /* Keep edits on failure. */ }
  }
  if (editing) return <form onSubmit={save} className="edit-form">
    <label>Edit text<textarea value={draft} onChange={e => setDraft(e.target.value)} required maxLength={maxLength} rows={3} disabled={busy} /></label>
    <div className="row"><button type="submit" disabled={busy || !draft.trim()}>Save changes</button><button type="button" disabled={busy} onClick={() => setEditing(false)}>Cancel</button></div>
  </form>
  if (deleting) return <div className="delete-confirm">
    <p>Delete this {post ? 'post and its replies' : 'reply'}?</p>
    <div className="row"><button className="danger" disabled={busy} onClick={() => void onDelete().then(() => setDeleting(false)).catch(() => {})}>Confirm delete</button><button disabled={busy} onClick={() => setDeleting(false)}>Cancel</button></div>
  </div>
  return <div className="row actions"><button disabled={busy} onClick={() => { setDraft(body); setEditing(true) }}>Edit</button><button disabled={busy} onClick={() => setDeleting(true)}>Delete</button></div>
}

function ReplyItem({ reply }: { reply: CommunityReply }) {
  const { session } = useCommunitySession()
  const mutation = useReplyMutation()
  return <li className="reply">
    <div className="meta"><strong>{reply.author?.display_name || 'Resident'}</strong><Timestamp value={reply.created_at} />{reply.updated_at !== reply.created_at && <span>Edited</span>}</div>
    <p className="body-text">{reply.body}</p>
    {session?.user.id === reply.author_id && <EntryActions body={reply.body} maxLength={2000} busy={mutation.isPending}
      onSave={body => mutation.mutateAsync({ action: 'edit', id: reply.id, body })}
      onDelete={() => mutation.mutateAsync({ action: 'delete', id: reply.id })} />}
    <ErrorMessage error={mutation.error} />
  </li>
}

function Replies({ postId }: { postId: string }) {
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
    </form> : <p className="muted">Sign in to reply.</p>}
  </section>
}

function PostCard({ post, sample = false }: { post: CommunityPost; sample?: boolean }) {
  const { session } = useCommunitySession()
  const mutation = usePostMutation()
  const [showReplies, setShowReplies] = useState(false)
  return <article className="panel post" aria-label={`Post by ${post.author?.display_name || 'Resident'}`}>
    <div className="meta"><strong>{post.author?.display_name || 'Resident'}</strong><span>{post.post_type}</span><span className="badge">{sample ? 'Sample post' : 'Community · unverified'}</span></div>
    <div className="meta"><Timestamp value={post.created_at} />{post.updated_at !== post.created_at && <span>Edited</span>}</div>
    <p className="body-text">{post.body}</p>
    {!sample && <>
      {session?.user.id === post.author_id && <EntryActions body={post.body} maxLength={5000} busy={mutation.isPending} post
        onSave={body => mutation.mutateAsync({ action: 'edit', id: post.id, input: { body } })}
        onDelete={() => mutation.mutateAsync({ action: 'delete', id: post.id })} />}
      <ErrorMessage error={mutation.error} />
      <button className="reply-toggle" aria-expanded={showReplies} onClick={() => setShowReplies(!showReplies)}>{showReplies ? 'Hide replies' : 'View replies'}</button>
      {showReplies && <Replies key={session?.user.id || 'guest'} postId={post.id} />}
    </>}
  </article>
}

const samplePosts: CommunityPost[] = [{
  id: '00000000-0000-4000-8000-000000000001', author_id: '00000000-0000-4000-8000-000000000002',
  city: 'Santa Rosa', post_type: 'question', body: 'What do you keep in your emergency supply kit? I’m putting together a checklist for my household.',
  photo_paths: [], created_at: '2026-10-24T04:30:00Z', updated_at: '2026-10-24T04:30:00Z',
  author: { id: '00000000-0000-4000-8000-000000000002', display_name: 'Sample resident' },
}, {
  id: '00000000-0000-4000-8000-000000000003', author_id: '00000000-0000-4000-8000-000000000002',
  city: 'Santa Rosa', post_type: 'general', body: 'A reminder to review your household contact list and talk through a meeting place before an emergency.',
  photo_paths: [], created_at: '2026-10-24T04:00:00Z', updated_at: '2026-10-24T04:00:00Z',
  author: { id: '00000000-0000-4000-8000-000000000002', display_name: 'Sample resident' },
}]

function Feed({ city, sample }: { city: string; sample: boolean }) {
  const { session, configured } = useCommunitySession()
  const feed = useCommunityFeed(sample ? '' : city)
  const alert = useOfficialAlert(sample ? '' : city)
  const posts = sample ? samplePosts : feed.data?.pages.flatMap(page => page.posts) || []
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
  const official = alert.data
  const sourceUrl = official?.source_url && /^https?:\/\//i.test(official.source_url) ? official.source_url : null
  const expired = official?.expires_at && Date.parse(official.expires_at) <= now
  return <>
    <div className="row feed-heading"><h2>{sample ? 'Sample feed' : `${city} feed`}</h2>
      {!sample && <button disabled={!configured || refreshing || feed.isFetching} onClick={() => void refresh()}>{refreshing ? 'Refreshing…' : 'Refresh'}</button>}
    </div>
    {sample ? <p role="status" className="notice">Sample data only. Posting and replies are available in the live feed.</p> : <>
      {!configured && <p role="status" className="notice">The live feed isn’t configured. Add your Supabase settings or view the sample feed.</p>}
      {configured && <section className="panel official" aria-label="Official alert">
        <h3>Latest official alert</h3>
        {alert.isPending && <p role="status">Checking official alerts…</p>}
        {alert.isError && <><p>Official alerts could not be loaded. Check your local emergency authority for current instructions.</p><ErrorMessage error={alert.error} /></>}
        {alert.isSuccess && !official && <p>No official alert is listed here for {city}. This does not confirm that the area is safe.</p>}
        {official && <>
          <h3>{official.title}</h3>
          {expired && <p className="error">This alert has expired. Check the source for current instructions.</p>}
          {alert.isError && <p className="error">Showing the last loaded alert; it may be out of date.</p>}
          <p className="body-text">{official.instructions}</p>
          <p>Source: {sourceUrl ? <a href={sourceUrl} target="_blank" rel="noreferrer">{official.source_name}</a> : official.source_name}</p>
          <p className="meta">Issued <Timestamp value={official.issued_at} /></p>
          {official.expires_at && <p className="meta">Expires <Timestamp value={official.expires_at} /></p>}
        </>}
      </section>}
      {session && configured ? <PostComposer key={session.user.id} city={city} /> : <p className="muted">Read community posts below. Sign in to publish a post or reply.</p>}
      {configured && feed.isPending && <p role="status">Loading community posts…</p>}
      {feed.isError && <section className="panel"><h3>Couldn’t load the feed</h3><ErrorMessage error={feed.error} /><p>Check your connection. If this is a new project, make sure the database migrations have been applied.</p><button onClick={() => void refresh()}>Try again</button></section>}
      {feed.isError && posts.length > 0 && <p className="error">Showing previously loaded posts. They may be out of date.</p>}
      {feed.isSuccess && !posts.length && <div className="panel"><h3>No community posts yet</h3><p>Be the first to share an update or ask a question in {city}.</p></div>}
    </>}
    <div className="posts">{posts.map(post => <PostCard key={post.id} post={post} sample={sample} />)}</div>
    {!sample && feed.hasNextPage && <button disabled={feed.isFetchingNextPage} onClick={() => void feed.fetchNextPage()}>{feed.isFetchingNextPage ? 'Loading…' : 'Load older posts'}</button>}
    {!sample && feed.dataUpdatedAt > 0 && <p className="muted">Last checked <Timestamp value={new Date(feed.dataUpdatedAt).toISOString()} /> · Updates every 30 seconds.</p>}
  </>
}

function App() {
  const [page, setPage] = useState<Page>('feed')
  const [city, setCity] = useState('Santa Rosa')
  const [sample, setSample] = useState(false)

  return <AppShell page={page} onNavigate={setPage} city={city} onCityChange={setCity}>
    {page === 'feed' && <div className="layout">
      <aside>
        {!sample && <Account />}
        <button className="mode-button" onClick={() => setSample(!sample)}>{sample ? 'Back to live feed' : 'View sample feed'}</button>
      </aside>
      <section className="feed" aria-label="Community feed"><Feed key={`${city}-${sample}`} city={city} sample={sample} /></section>
    </div>}
    {page === 'map' && <MapPage city={city} />}
    {page === 'news' && <ComingSoon title="News" text="Local news and public data summaries will appear here." />}
    {page === 'resources' && <ComingSoon title={`Resources in ${city}`} text="Shelters and supplies, labeled by who confirmed them. Coming in the next update." />}
    {page === 'sam' && <ComingSoon title="Meet SAM" text="SAM will answer general preparedness questions and point you to official instructions. Coming soon." />}
  </AppShell>
}

export default App
