'use client';
import { createContext, useCallback, useContext, useState } from 'react';
import { useRouter } from 'next/navigation';

interface AuthContextValue {
  token: string | null;
  setToken: (token: string) => void;
  clearToken: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextValue>({
  token: null,
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  setToken: () => {},
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  clearToken: () => {},
  isAuthenticated: false,
});

const TOKEN_KEY = 'monitoring_token';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // Token persists in sessionStorage — survives page refreshes but cleared
  // when the browser tab closes. Not as permanent as localStorage.
  const [token, setTokenState] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    return sessionStorage.getItem(TOKEN_KEY);
  });
  const router = useRouter();

  const setToken = useCallback((t: string) => {
    sessionStorage.setItem(TOKEN_KEY, t);
    setTokenState(t);
  }, []);

  const clearToken = useCallback(() => {
    sessionStorage.removeItem(TOKEN_KEY);
    setTokenState(null);
    router.push('/auth/login');
  }, [router]);

  return (
    <AuthContext.Provider value={{ token, setToken, clearToken, isAuthenticated: !!token }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
