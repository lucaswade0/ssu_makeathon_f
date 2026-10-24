import type { CommunityPost, OfficialAlert } from '../community/schemas'
import { noZones, sampleShelters, sampleZones, type Incident, type Shelter, type ZoneCollection } from '../map/sampleData'
import type { NewsItem } from '../news/newsItems'
import { sampleExtras, shelterToResource } from '../resources/sampleData'
import type { Resource } from '../resources/schemas'

// A scripted, sample-only wildfire timeline for Santa Rosa. Nothing here is real or predictive:
// every step is pre-written, and all agencies and residents are placeholders.

export const SIM_CITY = 'Santa Rosa'

export type SimState = {
  alert: OfficialAlert | null
  incidents: Incident[]
  zones: ZoneCollection
  shelters: Shelter[]
  resources: Resource[]
  news: NewsItem[]
  posts: CommunityPost[]
}

type Effects = {
  alert?: Pick<OfficialAlert, 'title' | 'instructions' | 'source_name' | 'severity'>
  incident?: Partial<Incident>
  addZones?: string[]
  removeZones?: string[]
  openShelters?: string[]
  closeShelters?: string[]
  openResources?: string[]
  closeResources?: string[]
  news?: Omit<NewsItem, 'id' | 'time' | 'sample'>[]
  posts?: { name: string; type: CommunityPost['post_type']; body: string }[]
}

export type SimStep = {
  id: string
  clock: string
  /** Minutes since the first step. Used to place item times in the past. */
  at: number
  title: string
  narration: string
  effects: Effects
}

const fireBase: Incident = {
  id: 'sim-fire',
  kind: 'fire',
  title: 'Vegetation fire · Fountaingrove',
  location_text: 'Fountaingrove Pkwy near Round Barn Blvd',
  latitude: 38.4815,
  longitude: -122.7105,
  source: 'Sample data (CAL FIRE)',
  updated_at: '',
}

const nws = 'Sample data (National Weather Service)'
const county = 'Sample data (Sonoma County)'

export const steps: SimStep[] = [
  {
    id: 'red-flag', clock: 'Day 1 · 2:10 PM', at: 0,
    title: 'Red Flag Warning issued',
    narration: 'Hot, dry, windy weather raises fire danger across the North Bay. No fire has been reported.',
    effects: {
      alert: { severity: 'warning', title: 'Red Flag Warning in effect', instructions: 'Fire danger is critical. Avoid outdoor burning and anything that can spark. Review your evacuation plan and keep your phone charged.', source_name: nws },
      news: [{ hazard: 'weather', source: nws, title: 'Red Flag Warning until 8 PM', summary: 'Extreme · Affects North Bay Mountains and Sonoma County interior', expires: null, url: 'https://www.weather.gov/' }],
      posts: [{ name: 'Priya S.', type: 'update', body: 'Wind is really picking up on Fountaingrove. Bringing the patio furniture in and charging everything.' }],
    },
  },
  {
    id: 'smoke', clock: 'Day 1 · 2:42 PM', at: 32,
    title: 'Smoke reported near Fountaingrove',
    narration: 'A small vegetation fire is reported. Crews are on the way. Information is still limited.',
    effects: {
      incident: { acres: 5, containment: 0 },
      news: [{ hazard: 'fire', source: 'Sample data (CAL FIRE)', title: 'Vegetation fire · Fountaingrove', summary: '5 acres · 0% contained · Fountaingrove Pkwy near Round Barn Blvd', expires: null, url: 'https://inciweb.wildfire.gov/' }],
      posts: [{ name: 'Marcus O.', type: 'question', body: 'Is anyone else seeing smoke up past Round Barn? Trying to figure out if it is a fire or a burn pile.' }],
    },
  },
  {
    id: 'warning', clock: 'Day 1 · 3:05 PM', at: 55,
    title: 'Evacuation warning for Zone SRO-E012',
    narration: 'The fire is growing in the wind. A warning tells residents to be ready to leave.',
    effects: {
      incident: { acres: 60, containment: 0 },
      addZones: ['SRO-E012'],
      alert: { severity: 'warning', title: 'Evacuation warning: Zone SRO-E012', instructions: 'Be ready to leave on short notice. Gather medications, documents, and pets. Follow orders from local officials.', source_name: county },
      news: [{ hazard: 'fire', source: 'Sample data (CAL FIRE)', title: 'Fire grows near Fountaingrove', summary: '60 acres · 0% contained · Fountaingrove Pkwy near Round Barn Blvd', expires: null, url: 'https://inciweb.wildfire.gov/' }],
      posts: [{ name: 'Dev T.', type: 'update', body: 'Packed the car just in case. Neighbors on my street are doing the same.' }],
    },
  },
  {
    id: 'order', clock: 'Day 1 · 3:40 PM', at: 90,
    title: 'Evacuation order for Zone SRO-E011',
    narration: 'The fire reaches 240 acres. An order means leave now. This is the most urgent step.',
    effects: {
      incident: { acres: 240, containment: 10 },
      addZones: ['SRO-E011'],
      openResources: ['resource-transport-1'],
      alert: { severity: 'critical', title: 'Evacuation order: Zone SRO-E011', instructions: 'Leave now. Do not wait. Take your pets and essentials, and follow the routes given by local officials.', source_name: county },
      news: [{ hazard: 'evacuation', source: county, title: 'Evacuation order · Zone SRO-E011', summary: 'Leave now. Follow instructions from local officials.', expires: null, url: 'https://www.caloes.ca.gov/' }],
      posts: [{ name: 'Lena R.', type: 'update', body: 'Mandatory order is out for E011. Roads out are slow but moving. Please do not wait.' }],
    },
  },
  {
    id: 'shelter', clock: 'Day 1 · 4:15 PM', at: 125,
    title: 'Evacuation center opens',
    narration: 'An evacuation center opens for residents who need somewhere to go.',
    effects: {
      openShelters: ['shelter-1'],
      openResources: ['resource-water-1', 'resource-pets-1'],
      news: [{ hazard: 'evacuation', source: county, title: 'Evacuation center open at Finley Community Center', summary: 'Cots, water, and charging available. Check with the center about pets.', expires: null, url: 'https://www.caloes.ca.gov/' }],
      posts: [{ name: 'Marcus O.', type: 'question', body: 'Does anyone know if the shelter at Finley is accepting pets?' }],
    },
  },
  {
    id: 'containment', clock: 'Day 1 · 5:30 PM', at: 200,
    title: 'Crews gain ground',
    narration: 'Winds ease and crews begin to contain the fire. Orders and warnings stay in place for now.',
    effects: {
      incident: { acres: 480, containment: 25 },
      openShelters: ['shelter-3'],
      openResources: ['resource-medical-1'],
      news: [{ hazard: 'fire', source: 'Sample data (CAL FIRE)', title: 'Containment improves on Fountaingrove fire', summary: '480 acres · 25% contained · Fountaingrove Pkwy near Round Barn Blvd', expires: null, url: 'https://inciweb.wildfire.gov/' }],
      posts: [
        { name: 'Priya S.', type: 'general', body: 'Staying with family in Rohnert Park tonight. Thank you to everyone checking in on neighbors.' },
        { name: 'Lena R.', type: 'update', body: 'Neighbors say the church lot near Montgomery and Farmers has water and shade. Not an official shelter, so please check before you go.' },
      ],
    },
  },
  {
    id: 'downgrade', clock: 'Day 1 · 8:00 PM', at: 350,
    title: 'Order reduced to a warning',
    narration: 'The order for Zone SRO-E011 is downgraded. Residents there should still be ready to leave.',
    effects: {
      incident: { acres: 510, containment: 40 },
      removeZones: ['SRO-E011'],
      openShelters: ['shelter-2'],
      openResources: ['resource-charging-1'],
      alert: { severity: 'warning', title: 'Evacuation order lifted for Zone SRO-E011', instructions: 'The order for Zone SRO-E011 has been reduced to a warning. Stay ready to leave. Check official sources before returning home.', source_name: county },
      news: [
        { hazard: 'evacuation', source: county, title: 'Order lifted · Zone SRO-E011', summary: 'Reduced to a warning. Check official sources before returning home.', expires: null, url: 'https://www.caloes.ca.gov/' },
        { hazard: 'evacuation', source: 'Sample data (Red Cross listing)', title: 'Overflow shelter open at Veterans Memorial Building', summary: 'Pets allowed in crates. Listed by the Red Cross.', expires: null, url: 'https://www.caloes.ca.gov/' },
      ],
    },
  },
  {
    id: 'lifted', clock: 'Day 2 · 9:00 AM', at: 1130,
    title: 'Warnings lifted',
    narration: 'The fire is mostly contained and the remaining warning is lifted. Always confirm with official sources.',
    effects: {
      incident: { acres: 520, containment: 70 },
      removeZones: ['SRO-E012'],
      closeShelters: ['shelter-1', 'shelter-2', 'shelter-3'],
      closeResources: sampleExtras.map(resource => resource.id),
      alert: { severity: 'info', title: 'Evacuation warnings lifted', instructions: 'All evacuation warnings for this fire are lifted. Check official sources for road and utility updates before you return.', source_name: county },
      news: [{ hazard: 'evacuation', source: county, title: 'Evacuation centers closing', summary: 'Finley Community Center and the overflow shelter close today as warnings are lifted.', expires: null, url: 'https://www.caloes.ca.gov/' }, { hazard: 'fire', source: 'Sample data (CAL FIRE)', title: 'Fountaingrove fire 70% contained', summary: '520 acres · 70% contained · Fountaingrove Pkwy near Round Barn Blvd', expires: null, url: 'https://inciweb.wildfire.gov/' }],
      posts: [{ name: 'Dev T.', type: 'update', body: 'Heading home. Power is back on our street but the smell of smoke is strong. Keep windows closed.' }],
    },
  },
]

const iso = (base: number, at: number) => new Date(base + at * 60_000).toISOString()

// Chosen so the last step lands on "now" and earlier steps read as hours ago.
export function baseTime(now: number) {
  return now - steps[steps.length - 1]!.at * 60_000
}

const zoneById = new Map(sampleZones.features.map(f => [f.properties.zone_id, f]))

/** Everything the app should show at step `index` (inclusive). Pure: the same inputs give the same state. */
export function simulationState(index: number, base: number): SimState {
  const last = Math.min(Math.max(index, 0), steps.length - 1)
  let alert: OfficialAlert | null = null
  let incident: Incident | null = null
  const zones = new Map<string, ZoneCollection['features'][number]>()
  const shelters = new Map<string, Shelter>()
  const extras = new Map<string, Resource>()
  const news: NewsItem[] = []
  const posts: CommunityPost[] = []

  steps.slice(0, last + 1).forEach(step => {
    const time = iso(base, step.at)
    const e = step.effects
    if (e.alert) {
      alert = {
        id: `sim-alert-${step.id}`, city: SIM_CITY, title: e.alert.title, instructions: e.alert.instructions,
        source_name: e.alert.source_name, severity: e.alert.severity, source_url: null, issued_at: time, expires_at: null, created_at: time, updated_at: time,
      }
    }
    if (e.incident) incident = { ...(incident ?? fireBase), ...e.incident, updated_at: time }
    for (const id of e.addZones ?? []) {
      const zone = zoneById.get(id)
      if (zone) zones.set(id, { ...zone, properties: { ...zone.properties, issued_at: time } })
    }
    for (const id of e.removeZones ?? []) zones.delete(id)
    for (const id of e.openShelters ?? []) {
      const shelter = sampleShelters.find(s => s.id === id)
      if (shelter) shelters.set(id, { ...shelter, created_at: time, updated_at: time })
    }
    for (const id of e.closeShelters ?? []) shelters.delete(id)
    for (const id of e.openResources ?? []) {
      const resource = sampleExtras.find(r => r.id === id)
      if (resource) extras.set(id, { ...resource, created_at: time, updated_at: time, last_confirmed_at: time })
    }
    for (const id of e.closeResources ?? []) extras.delete(id)
    e.news?.forEach((item, n) => news.push({ ...item, id: `sim-news-${step.id}-${n}`, time, sample: true }))
    e.posts?.forEach((post, n) => posts.unshift({
      id: `sim-post-${step.id}-${n}`, author_id: `sim-author-${post.name}`, city: SIM_CITY, post_type: post.type, body: post.body,
      photo_paths: [], created_at: iso(base, step.at + 3 + n), updated_at: iso(base, step.at + 3 + n),
      author: { id: `sim-author-${post.name}`, display_name: post.name },
    }))
  })

  return {
    alert,
    incidents: incident ? [incident] : [],
    zones: zones.size ? { type: 'FeatureCollection', features: [...zones.values()] } : noZones,
    shelters: [...shelters.values()],
    resources: [...[...shelters.values()].map(shelterToResource), ...extras.values()],
    news,
    posts,
  }
}
