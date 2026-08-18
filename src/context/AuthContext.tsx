import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { PublicUser, Role } from '@/types';
import { authApi } from '@/api';

const SESSION_KEY = 'registream.session';

interface AuthContextValue {
  user: PublicUser | null;
  role: Role | null;
  /** True while the persisted session is being re-checked on boot. */
  isRestoring: boolean;
  signIn: (email: string, password: string) => Promise<PublicUser>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [isRestoring, setIsRestoring] = useState(true);
  const queryClient = useQueryClient();

  // The session lives in memory on the server; the token in localStorage only
  // says which account to re-attach to. The account is re-checked on restore,
  // so a suspension applied mid-session ends it.
  useEffect(() => {
    let cancelled = false;
    const token = (() => {
      try {
        return localStorage.getItem(SESSION_KEY);
      } catch {
        return null;
      }
    })();

    if (!token) {
      setIsRestoring(false);
      return;
    }

    authApi
      .restoreSession(token)
      .then((restored) => {
        if (!cancelled) setUser(restored);
      })
      .catch(() => {
        try {
          localStorage.removeItem(SESSION_KEY);
        } catch {
          /* ignore */
        }
      })
      .finally(() => {
        if (!cancelled) setIsRestoring(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const signIn = useCallback(
    async (email: string, password: string) => {
      const signedIn = await authApi.login(email, password);
      try {
        localStorage.setItem(SESSION_KEY, signedIn.id);
      } catch {
        /* ignore */
      }
      setUser(signedIn);
      await queryClient.invalidateQueries();
      return signedIn;
    },
    [queryClient],
  );

  const signOut = useCallback(async () => {
    await authApi.logout();
    try {
      localStorage.removeItem(SESSION_KEY);
    } catch {
      /* ignore */
    }
    setUser(null);
    queryClient.clear();
  }, [queryClient]);

  const value = useMemo(
    () => ({ user, role: user?.role ?? null, isRestoring, signIn, signOut }),
    [user, isRestoring, signIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside an AuthProvider.');
  return context;
}
