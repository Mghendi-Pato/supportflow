'use client';
import { useState } from 'react';
import { LogOut, Building2, ChevronDown, Menu } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useNotify } from '@/hooks/useNotify';
import { NotificationBell } from './NotificationBell';
import { WorkspaceSelectorDrawer } from './WorkspaceSelectorDrawer';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useSuperAdminTenant } from '@/contexts/SuperAdminTenantContext';
import { useSidebar } from '@/contexts/SidebarContext';

interface DashboardNavbarProps {
  title: string;
  actions?: React.ReactNode;
}

export function DashboardNavbar({ title, actions }: DashboardNavbarProps) {
  const { user, logout } = useAuth();
  const notify = useNotify();
  const { selectedWorkspace } = useSuperAdminTenant();
  const { toggle } = useSidebar();
  const [showLogoutConfirm,     setShowLogoutConfirm]     = useState(false);
  const [showWorkspaceSelector, setShowWorkspaceSelector] = useState(false);

  const isSuperAdmin = user?.role === 'SUPER_ADMIN';

  return (
    <>
      <header className="bg-white border-b border-gray-200 px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between gap-2 flex-shrink-0">

        {/* Left: hamburger (mobile) + page title */}
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={toggle}
            className="md:hidden p-2 -ml-1 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors flex-shrink-0"
            aria-label="Open navigation"
          >
            <Menu size={20} />
          </button>
          <h1 className="text-lg sm:text-xl font-semibold text-gray-900 truncate">{title}</h1>
        </div>

        {/* Right-side controls */}
        <div className="flex items-center gap-1 sm:gap-3 flex-shrink-0">
          {actions && <div className="hidden sm:flex items-center gap-2">{actions}</div>}
          <NotificationBell />

          {/* SUPER_ADMIN workspace switcher */}
          {isSuperAdmin && (
            <button
              onClick={() => setShowWorkspaceSelector(true)}
              className="flex items-center gap-2 px-2 sm:px-3 py-2 rounded-lg border border-gray-200 hover:border-primary-300 hover:bg-primary-50 transition-colors text-sm font-medium text-gray-700 hover:text-primary-700"
              title="Switch workspace"
            >
              <Building2 size={15} className="text-primary-500 flex-shrink-0" />
              <span className="truncate hidden sm:block max-w-[140px]">
                {selectedWorkspace?.name ?? 'Select Workspace'}
              </span>
              <ChevronDown size={13} className="text-gray-400 flex-shrink-0 hidden sm:block" />
            </button>
          )}

          {/* Avatar + name */}
          <div className="flex items-center gap-2 pl-2 sm:pl-3 border-l border-gray-200">
            <div className="h-8 w-8 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 text-sm font-semibold flex-shrink-0">
              {user?.firstName?.[0]}{user?.lastName?.[0]}
            </div>
            <span className="text-sm text-gray-700 hidden lg:block">
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
      </header>

      {/* Mobile-only actions bar (shown below header when actions exist) */}
      {actions && (
        <div className="sm:hidden px-4 py-2 bg-white border-b border-gray-100 flex items-center gap-2">
          {actions}
        </div>
      )}

      <WorkspaceSelectorDrawer
        isOpen={showWorkspaceSelector}
        onClose={() => setShowWorkspaceSelector(false)}
      />

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
    </>
  );
}
