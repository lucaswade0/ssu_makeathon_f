import { useState, type FormEvent, type ReactNode } from 'react'
import {
  HeartHandshake, LocateFixed, MapPin, MapPinned,
  LogOut, MessageCircleQuestion, MessagesSquare, Newspaper, UserRound, type LucideIcon,
} from 'lucide-react'

import { communityApi } from '../features/community/api'
import { useCommunitySession } from '../features/community/session'
import { SimulationBar } from '../features/simulation/SimulationBar'
import { useSimulation } from '../features/simulation/context'
import { nearestCoveredCity } from '../features/hazards/liveHazards'
import { useI18n } from '../features/i18n/context'
import { LanguageMenu } from '../features/i18n/LanguageMenu'
import { TranslationBanner } from '../features/i18n/TranslationBanner'
import type { MessageKey } from '../features/i18n/messages'

export type Page = 'feed' | 'news' | 'map' | 'resources' | 'sam' | 'profile' | 'signin'

const navItems: { id: Page; label: MessageKey; Icon: LucideIcon }[] = [
  { id: 'feed', label: 'nav.feed', Icon: MessagesSquare },
  { id: 'news', label: 'nav.news', Icon: Newspaper },
  { id: 'map', label: 'nav.map', Icon: MapPinned },
  { id: 'resources', label: 'nav.resources', Icon: HeartHandshake },
  { id: 'sam', label: 'nav.sam', Icon: MessageCircleQuestion },
  { id: 'profile', label: 'nav.profile', Icon: UserRound },
]

function CityPicker({ city, onChange }: { city: string; onChange: (city: string) => void }) {
  const { t } = useI18n()
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
      setLocationNote(t('city.noGeo'))
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
          setLocationNote(t('city.outside'))
        }
      },
      () => {
        setLocating(false)
        setLocationNote(t('city.denied'))
      },
      { timeout: 10_000, maximumAge: 5 * 60_000 },
    )
  }

  return (
    <div className="city-picker">
      <div className="city-label">
        <MapPin size={20} aria-hidden="true" />
        <div>
          <p className="city-name">{city}</p>
          <p className="city-caption">{t('city.caption')}{' '}
            <button type="button" className="city-change" aria-expanded={open} onClick={() => { setDraft(city); setLocationNote(null); setOpen(!open) }}>{t('city.change')}</button>
          </p>
        </div>
      </div>
      {open && (
        <form className="city-popover" onSubmit={submit}>
          <button type="button" className="locate-button" onClick={locate} disabled={locating}>
            <LocateFixed size={16} aria-hidden="true" />{locating ? t('city.locating') : t('city.locate')}
          </button>
          {locationNote && <p role="status" className="muted">{locationNote}</p>}
          <label>{t('city.label')}<input value={draft} onChange={e => setDraft(e.target.value)} maxLength={120} required autoFocus /></label>
          <button type="submit" disabled={!draft.trim()}>{t('city.show')}</button>
          <p className="muted">{t('city.sessionOnly')}</p>
        </form>
      )}
    </div>
  )
}

export function ProfilePage({ onSignIn, city, onCityChange }: { onSignIn: () => void; city: string; onCityChange: (city: string) => void }) {
  const { t } = useI18n()
  const { session, configured } = useCommunitySession()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  if (!configured || !session) return <section className="panel profile-page" aria-labelledby="profile-heading">
    <h1 id="profile-heading">{t('nav.profile')}</h1>
    <p className="muted">{configured ? t('profile.signInPrompt') : t('profile.unavailable')}</p>
    {configured && <button type="button" onClick={onSignIn}>{t('profile.signIn')}</button>}
  </section>

  const name = String(session.user.user_metadata?.display_name || t('post.resident'))
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part.charAt(0).toUpperCase()).join('') || '?'

  async function signOut() {
    setBusy(true); setError('')
    try { await communityApi.signOut() }
    catch { setError(t('profile.signOutFailed')) }
    finally { setBusy(false) }
  }

  return <section className="profile-page" aria-labelledby="profile-heading">
    <div className="profile-heading">
      <span className="profile-avatar" aria-hidden="true">{initials}</span>
      <div>
        <h1 id="profile-heading">{name}</h1>
        <p className="muted">{t('profile.publicName')}</p>
      </div>
    </div>
    <div className="profile-settings">
      <div className="profile-setting">
        <h2>{t('profile.location')}</h2>
        <CityPicker city={city} onChange={onCityChange} />
      </div>
      <div className="profile-setting">
        <h2>{t('language.label')}</h2>
        <LanguageMenu />
      </div>
    </div>
    <button type="button" className="profile-signout" disabled={busy} onClick={() => void signOut()}>
      <LogOut size={16} aria-hidden="true" />{busy ? t('profile.signingOut') : t('profile.signOut')}
    </button>
    {error && <p role="alert" className="error">{error}</p>}
  </section>
}

type AppShellProps = {
  page: Page
  onNavigate: (page: Page) => void
  children: ReactNode
}

export function AppShell({ page, onNavigate, children }: AppShellProps) {
  const { t } = useI18n()
  const simulating = useSimulation().active
  // Phones hide the floating "Run disaster simulation" button on Ask SAM and Profile, where it covers the input and buttons.
  return (
    <div className={`app${simulating ? ' sim-on' : ''}${page === 'sam' || page === 'profile' ? ' no-sim-start' : ''}`}>
      <TranslationBanner />

      <div className={`app-body${page === 'map' ? ' compact' : ''}`}>
        <nav className="nav-rail" aria-label={t('nav.main')}>
          <div className="nav-brand">
            <button type="button" className="brand" onClick={() => onNavigate('feed')}>
              <span className="brand-mark"><img src="/safety-sam-logo.png" alt="" aria-hidden="true" /></span>
              <span>Safety SAM</span>
            </button>
          </div>
          <ul>
            {navItems.map(({ id, label, Icon }) => (
              <li key={id}>
                <button type="button" aria-current={page === id ? 'page' : undefined} onClick={() => onNavigate(id)}>
                  <Icon size={22} strokeWidth={page === id ? 2.5 : 2} aria-hidden="true" />
                  {t(label)}
                </button>
              </li>
            ))}
          </ul>
        </nav>
        <main className="app-main">{children}</main>
      </div>
      <SimulationBar />
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
