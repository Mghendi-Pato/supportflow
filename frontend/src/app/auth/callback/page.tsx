'use client';
import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { HeadphonesIcon } from 'lucide-react';
import { Spinner } from '@/components/ui/Spinner';
import api from '@/lib/api';

export default function AuthCallbackPage() {
  const router       = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const accessToken  = searchParams.get('accessToken');
    const refreshToken = searchParams.get('refreshToken');
    const isNew        = searchParams.get('isNew') === '1';
    const error        = searchParams.get('error');

    if (error || !accessToken || !refreshToken) {
      router.replace('/login?error=google_failed');
      return;
    }

    // Store tokens
    localStorage.setItem('accessToken',  accessToken);
    localStorage.setItem('refreshToken', refreshToken);

    // Decode role + tenant from JWT payload
    try {
      const payload = JSON.parse(atob(accessToken.split('.')[1]));

      if (isNew || !payload.tenantId) {
        // New Google user with no workspace — send to registration to create one
        router.replace('/register?google=1');
        return;
      }

      // Existing user — fetch their profile then go to dashboard
      api.get('/auth/me').then((res) => {
        // Let AuthContext pick up from localStorage on next navigation
        router.replace('/');
      }).catch(() => {
        router.replace('/login?error=google_failed');
      });
    } catch {
      router.replace('/login?error=google_failed');
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4"
      style={{ background: 'linear-gradient(135deg, #eef2ff 0%, #e0e7ff 50%, #c7d2fe 100%)' }}
    >
      <div className="h-12 w-12 rounded-2xl bg-primary-600 flex items-center justify-center shadow-lg">
        <HeadphonesIcon size={22} className="text-white" />
      </div>
      <Spinner size="sm" />
      <p className="text-sm text-gray-500">Signing you in…</p>
    </div>
  );
}
