import { cityCenter, distanceKm, hasLiveCoverage } from '../hazards/liveHazards'
import type { Resource, ResourceInput } from './schemas'

export const MAX_DISTANCE_KM = 30
const DUPLICATE_RADIUS_KM = 0.1

type Check = Pick<ResourceInput, 'category' | 'title' | 'description' | 'city' | 'latitude' | 'longitude'>

const letters = (text: string) => text.match(/\p{L}/gu)?.length ?? 0
const isOneRepeatedCharacter = (text: string) => /^(.)\1+$/u.test(text.replace(/\s/g, ''))
// Links in unverified community posts are a common scam route during disasters.
const hasLink = (text: string) => /https?:\/\/|www\.|\b[a-z0-9-]+\.(?:com|net|org|ly|io|co|info|biz|xyz|link|app|site|me)\b/i.test(text)
const words = (text: string) => text.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter(Boolean).join(' ')

/** Problems block the submission; a duplicate only asks the person to confirm. */
export function checkResource(input: Check, existing: Resource[]): { problems: string[]; duplicate: Resource | null } {
  const problems: string[] = []
  const title = input.title.trim()
  const description = input.description.trim()

  if (letters(title) < 3 || isOneRepeatedCharacter(title)) problems.push('Give the resource a real name, with at least 3 letters.')
  if (description.length < 10 || letters(description) < 5 || isOneRepeatedCharacter(description)) problems.push('Describe what’s available in a few words (at least 10 characters).')
  if (hasLink(title) || hasLink(description)) problems.push('Links aren’t allowed in community resources. Describe the place instead.')

  // shortcut: cities without coordinates can't be checked, so their pins are allowed; geocoding would cover them.
  if (hasLiveCoverage(input.city)) {
    const km = distanceKm(input.latitude, input.longitude, cityCenter(input.city))
    if (km > MAX_DISTANCE_KM) problems.push(`This pin is ${Math.round(km)} km from ${input.city.trim()}. Move it closer, or change the city.`)
  }

  const name = words(title)
  const duplicate = name ? existing.find(r => {
    if (r.category !== input.category) return false
    if (distanceKm(input.latitude, input.longitude, { lat: r.latitude, lng: r.longitude }) > DUPLICATE_RADIUS_KM) return false
    const other = words(r.title)
    return other.includes(name) || name.includes(other)
  }) ?? null : null

  return { problems, duplicate }
}
