import { z } from 'zod'
import { citySchema, idSchema } from '../community/schemas'

export const categories = ['shelter', 'water_food', 'medical', 'charging', 'pets', 'transportation'] as const
export type ResourceCategory = (typeof categories)[number]

export const categoryLabels: Record<ResourceCategory, string> = {
  shelter: 'Shelter',
  water_food: 'Water and food',
  medical: 'Medical',
  charging: 'Charging',
  pets: 'Pets',
  transportation: 'Transportation',
}

export const statuses = ['official', 'verified', 'community_submitted'] as const
export type ResourceStatus = (typeof statuses)[number]

export const statusLabels: Record<ResourceStatus, string> = {
  official: 'Official',
  verified: 'Verified',
  community_submitted: 'Community-submitted · unverified',
}

export const reportReasons = ['inaccurate', 'unsafe', 'closed', 'other'] as const
export type ReportReason = (typeof reportReasons)[number]

export const reasonLabels: Record<ReportReason, string> = {
  inaccurate: 'Inaccurate information',
  unsafe: 'Unsafe',
  closed: 'Closed or no longer available',
  other: 'Something else',
}

const timestamp = z.iso.datetime({ offset: true })

export const resourceSchema = z.object({
  id: idSchema,
  author_id: idSchema.nullable(),
  category: z.enum(categories),
  title: z.string(),
  description: z.string(),
  location_text: z.string(),
  city: citySchema,
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  status: z.enum(statuses),
  source: z.string(),
  last_confirmed_at: timestamp,
  created_at: timestamp,
  updated_at: timestamp,
})

export type Resource = Omit<z.infer<typeof resourceSchema>, 'id' | 'author_id'> & { id: string; author_id: string | null }

export const resourceInputSchema = z.object({
  category: z.enum(categories),
  title: z.string().trim().min(1).max(180),
  description: z.string().trim().min(1).max(2000),
  location_text: z.string().trim().min(1).max(240),
  city: citySchema,
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
})
export type ResourceInput = z.input<typeof resourceInputSchema>

export const reportInputSchema = z.object({
  reason: z.enum(reportReasons),
  details: z.string().trim().max(1000).optional(),
})

export type ResourceFilter = 'all' | ResourceCategory | ResourceStatus

export function filterResources(items: Resource[], filter: ResourceFilter): Resource[] {
  if (filter === 'all') return items
  return items.filter(item => item.category === filter || item.status === filter)
}

export const STALE_AFTER_DAYS = 7

// Resources nobody has confirmed in a week are labeled, never hidden.
export function isStale(resource: Pick<Resource, 'last_confirmed_at'>, now: number) {
  return now - Date.parse(resource.last_confirmed_at) > STALE_AFTER_DAYS * 86_400_000
}
