import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import {
  supabase,
  extractUserDisplayName,
  setCachedSupabaseSession,
  setCachedSupabaseAdmin,
} from '../supabase/client';

export interface AuthUser {
  id: string;
  uid: string;
  email: string | null;
  name: string;
  displayName: string | null;
  photoURL: string | null;
}

interface AuthContextValue {
  user: AuthUser | null;
  session: Session | null;
  isLoading: boolean;
  isAuthLoading: boolean;
  isAdmin: boolean;
  refreshAdminStatus: () => Promise<boolean>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function mapSupabaseUser(sbUser: User | null | undefined): AuthUser | null {
  if (!sbUser) return null;
  const name = extractUserDisplayName(sbUser);
  const meta = sbUser.user_metadata as Record<string, unknown> | undefined;
  const avatarUrl =
    typeof meta?.avatar_url === 'string' && meta.avatar_url.trim()
      ? meta.avatar_url.trim()
      : typeof meta?.picture === 'string' && meta.picture.trim()
      ? meta.picture.trim()
      : null;

  return {
    id: sbUser.id,
    uid: sbUser.id,
    email: sbUser.email ?? null,
    name,
    displayName: name,
    photoURL: avatarUrl,
  };
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const activeUserIdRef = useRef<string | null>(null);

  const fetchIsAdminRpc = useCallback(async (expectedUid?: string): Promise<boolean> => {
    try {
      const { data, error } = await supabase.rpc('is_admin');
      const result = !error && data === true;
      if (!expectedUid || activeUserIdRef.current === expectedUid) {
        setCachedSupabaseAdmin(result);
        setIsAdmin(result);
      }
      return result;
    } catch {
      if (!expectedUid || activeUserIdRef.current === expectedUid) {
        setCachedSupabaseAdmin(false);
        setIsAdmin(false);
      }
      return false;
    }
  }, []);

  const refreshAdminStatus = useCallback(async (): Promise<boolean> => {
    const uid = activeUserIdRef.current;
    if (!uid) {
      setCachedSupabaseAdmin(false);
      setIsAdmin(false);
      return false;
    }
    return fetchIsAdminRpc(uid);
  }, [fetchIsAdminRpc]);

  useEffect(() => {
    let mounted = true;

    const initAuth = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (!mounted) return;
        const initialSession = data.session ?? null;
        setCachedSupabaseSession(initialSession);
        const mapped = mapSupabaseUser(initialSession?.user);
        activeUserIdRef.current = mapped?.id ?? null;
        setSession(initialSession);
        setUser(mapped);

        if (mapped) {
          await fetchIsAdminRpc(mapped.id);
        } else {
          setCachedSupabaseAdmin(false);
          setIsAdmin(false);
        }
      } catch {
        if (!mounted) return;
        setCachedSupabaseSession(null);
        activeUserIdRef.current = null;
        setSession(null);
        setUser(null);
        setCachedSupabaseAdmin(false);
        setIsAdmin(false);
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    void initAuth();

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!mounted) return;
      const resolvedSession = nextSession ?? null;
      setCachedSupabaseSession(resolvedSession);
      const mapped = mapSupabaseUser(resolvedSession?.user);
      const prevUid = activeUserIdRef.current;
      const nextUid = mapped?.id ?? null;
      activeUserIdRef.current = nextUid;
      setSession(resolvedSession);
      setUser(mapped);

      if (!nextUid) {
        setCachedSupabaseAdmin(false);
        setIsAdmin(false);
      } else if (prevUid !== nextUid) {
        // Reset until RPC confirms for the newly signed-in user
        setCachedSupabaseAdmin(false);
        setIsAdmin(false);
      }
      setIsLoading(false);
    });

    return () => {
      mounted = false;
      subscription.subscription.unsubscribe();
    };
  }, [fetchIsAdminRpc]);

  // Run admin RPC check outside onAuthStateChange callback whenever signed-in user id changes
  useEffect(() => {
    if (!user?.id) {
      setCachedSupabaseAdmin(false);
      setIsAdmin(false);
      return;
    }
    void fetchIsAdminRpc(user.id);
  }, [user?.id, fetchIsAdminRpc]);

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      throw error;
    }
    setCachedSupabaseSession(null);
    setCachedSupabaseAdmin(false);
    activeUserIdRef.current = null;
    setSession(null);
    setUser(null);
    setIsAdmin(false);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        isLoading,
        isAuthLoading: isLoading,
        isAdmin,
        refreshAdminStatus,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
