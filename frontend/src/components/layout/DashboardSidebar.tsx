'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Ticket,
  Users,
  BarChart3,
  Settings,
  HeadphonesIcon,
} from 'lucide-react';
import { clsx } from 'clsx';
import { useAuth } from '@/hooks/useAuth';

const navItems = [
  { href: '/dashboard',  label: 'Dashboard', icon: LayoutDashboard },
  { href: '/tickets',    label: 'Tickets',   icon: Ticket },
  { href: '/clients',    label: 'Clients',   icon: Users,    adminOnly: true },
  { href: '/analytics',  label: 'Analytics', icon: BarChart3, adminOnly: true },
  { href: '/settings',   label: 'Settings',  icon: Settings, adminOnly: true },
];

export function DashboardSidebar() {
  const pathname = usePathname();
  const { user } = useAuth();
  const isAdmin = user?.role === 'WORKSPACE_ADMIN' || user?.role === 'SUPER_ADMIN';

  return (
    <aside className="w-64 bg-white border-r border-gray-200 flex flex-col h-full">
      {/* Logo */}
      <div className="flex items-center gap-2 px-6 py-5 border-b border-gray-100">
        <div className="h-8 w-8 rounded-lg bg-primary-600 flex items-center justify-center">
          <HeadphonesIcon size={16} className="text-white" />
        </div>
        <span className="font-bold text-gray-900 text-lg">SupportFlow</span>
      </div>

      {/* Workspace name */}
      {user?.tenant && (
        <div className="px-6 py-3 border-b border-gray-100">
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Workspace</p>
          <p className="text-sm font-semibold text-gray-800 truncate">{user.tenant.name}</p>
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems
          .filter((item) => !item.adminOnly || isAdmin)
          .map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(href + '/');
            return (
              <Link
                key={href}
                href={href}
                className={clsx(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                  active
                    ? 'bg-primary-50 text-primary-700'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
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
