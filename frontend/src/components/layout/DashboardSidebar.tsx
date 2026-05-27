'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Ticket, Users, BarChart3, Settings,
  HeadphonesIcon, ShieldCheck, X,
} from 'lucide-react';
import { clsx } from 'clsx';
import { useAuth } from '@/hooks/useAuth';
import { useSuperAdminTenant } from '@/contexts/SuperAdminTenantContext';
import { useSidebar } from '@/contexts/SidebarContext';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/tickets',   label: 'Tickets',   icon: Ticket },
  { href: '/clients',   label: 'Clients',   icon: Users,    adminOnly: true },
  { href: '/analytics', label: 'Analytics', icon: BarChart3, adminOnly: true },
  { href: '/settings',  label: 'Settings',  icon: Settings, adminOnly: true },
];

export function DashboardSidebar() {
  const pathname = usePathname();
  const { user } = useAuth();
  const { selectedWorkspace } = useSuperAdminTenant();
  const { isOpen, close } = useSidebar();

  const isAdmin      = user?.role === 'WORKSPACE_ADMIN' || user?.role === 'SUPER_ADMIN';
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';

  const workspaceName = isSuperAdmin ? selectedWorkspace?.name : user?.tenant?.name;

  return (
    <aside
      className={clsx(
        // Shared
        'w-64 bg-white border-r border-gray-200 flex flex-col h-full',
        // Mobile: slide-in overlay drawer (z-50 sits above the z-40 backdrop)
        'fixed inset-y-0 left-0 z-50 transition-transform duration-300 ease-in-out',
        // Desktop: always visible, not fixed
        'md:static md:translate-x-0 md:z-auto md:transition-none',
        // Toggle on mobile
        isOpen ? 'translate-x-0' : '-translate-x-full',
      )}
    >
      {/* Header row — logo + mobile close button */}
      <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-primary-600 flex items-center justify-center flex-shrink-0">
            <HeadphonesIcon size={16} className="text-white" />
          </div>
          <span className="font-bold text-gray-900 text-lg">SupportFlow</span>
        </div>
        {/* Close button — only visible on mobile */}
        <button
          onClick={close}
          className="md:hidden p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          aria-label="Close navigation"
        >
          <X size={18} />
        </button>
      </div>

      {/* Workspace name */}
      {workspaceName && (
        <div className="px-6 py-3 border-b border-gray-100">
          {isSuperAdmin && (
            <div className="flex items-center gap-1 mb-1">
              <ShieldCheck size={11} className="text-amber-500" />
              <p className="text-[10px] text-amber-600 font-semibold uppercase tracking-wide">
                Super Admin
              </p>
            </div>
          )}
          {!isSuperAdmin && (
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Workspace</p>
          )}
          <p className="text-sm font-semibold text-gray-800 truncate">{workspaceName}</p>
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems
          .filter(item => !item.adminOnly || isAdmin)
          .map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(href + '/');
            return (
              <Link
                key={href}
                href={href}
                onClick={close}   // auto-close on mobile when navigating
                className={clsx(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                  active
                    ? 'bg-primary-50 text-primary-700'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900',
                )}
              >
                <Icon size={18} className={active ? 'text-primary-600' : 'text-gray-400'} />
                {label}
              </Link>
            );
          })}
      </nav>
    </aside>
  );
}
