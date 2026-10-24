import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import {
  ChevronDown, HeartHandshake, LocateFixed, MapPin, MapPinned,
  LogOut, MessageCircleQuestion, MessagesSquare, Newspaper, ShieldCheck, type LucideIcon,
} from 'lucide-react'

import { communityApi } from '../features/community/api'
import { useCommunitySession } from '../features/community/session'
import { nearestCoveredCity } from '../features/hazards/liveHazards'

export type Page = 'feed' | 'news' | 'map' | 'resources' | 'sam' | 'signin'

const navItems: { id: Page; label: string; Icon: LucideIcon }[] = [
  { id: 'feed', label: 'Feed', Icon: MessagesSquare },
  { id: 'news', label: 'News', Icon: Newspaper },
  { id: 'map', label: 'Map', Icon: MapPinned },
  { id: 'resources', label: 'Resources', Icon: HeartHandshake },
  { id: 'sam', label: 'Meet SAM', Icon: MessageCircleQuestion },
]

function CityPicker({ city, onChange }: { city: string; onChange: (city: string) => void }) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(city)
  const [locating, setLocating] = useState(false)
  const [locationNote, setLocationNote] = useState<string | null>(null)

  function submit(event: FormEvent) {
    event.preventDefault()
    const next = draft.trim()
    if (!next) return
    onChange(next)
    setOpen(false)
  }

  // Asks for location once per click and keeps only the matched city name, never the coordinates.
  function locate() {
    if (!navigator.geolocation) {
      setLocationNote('This browser can’t share your location. Type your city instead.')
      return
    }
    setLocating(true)
    setLocationNote(null)
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setLocating(false)
        const match = nearestCoveredCity(coords.latitude, coords.longitude)
        if (match) {
          onChange(match)
          setOpen(false)
        } else {
          setLocationNote('You’re not near a city with live data yet (only Santa Rosa in this demo). Type your city instead.')
        }
      },
      () => {
        setLocating(false)
        setLocationNote('Location wasn’t shared. Type your city instead.')
      },
      { timeout: 10_000, maximumAge: 5 * 60_000 },
    )
  }

  return (
    <div className="city-picker">
      <button type="button" className="city-button" aria-expanded={open} onClick={() => { setDraft(city); setLocationNote(null); setOpen(!open) }}>
        <MapPin size={18} aria-hidden="true" />
        {city}
        <ChevronDown size={16} aria-hidden="true" />
      </button>
      {open && (
        <form className="city-popover" onSubmit={submit}>
          <button type="button" className="locate-button" onClick={locate} disabled={locating}>
            <LocateFixed size={16} aria-hidden="true" />{locating ? 'Finding your location…' : 'Use my location'}
          </button>
          {locationNote && <p role="status" className="muted">{locationNote}</p>}
          <label>City<input value={draft} onChange={e => setDraft(e.target.value)} maxLength={120} required autoFocus /></label>
          <button type="submit" disabled={!draft.trim()}>Show this city</button>
          <p className="muted">Used for this session only. Your location history is not saved.</p>
        </form>
      )}
    </div>
  )
}

function ProfileMenu({ onSignIn }: { onSignIn: () => void }) {
  const { session, configured } = useCommunitySession()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const close = (event: MouseEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent ? event.key === 'Escape' : !ref.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', close)
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', close) }
  }, [open])

  if (!configured) return null
  if (!session) return <button type="button" className="header-sign-in" onClick={onSignIn}>Sign in</button>

  const name = String(session.user.user_metadata?.display_name || 'Resident')
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part.charAt(0).toUpperCase()).join('') || '?'

  async function signOut() {
    setBusy(true); setError('')
    try { await communityApi.signOut(); setOpen(false) }
    catch { setError('Couldn’t sign out. Please try again.') }
    finally { setBusy(false) }
  }

  return (
    <div className="profile-menu" ref={ref}>
      <button type="button" className="profile-button" aria-label={`Account menu for ${name}`} aria-expanded={open} aria-haspopup="true" onClick={() => setOpen(!open)}>{initials}</button>
      {open && (
        <div className="profile-popover">
          <p className="profile-name">{name}</p>
          <p className="muted">Posts show this public name. Your email stays private.</p>
          <button type="button" className="profile-signout" disabled={busy} onClick={() => void signOut()}>
            <LogOut size={16} aria-hidden="true" />{busy ? 'Signing out…' : 'Sign out'}
          </button>
          {error && <p role="alert" className="error">{error}</p>}
        </div>
      )}
    </div>
  )
}

type AppShellProps = {
  page: Page
  onNavigate: (page: Page) => void
  city: string
  onCityChange: (city: string) => void
  children: ReactNode
}

export function AppShell({ page, onNavigate, city, onCityChange, children }: AppShellProps) {
  return (
    <div className="app">
      <p className="disclaimer">
        Preparedness prototype, not an official emergency service. Community posts are unverified. In an emergency, call 911.
      </p>

      <header className="app-header">
        <button type="button" className="brand" onClick={() => onNavigate('feed')}>
          <ShieldCheck size={34} aria-hidden="true" />
          <span>Safety SAM</span>
        </button>
        <CityPicker city={city} onChange={onCityChange} />
        <div className="header-spacer" />
        <ProfileMenu onSignIn={() => onNavigate('signin')} />
      </header>

      <div className={`app-body${page === 'map' ? ' compact' : ''}`}>
        <nav className="nav-rail" aria-label="Main">
          <ul>
            {navItems.map(({ id, label, Icon }) => (
              <li key={id}>
                <button type="button" aria-current={page === id ? 'page' : undefined} onClick={() => onNavigate(id)}>
                  <Icon size={22} aria-hidden="true" />
                  {label}
                </button>
              </li>
            ))}
          </ul>
        </nav>
        <main className="app-main">{children}</main>
      </div>
    </div>
  )
}

export function ComingSoon({ title, text }: { title: string; text: string }) {
  return (
    <section className="panel coming-soon">
      <h1>{title}</h1>
      <p className="muted">{text}</p>
    </section>
  )
}