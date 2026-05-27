'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { ClientPortalNavbar } from '@/components/layout/ClientPortalNavbar';
import { PageLoader } from '@/components/ui/Spinner';

export default function ClientPortalLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      router.replace('/login');
    } else if (user.role !== 'CLIENT') {
      router.replace('/dashboard');
    }
  }, [user, isLoading, router]);

  if (isLoading) return <PageLoader />;
  if (!user || user.role !== 'CLIENT') return null;

  return (
    <div className="min-h-screen bg-gray-50">
      <ClientPortalNavbar />
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-4 sm:py-8">{children}</main>
    </div>
  );
}
