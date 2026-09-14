import { create } from 'zustand'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { clearLocalDb } from '../lib/offline/db'

interface AuthState {
  session: Session | null
  user: User | null
  loading: boolean
  init: () => () => void
  signOut: () => Promise<void>
}

export const useAuth = create<AuthState>((set) => ({
  session: null,
  user: null,
  loading: true,
  init: () => {
    supabase.auth.getSession().then(({ data }) => {
      set({ session: data.session, user: data.session?.user ?? null, loading: false })
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      set({ session, user: session?.user ?? null, loading: false })
    })
    return () => sub.subscription.unsubscribe()
  },
  signOut: async () => {
    await supabase.auth.signOut()
    // выходя, не показываем следующему пользователю чужой офлайн-кэш
    await clearLocalDb()
    set({ session: null, user: null })
  },
}))
