'use client';
import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { HeadphonesIcon, LogOut, Receipt } from 'lucide-react';
import { clsx } from 'clsx';
import { useAuth } from '@/hooks/useAuth';
import { useNotify } from '@/hooks/useNotify';
import { NotificationBell } from './NotificationBell';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';

const navItems = [
  { href: '/portal', label: 'My Tickets' },
  { href: '/portal/new', label: 'New Ticket' },
  { href: '/portal/spending', label: 'Billing', icon: Receipt },
];

export function ClientPortalNavbar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const notify = useNotify();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary-600 flex items-center justify-center">
              <HeadphonesIcon size={16} className="text-white" />
            </div>
            <span className="font-bold text-gray-900">SupportFlow</span>
          </div>

          {/* Nav */}
          <nav className="flex items-center gap-1">
            {navItems.map(({ href, label }) => {
              const active = pathname === href;
              return (
                <Link
                  key={href}
                  href={href}
                  className={clsx(
                    'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                    active
                      ? 'bg-primary-50 text-primary-700'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900',
                  )}
                >
                  {label}
                </Link>
              );
            })}
          </nav>

          {/* Right */}
          <div className="flex items-center gap-2">
            <NotificationBell />
            <div className="flex items-center gap-2 pl-2 border-l border-gray-200">
              <div className="h-8 w-8 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 text-sm font-semibold">
                {user?.firstName?.[0]}
                {user?.lastName?.[0]}
              </div>
              <span className="text-sm text-gray-700 hidden sm:block">
                {user?.firstName} {user?.lastName}
              </span>
            </div>
            <button
              onClick={() => setShowLogoutConfirm(true)}
              className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
              title="Sign out"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </div>

      <ConfirmDialog
        isOpen={showLogoutConfirm}
        variant="warning"
        title="Sign out?"
        description="You'll be signed out and redirected to the login page."
        confirmLabel="Sign out"
        cancelLabel="Stay signed in"
        onConfirm={() => {
          setShowLogoutConfirm(false);
          notify.info('Signed out');
          logout();
        }}
        onCancel={() => setShowLogoutConfirm(false)}
      />
    </header>
  );
}
