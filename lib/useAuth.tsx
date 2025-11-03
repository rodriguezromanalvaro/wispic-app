import { createContext, useContext, useEffect, useState } from 'react';

import { Session, User } from '@supabase/supabase-js';

import { supabase } from './supabase';
import { applyPalette } from './theme';
import { Profile } from './types';

type AuthContextType = {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  ready: boolean;
};

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  profile: null,
  ready: false,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // sesión inicial
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session ?? null);
      setReady(true);
    });

    // suscripción
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s ?? null);
      setReady(true);
    });
    return () => {
      sub.subscription.unsubscribe();
    };
  }, []);

  // cargar perfil del usuario
  useEffect(() => {
    const userId = session?.user?.id;
    if (!userId) {
      // Ensure palette reverts to magenta as soon as user logs out
      try { applyPalette('magenta'); } catch {}
      setProfile(null);
      return;
    }
    (async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (!error) {
        setProfile(data as any);
      }
    })();
  }, [session?.user?.id]);

  return (
    <AuthContext.Provider value={{ session, user: session?.user ?? null, profile, ready }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
