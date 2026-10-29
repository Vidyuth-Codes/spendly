import type { Session } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { supabase } from '@/lib/supabase';

type AuthState = { session: Session | null; loading: boolean };

const AuthContext = createContext<AuthState>({ session: null, loading: true });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ session: null, loading: true });

  useEffect(() => {
    let active = true;

    supabase.auth
      .getSession()
      .then(({ data }) => active && setState({ session: data.session, loading: false }))
      .catch(() => active && setState({ session: null, loading: false }));

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setState({ session, loading: false });
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo(() => state, [state]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);

/** The name given at signup, falling back to the part of the email before the "@". */
export function useDisplayName(): string {
  const user = useAuth().session?.user;
  const name = (user?.user_metadata?.display_name as string | undefined)?.trim();
  return name || user?.email?.split('@')[0] || 'there';
}
