import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from './api';

type UserProfile = {
  id: string;
  email: string;
  committee: string;
  role: string;
};

type AuthContextType = {
  user: UserProfile | null;
  loading: boolean;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({ user: null, loading: true, logout: async () => {} });

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProfile = async (sessionUser: any) => {
      if (!sessionUser) {
        setUser(null);
        setLoading(false);
        return;
      }
      
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', sessionUser.id)
        .single();
        
      if (!error && data) {
        setUser({ id: data.id, email: data.email, committee: data.committee, role: data.role });
      }
      setLoading(false);
    };

    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      fetchProfile(session?.user);
    });

    // Listen for login/logout
    // Supabase holds an auth lock while this callback runs; querying inside it
    // can deadlock the client (signOut then never resolves). Defer the fetch.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setTimeout(() => fetchProfile(session?.user), 0);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Sign out everywhere, drop any cached session, and leave the app shell.
  const logout = async () => {
    try {
      await supabase.auth.signOut({ scope: 'global' });
    } catch {
      await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
    }
    try {
      Object.keys(localStorage)
        .filter(k => k.startsWith('sb-') || k === 'sodmun_last_reso_id')
        .forEach(k => localStorage.removeItem(k));
      sessionStorage.clear();
    } catch {}
    setUser(null);
    window.location.replace('/login');
  };

  return (
    <AuthContext.Provider value={{ user, loading, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);