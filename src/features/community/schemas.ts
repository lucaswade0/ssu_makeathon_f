import { z } from 'zod'

export const citySchema = z.string().trim().min(1).max(120)
export const displayNameSchema = z.string().trim().min(1).max(80)
export const postTypeSchema = z.enum(['update', 'question', 'general'])
export const idSchema = z.uuid()
const timestamp = z.iso.datetime({ offset: true })

export const authorSchema = z.object({ id: idSchema, display_name: displayNameSchema })

export const postSchema = z.object({
  id: idSchema,
  author_id: idSchema,
  city: citySchema,
  post_type: postTypeSchema,
  body: z.string(),
  photo_paths: z.array(z.string()),
  created_at: timestamp,
  updated_at: timestamp,
  author: authorSchema.nullable(),
})

export const replySchema = z.object({
  id: idSchema,
  post_id: idSchema,
  author_id: idSchema,
  body: z.string(),
  created_at: timestamp,
  updated_at: timestamp,
  author: authorSchema.nullable(),
})

export const alertSeverities = ['info', 'warning', 'critical'] as const

export const alertSchema = z.object({
  id: idSchema,
  city: citySchema,
  title: z.string(),
  instructions: z.string(),
  source_name: z.string(),
  source_url: z.string().nullable(),
  // Older rows and responders that don't set one are treated as plain information.
  severity: z.enum(alertSeverities).default('info'),
  issued_at: timestamp,
  expires_at: timestamp.nullable(),
  created_at: timestamp,
  updated_at: timestamp,
})

export const postInputSchema = z.object({
  city: citySchema,
  post_type: postTypeSchema.default('update'),
  body: z.string().trim().min(1).max(5000),
})

export const postEditSchema = z.object({
  body: z.string().trim().min(1).max(5000),
  post_type: postTypeSchema.optional(),
})
export const replyInputSchema = z.object({ body: z.string().trim().min(1).max(2000) })
export const cursorSchema = z.object({ created_at: timestamp, id: idSchema })

export type CommunityPost = z.infer<typeof postSchema>
export type CommunityReply = z.infer<typeof replySchema>
export type OfficialAlert = z.infer<typeof alertSchema>
export type PostInput = z.input<typeof postInputSchema>
export type PostEdit = z.input<typeof postEditSchema>
export type PostType = z.infer<typeof postTypeSchema>
export type FeedCursor = z.infer<typeof cursorSchema>
