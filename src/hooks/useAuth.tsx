import { createContext, useContext, useMemo, useState } from 'react';
import { api, getToken, setToken, clearToken } from '@/lib/api';

type AuthContextValue = {
  token: string | null;
  login: (email: string, code: string) => Promise<void>;
  logout: () => void;
  authDisabled: boolean;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const authDisabled = import.meta.env.VITE_AUTH_DISABLED === '1';
  const [token, setTokenState] = useState<string | null>(authDisabled ? 'disabled' : getToken());

  const value = useMemo<AuthContextValue>(() => ({
    authDisabled,
    token,
    login: async (email, code) => {
      if (authDisabled) return;
      const res = await api.authVerify(email, code);
      setToken(res.token);
      setTokenState(res.token);
    },
    logout: () => {
      if (authDisabled) return;
      clearToken();
      setTokenState(null);
    },
  }), [token, authDisabled]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
