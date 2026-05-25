'use client';
import { useState } from 'react';
import { LogOut } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useNotify } from '@/hooks/useNotify';
import { NotificationBell } from './NotificationBell';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';

interface DashboardNavbarProps {
  title: string;
  actions?: React.ReactNode;
}

export function DashboardNavbar({ title, actions }: DashboardNavbarProps) {
  const { user, logout } = useAuth();
  const notify = useNotify();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  return (
    <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
      <h1 className="text-xl font-semibold text-gray-900">{title}</h1>

      <div className="flex items-center gap-3">
        {actions}
        <NotificationBell />

        {/* Avatar + name */}
        <div className="flex items-center gap-2 pl-3 border-l border-gray-200">
          <div className="h-8 w-8 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 text-sm font-semibold">
            {user?.firstName?.[0]}{user?.lastName?.[0]}
          </div>
          <span className="text-sm text-gray-700 hidden sm:block">
            {user?.firstName} {user?.lastName}
          </span>
        </div>

        {/* Sign out */}
        <button
          onClick={() => setShowLogoutConfirm(true)}
          className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
          title="Sign out"
        >
          <LogOut size={18} />
        </button>
      </div>

      <ConfirmDialog
        isOpen={showLogoutConfirm}
        variant="warning"
        title="Sign out?"
        description="You'll be signed out of your account and redirected to the login page."
        confirmLabel="Sign out"
        cancelLabel="Stay signed in"
        onConfirm={() => { setShowLogoutConfirm(false); notify.info('Signed out'); logout(); }}
        onCancel={() => setShowLogoutConfirm(false)}
      />
    </header>
  );
}
