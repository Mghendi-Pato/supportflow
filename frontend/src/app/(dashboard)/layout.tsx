'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { DashboardSidebar } from '@/components/layout/DashboardSidebar';
import { PageLoader } from '@/components/ui/Spinner';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      router.replace('/login');
    } else if (user.role === 'CLIENT') {
      router.replace('/portal');
    }
  }, [user, isLoading, router]);

  if (isLoading) return <PageLoader />;
  if (!user || user.role === 'CLIENT') return null;

  return (
    <div className="flex h-screen bg-gray-50">
      <DashboardSidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        {children}
      </div>
    </div>
  );
}
