import { useState, type FormEvent, type ReactNode } from 'react'
import {
  ChevronDown, HeartHandshake, MapPin, MapPinned,
  MessageCircleQuestion, MessagesSquare, Newspaper, ShieldCheck, type LucideIcon,
} from 'lucide-react'

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

  function submit(event: FormEvent) {
    event.preventDefault()
    const next = draft.trim()
    if (!next) return
    onChange(next)
    setOpen(false)
  }

  return (
    <div className="city-picker">
      <button type="button" className="city-button" aria-expanded={open} onClick={() => { setDraft(city); setOpen(!open) }}>
        <MapPin size={18} aria-hidden="true" />
        {city}
        <ChevronDown size={16} aria-hidden="true" />
      </button>
      {open && (
        <form className="city-popover" onSubmit={submit}>
          <label>City<input value={draft} onChange={e => setDraft(e.target.value)} maxLength={120} required autoFocus /></label>
          <button type="submit" disabled={!draft.trim()}>Show this city</button>
          <p className="muted">Used for this session only. Your location history is not saved.</p>
        </form>
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