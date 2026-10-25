import type { Vars } from './context'
import type { MessageKey } from './messages'

type T = (key: MessageKey, vars?: Vars) => string

// Source names come from data. "Sample data (Sonoma County)" and "Community submission" are ours, so they are translated.
// The agency inside the brackets stays as written.
export function sourceLabel(source: string, t: T): string {
  if (source === 'Community submission') return t('source.community')
  const sample = /^Sample data \((.*)\)$/.exec(source)
  return sample ? t('source.sample', { name: sample[1]! }) : source
}
