import { CircleHelp, Megaphone, MessageCircle, type LucideIcon } from 'lucide-react'
import { useI18n } from '../i18n/context'
import type { PostType } from './schemas'

const icons: Record<PostType, LucideIcon> = { update: Megaphone, question: CircleHelp, general: MessageCircle }

// The kind of post, drawn as a small pill so it reads as a label rather than as part of the date.
export function PostTypeTag({ type }: { type: PostType }) {
  const { t } = useI18n()
  const Icon = icons[type]
  return <span className={`post-type ${type}`}><Icon size={12} aria-hidden="true" />{t(`type.${type}`)}</span>
}
