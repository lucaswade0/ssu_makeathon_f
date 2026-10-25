import { describe, expect, it } from 'vitest'
import { makeI18n } from '../i18n/context'
import { checkText } from './checkText'
import { CHECK_MESSAGES, checkResource, friendlyDbError } from './checks'

const es = makeI18n('es', () => {}).t
const en = makeI18n('en', () => {}).t

describe('checkText', () => {
  it('translates each fixed message', () => {
    expect(checkText(CHECK_MESSAGES.title, es)).toContain('nombre real')
    expect(checkText(CHECK_MESSAGES.description, es)).toContain('10 caracteres')
    expect(checkText(CHECK_MESSAGES.links, es)).toContain('enlaces')
  })

  it('translates the distance message and keeps its numbers and city', () => {
    const out = checkText('This pin is 42 km from Santa Rosa. Move it closer, or change the city.', es)
    expect(out).toBe('Este marcador está a 42 km de Santa Rosa. Acérquelo o cambie la ciudad.')
  })

  it('translates messages that come back from the database', () => {
    expect(checkText(friendlyDbError('violates check constraint "resources_community_no_links"'), es)).toContain('enlaces')
  })

  it('translates every problem the checker can report', () => {
    const { problems } = checkResource({ category: 'shelter', title: 'a', description: 'b http://x.com', city: 'Santa Rosa', latitude: 10, longitude: 10 }, [])
    expect(problems.length).toBeGreaterThan(2)
    for (const problem of problems) expect(checkText(problem, es)).not.toBe(problem)
  })

  it('leaves English as it is and unknown text untouched', () => {
    expect(checkText(CHECK_MESSAGES.title, en)).toBe(CHECK_MESSAGES.title)
    expect(checkText('Something unexpected', es)).toBe('Something unexpected')
  })
})
