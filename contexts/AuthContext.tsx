import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from 'react';
import api, { authApi } from '../lib/api';
import {
  setTokens,
  clearTokens,
  getAccessToken,
  getRefreshToken,
} from '../lib/storage';
import { hapticSuccess, hapticError } from '../lib/haptics';
import type { User, AuthResponse } from '../types/auth';

interface AuthContextType {
  isAuthenticated: boolean;
  isGuest: boolean;
  isLoading: boolean;
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  loginWithApple: (identityToken: string, authCode: string, fullName?: string, email?: string) => Promise<void>;
  logout: () => Promise<void>;
  deleteAccount: (password?: string) => Promise<void>;
  enterGuestMode: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGuest, setIsGuest] = useState(false);

  const isAuthenticated = user !== null;

  const enterGuestMode = useCallback(() => {
    setIsGuest(true);
  }, []);

  // Restore session on mount
  useEffect(() => {
    const restore = async () => {
      try {
        const token = await getAccessToken();
        if (token) {
          const { data } = await authApi.get('/health');
          if (data.status === 'ok') {
            const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
            const payload = JSON.parse(decodeURIComponent(escape(globalThis.atob?.(base64) ?? Buffer.from(base64, 'base64').toString('utf-8'))));
            setUser({ id: payload.sub, email: payload.email });
          }
        }
      } catch {
        await clearTokens();
      } finally {
        setIsLoading(false);
      }
    };
    restore();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    try {
      const { data } = await authApi.post<AuthResponse>('/auth/login', {
        email,
        password,
      });
      await setTokens(data.access_token, data.refresh_token);
      setUser(data.user);
      hapticSuccess();
    } catch (err) {
      hapticError();
      throw err;
    }
  }, []);

  const register = useCallback(async (email: string, password: string) => {
    try {
      const { data } = await authApi.post<AuthResponse>('/auth/register', {
        email,
        password,
      });
      await setTokens(data.access_token, data.refresh_token);
      setUser(data.user);
      hapticSuccess();
    } catch (err) {
      hapticError();
      throw err;
    }
  }, []);

  // Sign in with Apple (Guideline 4.8)
  const loginWithApple = useCallback(
    async (identityToken: string, authCode: string, fullName?: string, email?: string) => {
      try {
        const { data } = await authApi.post<AuthResponse>('/auth/apple', {
          identity_token: identityToken,
          authorization_code: authCode,
          full_name: fullName,
          email,
        });
        await setTokens(data.access_token, data.refresh_token);
        setUser(data.user);
        hapticSuccess();
      } catch (err) {
        hapticError();
        throw err;
      }
    },
    []
  );

  const logout = useCallback(async () => {
    try {
      const refreshToken = await getRefreshToken();
      if (refreshToken) {
        await authApi.post('/auth/logout', { refresh_token: refreshToken });
      }
    } catch {
      // Ignore logout API errors
    } finally {
      await clearTokens();
      setUser(null);
      setIsGuest(false);
    }
  }, []);

  // Account deletion (Guideline 5.1.1)
  const deleteAccount = useCallback(
    async (password?: string) => {
      await authApi.delete('/auth/account', {
        data: { password: password || '' },
      });
      await clearTokens();
      setUser(null);
      hapticSuccess();
    },
    []
  );

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        isGuest,
        isLoading,
        user,
        login,
        register,
        loginWithApple,
        logout,
        deleteAccount,
        enterGuestMode,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
