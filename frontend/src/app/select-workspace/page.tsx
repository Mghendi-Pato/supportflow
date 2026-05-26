'use client';
import { useState, useEffect } from 'react';
import { useQuery } from 'react-query';
import { useRouter } from 'next/navigation';
import {
  Building2,
  Search,
  Users,
  Ticket,
  UserCheck,
  Check,
  LogOut,
  Loader2,
  HeadphonesIcon,
  ShieldCheck,
} from 'lucide-react';
import { clsx } from 'clsx';
import api from '@/lib/api';
import { useSuperAdminTenant, SelectedWorkspace } from '@/contexts/SuperAdminTenantContext';
import { useAuth } from '@/hooks/useAuth';

interface Workspace {
  id: string;
  name: string;
  logoUrl?: string | null;
  createdAt: string;
  _count: { clients: number; tickets: number; members: number };
}

export default function SelectWorkspacePage() {
  const { user, isLoading: authLoading, logout } = useAuth();
  const { selectWorkspace } = useSuperAdminTenant();
  const router = useRouter();
  const [search, setSearch] = useState('');

  // Redirect if not SUPER_ADMIN or not logged in
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace('/login');
      return;
    }
    if (user.role !== 'SUPER_ADMIN') {
      router.replace('/dashboard');
    }
  }, [user, authLoading, router]);

  const { data, isLoading } = useQuery<Workspace[]>(
    'all-workspaces',
    async () => {
      const res = await api.get('/workspace/all');
      return res.data?.data ?? res.data ?? [];
    },
    { enabled: !authLoading && user?.role === 'SUPER_ADMIN', staleTime: 60_000 },
  );

  const workspaces: Workspace[] = data ?? [];
  const filtered = workspaces.filter((ws) =>
    ws.name.toLowerCase().includes(search.toLowerCase()),
  );

  function handleSelect(ws: Workspace) {
    selectWorkspace(ws);
    router.push('/dashboard');
  }

  if (authLoading || !user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 size={28} className="animate-spin text-primary-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-primary-50/30 to-gray-100 flex flex-col">
      {/* Top bar */}
      <header className="bg-white/80 backdrop-blur border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-primary-600 flex items-center justify-center">
            <HeadphonesIcon size={16} className="text-white" />
          </div>
          <span className="font-bold text-gray-900 text-lg">SupportFlow</span>
        </div>

        <div className="flex items-center gap-3">
          {/* SUPER_ADMIN badge */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-full">
            <ShieldCheck size={13} className="text-amber-600" />
            <span className="text-xs font-semibold text-amber-700">Super Admin</span>
          </div>
          <span className="text-sm text-gray-600 hidden sm:block">
            {user.firstName} {user.lastName}
          </span>
          <button
            onClick={logout}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-red-600 transition-colors px-2 py-1 rounded-lg hover:bg-red-50"
          >
            <LogOut size={15} />
            <span className="hidden sm:inline">Sign out</span>
          </button>
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 flex flex-col items-center justify-start px-4 py-12">
        {/* Hero text */}
        <div className="text-center mb-10 max-w-md">
          <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-primary-600 shadow-lg shadow-primary-200 mb-4">
            <Building2 size={26} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Select a Workspace</h1>
          <p className="text-sm text-gray-500">
            Choose which workspace you want to manage. You can switch at any time using the button in the top bar.
          </p>
        </div>

        {/* Search */}
        <div className="w-full max-w-xl mb-6">
          <div className="relative">
            <Search
              size={16}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <input
              type="text"
              placeholder="Search workspaces by name…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-11 pr-4 py-3 bg-white border border-gray-200 rounded-xl shadow-sm text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-transparent"
            />
          </div>
        </div>

        {/* Stats bar */}
        {!isLoading && workspaces.length > 0 && (
          <p className="text-xs text-gray-400 mb-4">
            {filtered.length} of {workspaces.length} workspace{workspaces.length !== 1 ? 's' : ''}
          </p>
        )}

        {/* Workspace grid */}
        <div className="w-full max-w-xl">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <Loader2 size={28} className="animate-spin text-primary-400 mb-3" />
              <p className="text-sm text-gray-400">Loading workspaces…</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16">
              <Building2 size={36} className="text-gray-200 mx-auto mb-3" />
              <p className="text-sm text-gray-400">
                {search ? 'No workspaces match your search' : 'No workspaces registered yet'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map((ws) => (
                <WorkspaceSelectCard key={ws.id} ws={ws} onSelect={handleSelect} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Workspace select card (full-width, click to enter) ─────────
function WorkspaceSelectCard({
  ws,
  onSelect,
}: {
  ws: Workspace;
  onSelect: (ws: Workspace) => void;
}) {
  const initials = ws.name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');

  const joined = new Date(ws.createdAt).toLocaleDateString('en-US', {
    month: 'short',
    year: 'numeric',
  });

  return (
    <button
      onClick={() => onSelect(ws)}
      className="w-full text-left bg-white border border-gray-200 hover:border-primary-300 hover:shadow-md rounded-xl p-4 transition-all duration-150 group"
    >
      <div className="flex items-center gap-4">
        {ws.logoUrl ? (
          <img
            src={ws.logoUrl}
            alt={ws.name}
            className="h-11 w-11 rounded-xl object-cover flex-shrink-0"
          />
        ) : (
          <div className="h-11 w-11 rounded-xl bg-primary-100 text-primary-700 font-bold text-base flex items-center justify-center flex-shrink-0">
            {initials}
          </div>
        )}

        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-900 text-sm">{ws.name}</p>
          <p className="text-xs text-gray-400 mt-0.5">Since {joined}</p>
        </div>

        <div className="flex items-center gap-4 mr-2">
          <Stat icon={<Users size={12} />} value={ws._count.clients} label="clients" />
          <Stat icon={<Ticket size={12} />} value={ws._count.tickets} label="tickets" />
          <Stat icon={<UserCheck size={12} />} value={ws._count.members} label="staff" />
        </div>

        <div className="flex-shrink-0 w-8 h-8 rounded-full border-2 border-gray-200 group-hover:border-primary-400 group-hover:bg-primary-50 flex items-center justify-center transition-colors">
          <Check size={14} className="text-gray-300 group-hover:text-primary-500 transition-colors" />
        </div>
      </div>
    </button>
  );
}

function Stat({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode;
  value: number;
  label: string;
}) {
  return (
    <div className="hidden sm:flex flex-col items-center">
      <div className="flex items-center gap-1 text-gray-400">{icon}</div>
      <span className="text-xs font-semibold text-gray-700">{value}</span>
      <span className="text-[10px] text-gray-400">{label}</span>
    </div>
  );
}
