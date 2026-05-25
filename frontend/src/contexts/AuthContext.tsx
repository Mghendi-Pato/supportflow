'use client';
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import type { User, Tenant } from '@/types';

interface AuthUser extends User {
  role: string;
  tenant: Tenant | null;
}

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

// Helper: flatten the /auth/me response into a single AuthUser object.
// The API returns { user: {...}, role, tenantId, tenant } — we spread the
// nested `user` fields into the top-level so that user.firstName etc. work.
function flattenMeResponse(data: any): AuthUser {
  const { user: userData, role, tenant } = data;
  return { ...userData, role, tenant };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchMe = useCallback(async () => {
    try {
      const res = await api.get('/auth/me');
      setUser(flattenMeResponse(res.data.data));
    } catch {
      setUser(null);
    }
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      fetchMe().finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
  }, [fetchMe]);

  const login = async (email: string, password: string) => {
    const res = await api.post('/auth/login', { email, password });
    const { accessToken, refreshToken } = res.data.data;
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
    const meRes = await api.get('/auth/me');
    setUser(flattenMeResponse(meRes.data.data));
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } catch {/* ignore */}
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    setUser(null);
    router.push('/login');
  };

  const refreshUser = async () => {
    await fetchMe();
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}
