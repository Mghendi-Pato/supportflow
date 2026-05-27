'use client';
import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useSuperAdminTenant } from '@/contexts/SuperAdminTenantContext';
import { SidebarProvider, useSidebar } from '@/contexts/SidebarContext';
import { DashboardSidebar } from '@/components/layout/DashboardSidebar';
import { PageLoader } from '@/components/ui/Spinner';

/** Darkened backdrop — tapping it closes the sidebar on mobile */
function MobileBackdrop() {
  const { isOpen, close } = useSidebar();
  if (!isOpen) return null;
  return (
    <div
      className="fixed inset-0 z-40 bg-black/40 md:hidden"
      onClick={close}
      aria-hidden="true"
    />
  );
}

function DashboardShell({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const { selectedWorkspace } = useSuperAdminTenant();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (isLoading) return;
    if (!user) { router.replace('/login'); return; }
    if (user.role === 'CLIENT') { router.replace('/portal'); return; }
    if (user.role === 'SUPER_ADMIN' && !selectedWorkspace) {
      router.replace('/select-workspace');
    }
  }, [user, isLoading, selectedWorkspace, router, pathname]);

  if (isLoading) return <PageLoader />;
  if (!user || user.role === 'CLIENT') return null;
  if (user.role === 'SUPER_ADMIN' && !selectedWorkspace) return <PageLoader />;

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <DashboardSidebar />
      <MobileBackdrop />
      {/* min-w-0 prevents flex children from overflowing */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {children}
      </div>
    </div>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <DashboardShell>{children}</DashboardShell>
    </SidebarProvider>
  );
}
