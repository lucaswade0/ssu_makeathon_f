import { sampleShelters, type Shelter } from '../map/sampleData'
import type { Resource } from './schemas'

const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString()

export function shelterToResource(shelter: Shelter): Resource {
  return {
    id: shelter.id, author_id: null, category: shelter.category ?? 'shelter', title: shelter.name, description: shelter.description,
    location_text: shelter.location_text, city: shelter.city, latitude: shelter.latitude, longitude: shelter.longitude,
    status: shelter.status, source: shelter.source, last_confirmed_at: shelter.updated_at,
    created_at: shelter.created_at, updated_at: shelter.updated_at,
  }
}

export function resourceToShelter(resource: Resource): Shelter {
  return {
    id: resource.id, category: resource.category, name: resource.title, description: resource.description, location_text: resource.location_text,
    city: resource.city, latitude: resource.latitude, longitude: resource.longitude, status: resource.status,
    source: resource.source, created_at: resource.created_at, updated_at: resource.updated_at,
  }
}

const base = { author_id: null, city: 'Santa Rosa', created_at: minutesAgo(120), updated_at: minutesAgo(30), last_confirmed_at: minutesAgo(30) }

// Sample records for categories other than shelters. Used by the offline fallback and the disaster simulation.
export const sampleExtras: Resource[] = [
  { ...base, id: 'resource-transport-1', category: 'transportation', title: 'Evacuation shuttle for residents without a ride', description: 'Free shuttles from the Finley Community Center. Call the county line to request pickup.', location_text: 'Pickup at 2060 W College Ave, Santa Rosa', latitude: 38.4446, longitude: -122.734, status: 'official', source: 'Sample data (Sonoma County)' },
  { ...base, id: 'resource-water-1', category: 'water_food', title: 'Water and meals', description: 'Bottled water and hot meals served twice a day. Dietary needs can be requested at the desk.', location_text: 'Finley Community Center, 2060 W College Ave', latitude: 38.4448, longitude: -122.7335, status: 'official', source: 'Sample data (Sonoma County)' },
  { ...base, id: 'resource-pets-1', category: 'pets', title: 'Pet boarding and supplies', description: 'Temporary kennels for dogs and cats. Bring vaccination records if you can.', location_text: 'Sonoma County Fairgrounds, 1350 Bennett Valley Rd', latitude: 38.4283, longitude: -122.6915, status: 'verified', source: 'Sample data (Red Cross listing)' },
  { ...base, id: 'resource-medical-1', category: 'medical', title: 'First-aid and medication station', description: 'Volunteer nurses can help with minor injuries, smoke irritation, and refilling urgent prescriptions.', location_text: 'Veterans Memorial Building, 1351 Maple Ave', latitude: 38.4341, longitude: -122.7042, status: 'verified', source: 'Sample data (Red Cross listing)' },
  // Last confirmed 9 days ago, past the 7-day limit, so it shows the stale label.
  { ...base, last_confirmed_at: minutesAgo(9 * 24 * 60), id: 'resource-water-2', category: 'water_food', title: 'Free water refill station', description: 'A resident listed a water refill tap in the park. Nobody has confirmed it since, so it may be off.', location_text: 'Howarth Park, 630 Summerfield Rd', latitude: 38.4497, longitude: -122.6747, status: 'community_submitted', source: 'Community submission' },
  { ...base, id: 'resource-charging-1', category: 'charging', title: 'Phone charging', description: 'Outlets and power strips available at the front tables. Not confirmed by officials.', location_text: 'Coffee shop on Mendocino Ave', latitude: 38.4478, longitude: -122.7119, status: 'community_submitted', source: 'Community submission' },
]

// Shown when Supabase isn't configured, so the page still demonstrates every category.
export const sampleResources: Resource[] = [...sampleShelters.map(shelterToResource), ...sampleExtras]
