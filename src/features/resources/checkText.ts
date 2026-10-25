import type { Vars } from '../i18n/context'
import type { MessageKey } from '../i18n/messages'
import { CHECK_MESSAGES } from './checks'

type T = (key: MessageKey, vars?: Vars) => string

// checks.ts writes its messages in English (and the database errors map back to them). This puts them in the reader's language.
export function checkText(problem: string, t: T): string {
  if (problem === CHECK_MESSAGES.title) return t('check.title')
  if (problem === CHECK_MESSAGES.description) return t('check.description')
  if (problem === CHECK_MESSAGES.links) return t('check.links')
  const far = /^This pin is (\d+) km from (.*)\. Move it closer, or change the city\.$/.exec(problem)
  return far ? t('check.distance', { km: far[1]!, city: far[2]! }) : problem
}
