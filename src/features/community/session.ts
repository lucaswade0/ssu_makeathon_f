import { createContext, useContext } from 'react'
import type { Session } from '@supabase/supabase-js'

export type AuthState = {
  session: Session | null
  loading: boolean
  error: Error | null
  configured: boolean
}

export const CommunityContext = createContext<AuthState | null>(null)

export function useCommunitySession() {
  const context = useContext(CommunityContext)
  if (!context) throw new Error('Wrap the application in CommunityProvider first.')
  return context
}
