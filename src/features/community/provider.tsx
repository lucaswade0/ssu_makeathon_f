import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { CommunityContext } from './session'
import type { AuthState } from './session'

export function CommunityProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: { queries: { retry: 1, staleTime: 15_000 } },
  }))
  const [auth, setAuth] = useState<AuthState>({
    session: null, loading: Boolean(supabase), error: null, configured: Boolean(supabase),
  })

  useEffect(() => {
    if (!supabase) return
    let active = true
    let authEventReceived = false
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      authEventReceived = true
      if (!active) return
      setAuth({ session, loading: false, error: null, configured: true })
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'USER_UPDATED') {
        // Public reads may be cached, but ownership controls must use the new session.
        void queryClient.invalidateQueries({ queryKey: ['community'] })
      }
    })
    void supabase.auth.getSession().then(({ data, error }) => {
      if (active && !authEventReceived) {
        setAuth({ session: data.session, loading: false, error, configured: true })
      }
    }).catch((error: unknown) => {
      if (active && !authEventReceived) {
        setAuth({ session: null, loading: false,
          error: error instanceof Error ? error : new Error('Unable to restore your session.'),
          configured: true })
      }
    })
    return () => { active = false; subscription.unsubscribe() }
  }, [queryClient])

  return (
    <CommunityContext.Provider value={auth}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </CommunityContext.Provider>
  )
}
