'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';

export default function HomePage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      router.replace('/login');
    } else if (user.role === 'CLIENT') {
      router.replace('/portal');
    } else {
      router.replace('/dashboard');
    }
  }, [user, isLoading, router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
    </div>
  );
}
