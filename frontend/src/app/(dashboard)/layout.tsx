'use client';
import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useSuperAdminTenant } from '@/contexts/SuperAdminTenantContext';
import { DashboardSidebar } from '@/components/layout/DashboardSidebar';
import { PageLoader } from '@/components/ui/Spinner';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const { selectedWorkspace } = useSuperAdminTenant();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (isLoading) return;

    if (!user) {
      router.replace('/login');
      return;
    }

    if (user.role === 'CLIENT') {
      router.replace('/portal');
      return;
    }

    // SUPER_ADMIN must select a workspace before accessing the dashboard
    if (user.role === 'SUPER_ADMIN' && !selectedWorkspace) {
      router.replace('/select-workspace');
    }
  }, [user, isLoading, selectedWorkspace, router, pathname]);

  if (isLoading) return <PageLoader />;
  if (!user || user.role === 'CLIENT') return null;

  // Don't render dashboard shell while SUPER_ADMIN is being redirected to picker
  if (user.role === 'SUPER_ADMIN' && !selectedWorkspace) return <PageLoader />;

  return (
    <div className="flex h-screen bg-gray-50">
      <DashboardSidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        {children}
      </div>
    </div>
  );
}
