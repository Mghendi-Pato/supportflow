'use client';
import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { HeadphonesIcon, LogOut, Receipt, Menu, X } from 'lucide-react';
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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <>
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-16 gap-3">
            {/* Logo */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <div className="h-8 w-8 rounded-lg bg-primary-600 flex items-center justify-center">
                <HeadphonesIcon size={16} className="text-white" />
              </div>
              <span className="font-bold text-gray-900">SupportFlow</span>
            </div>

            {/* Desktop nav */}
            <nav className="hidden sm:flex items-center gap-1 flex-1 justify-center">
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

            {/* Right controls */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <NotificationBell />
              <div className="flex items-center gap-2 pl-2 border-l border-gray-200">
                <div className="h-8 w-8 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 text-sm font-semibold capitalize">
                  {user?.firstName?.[0]}
                  {user?.lastName?.[0]}
                </div>
                <span className="text-sm text-gray-700 hidden md:block">
                  {user?.firstName} {user?.lastName}
                </span>
              </div>
              <button
                onClick={() => setShowLogoutConfirm(true)}
                className="hidden sm:block p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                title="Sign out"
              >
                <LogOut size={18} />
              </button>
              {/* Hamburger — mobile only */}
              <button
                onClick={() => setMobileMenuOpen((v) => !v)}
                className="sm:hidden p-2 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors"
                aria-label="Toggle menu"
              >
                {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile dropdown menu */}
        {mobileMenuOpen && (
          <div className="sm:hidden border-t border-gray-100 bg-white px-4 py-3 space-y-1">
            {navItems.map(({ href, label }) => {
              const active = pathname === href;
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={clsx(
                    'flex items-center px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                    active
                      ? 'bg-primary-50 text-primary-700'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900',
                  )}
                >
                  {label}
                </Link>
              );
            })}
            <button
              onClick={() => {
                setMobileMenuOpen(false);
                setShowLogoutConfirm(true);
              }}
              className="flex items-center gap-2 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
            >
              <LogOut size={16} />
              Sign out
            </button>
          </div>
        )}
      </header>

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
    </>
  );
}
