'use client';
import { useState, useEffect, useRef } from 'react';
import { useQuery } from 'react-query';
import { useRouter } from 'next/navigation';
import {
  X,
  Search,
  Building2,
  Users,
  Ticket,
  UserCheck,
  Check,
  ChevronDown,
  Loader2,
} from 'lucide-react';
import { clsx } from 'clsx';
import api from '@/lib/api';
import { useSuperAdminTenant, SelectedWorkspace } from '@/contexts/SuperAdminTenantContext';

interface Workspace {
  id: string;
  name: string;
  logoUrl?: string | null;
  createdAt: string;
  _count: { clients: number; tickets: number; members: number };
}

interface WorkspaceSelectorDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

// ─── Workspace Card ────────────────────────────────────────────
function WorkspaceCard({
  ws,
  isSelected,
  onSelect,
}: {
  ws: Workspace;
  isSelected: boolean;
  onSelect: (ws: Workspace) => void;
}) {
  const initials = ws.name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');

  return (
    <button
      onClick={() => onSelect(ws)}
      className={clsx(
        'w-full text-left p-3 rounded-xl border transition-all duration-150 group',
        isSelected
          ? 'border-primary-300 bg-primary-50 shadow-sm'
          : 'border-gray-100 hover:border-primary-200 hover:bg-gray-50',
      )}
    >
      <div className="flex items-center gap-3">
        {/* Logo / initials */}
        {ws.logoUrl ? (
          <img
            src={ws.logoUrl}
            alt={ws.name}
            className="h-9 w-9 rounded-lg object-cover flex-shrink-0"
          />
        ) : (
          <div className="h-9 w-9 rounded-lg bg-primary-100 text-primary-700 text-sm font-bold flex items-center justify-center flex-shrink-0">
            {initials}
          </div>
        )}

        {/* Name + stats */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 truncate">{ws.name}</p>
          <div className="flex items-center gap-3 mt-0.5">
            <span className="flex items-center gap-1 text-xs text-gray-400">
              <Users size={11} /> {ws._count.clients} clients
            </span>
            <span className="flex items-center gap-1 text-xs text-gray-400">
              <Ticket size={11} /> {ws._count.tickets} tickets
            </span>
            <span className="flex items-center gap-1 text-xs text-gray-400">
              <UserCheck size={11} /> {ws._count.members} staff
            </span>
          </div>
        </div>

        {/* Selected check */}
        {isSelected && (
          <div className="flex-shrink-0 h-5 w-5 rounded-full bg-primary-600 flex items-center justify-center">
            <Check size={12} className="text-white" />
          </div>
        )}
      </div>
    </button>
  );
}

// ─── Main Drawer / Dropdown ────────────────────────────────────
export function WorkspaceSelectorDrawer({ isOpen, onClose }: WorkspaceSelectorDrawerProps) {
  const { selectedWorkspace, selectWorkspace } = useSuperAdminTenant();
  const router = useRouter();
  const [search, setSearch] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);

  const { data, isLoading } = useQuery<Workspace[]>(
    'all-workspaces',
    async () => {
      const res = await api.get('/workspace/all');
      return res.data?.data ?? res.data ?? [];
    },
    { enabled: isOpen, staleTime: 60_000 },
  );

  // Focus search on open
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => searchRef.current?.focus(), 120);
    } else {
      setSearch('');
    }
  }, [isOpen]);

  const workspaces: Workspace[] = data ?? [];
  const filtered = workspaces.filter((ws) =>
    ws.name.toLowerCase().includes(search.toLowerCase()),
  );

  function handleSelect(ws: Workspace) {
    const prev = selectedWorkspace?.id;
    selectWorkspace(ws);
    onClose();
    // If switching workspaces, go back to dashboard so stale data refreshes
    if (prev && prev !== ws.id) {
      router.push('/dashboard');
    }
  }

  if (!isOpen) return null;

  return (
    <>
      {/* ── Desktop: right-side drawer ── */}
      <div className="hidden md:block">
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40"
          onClick={onClose}
        />

        {/* Panel */}
        <div className="fixed top-0 right-0 h-full w-80 bg-white shadow-2xl z-50 flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <Building2 size={18} className="text-primary-600" />
              <h2 className="font-semibold text-gray-900">Switch Workspace</h2>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
            >
              <X size={16} />
            </button>
          </div>

          {/* Search */}
          <div className="px-4 py-3 border-b border-gray-50">
            <div className="relative">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <input
                ref={searchRef}
                type="text"
                placeholder="Search workspaces…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-transparent"
              />
            </div>
          </div>

          {/* Workspace list */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
            {isLoading ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 size={20} className="animate-spin text-primary-500" />
              </div>
            ) : filtered.length === 0 ? (
              <p className="text-center text-sm text-gray-400 py-8">
                {search ? 'No workspaces match your search' : 'No workspaces found'}
              </p>
            ) : (
              filtered.map((ws) => (
                <WorkspaceCard
                  key={ws.id}
                  ws={ws}
                  isSelected={selectedWorkspace?.id === ws.id}
                  onSelect={handleSelect}
                />
              ))
            )}
          </div>

          {/* Footer count */}
          <div className="px-5 py-3 border-t border-gray-100">
            <p className="text-xs text-gray-400 text-center">
              {workspaces.length} workspace{workspaces.length !== 1 ? 's' : ''} on platform
            </p>
          </div>
        </div>
      </div>

      {/* ── Mobile: dropdown panel ── */}
      <div className="md:hidden">
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-black/30 z-40"
          onClick={onClose}
        />

        {/* Sheet from top */}
        <div className="fixed top-0 left-0 right-0 bg-white shadow-2xl z-50 rounded-b-2xl max-h-[80vh] flex flex-col">
          {/* Handle bar */}
          <div className="flex justify-center pt-3 pb-1">
            <div className="w-10 h-1 bg-gray-200 rounded-full" />
          </div>

          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <Building2 size={18} className="text-primary-600" />
              <h2 className="font-semibold text-gray-900">Switch Workspace</h2>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
            >
              <X size={16} />
            </button>
          </div>

          {/* Search */}
          <div className="px-4 py-3 border-b border-gray-50">
            <div className="relative">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <input
                type="text"
                placeholder="Search workspaces…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-transparent"
              />
            </div>
          </div>

          {/* Workspace list */}
          <div className="overflow-y-auto px-4 py-3 space-y-2">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 size={20} className="animate-spin text-primary-500" />
              </div>
            ) : filtered.length === 0 ? (
              <p className="text-center text-sm text-gray-400 py-6">
                {search ? 'No workspaces match your search' : 'No workspaces found'}
              </p>
            ) : (
              filtered.map((ws) => (
                <WorkspaceCard
                  key={ws.id}
                  ws={ws}
                  isSelected={selectedWorkspace?.id === ws.id}
                  onSelect={handleSelect}
                />
              ))
            )}
          </div>

          <div className="px-5 py-3 border-t border-gray-100">
            <p className="text-xs text-gray-400 text-center">
              {workspaces.length} workspace{workspaces.length !== 1 ? 's' : ''} on platform
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
