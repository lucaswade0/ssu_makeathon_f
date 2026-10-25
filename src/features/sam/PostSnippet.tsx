import type { CommunityPost } from '../community/schemas'
import { PostTypeTag } from '../community/PostTypeTag'
import { useI18n } from '../i18n/context'
import { dateLocale } from '../i18n/languages'

// A read-only post for SAM's answers: always marked as unverified, with no edit, delete, or reply.
export function PostSnippet({ post, sample }: { post: CommunityPost; sample: boolean }) {
  const { t, lang } = useI18n()
  const name = post.author?.display_name || t('post.resident')
  return <article className="post-snippet" aria-label={t('post.by', { name })}>
    <div className="post-snippet-head">
      <strong>{name}</strong>
      <time dateTime={post.created_at}>{new Date(post.created_at).toLocaleString(dateLocale(lang), { dateStyle: 'medium', timeStyle: 'short' })}</time>
      <PostTypeTag type={post.post_type} />
      <span className="badge community">{sample ? t('post.sample') : t('post.community')}</span>
    </div>
    <p className="body-text">{post.body}</p>
  </article>
}
