'use client';
import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';

const STORAGE_KEY = 'superAdminSelectedTenant';
const HEADER_KEY  = 'superAdminTenantId'; // read by api.ts interceptor

export interface SelectedWorkspace {
  id: string;
  name: string;
  logoUrl?: string | null;
  createdAt?: string;
  _count?: { clients: number; tickets: number; members: number };
}

interface SuperAdminTenantContextValue {
  selectedWorkspace: SelectedWorkspace | null;
  selectWorkspace: (ws: SelectedWorkspace) => void;
  clearWorkspace: () => void;
}

const SuperAdminTenantContext = createContext<SuperAdminTenantContextValue | null>(null);

export function SuperAdminTenantProvider({ children }: { children: React.ReactNode }) {
  const [selectedWorkspace, setSelectedWorkspace] = useState<SelectedWorkspace | null>(null);
  const [hydrated, setHydrated] = useState(false);

  // Restore from localStorage on mount (client-side only)
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as SelectedWorkspace;
        setSelectedWorkspace(parsed);
        localStorage.setItem(HEADER_KEY, parsed.id);
      }
    } catch {
      // ignore parse errors
    }
    setHydrated(true);
  }, []);

  const selectWorkspace = useCallback((ws: SelectedWorkspace) => {
    setSelectedWorkspace(ws);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ws));
    localStorage.setItem(HEADER_KEY, ws.id);
  }, []);

  const clearWorkspace = useCallback(() => {
    setSelectedWorkspace(null);
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(HEADER_KEY);
  }, []);

  // Prevent flash of redirect before hydration completes
  if (!hydrated) return null;

  return (
    <SuperAdminTenantContext.Provider value={{ selectedWorkspace, selectWorkspace, clearWorkspace }}>
      {children}
    </SuperAdminTenantContext.Provider>
  );
}

export function useSuperAdminTenant() {
  const ctx = useContext(SuperAdminTenantContext);
  if (!ctx) throw new Error('useSuperAdminTenant must be used within SuperAdminTenantProvider');
  return ctx;
}
