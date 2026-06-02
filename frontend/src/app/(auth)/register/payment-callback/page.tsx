'use client';
import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { HeadphonesIcon, CheckCircle2, AlertTriangle } from 'lucide-react';
import { Spinner } from '@/components/ui/Spinner';
import api from '@/lib/api';
import Link from 'next/link';

export default function PaymentCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [state, setState] = useState<'verifying' | 'success' | 'failed'>('verifying');
  const [planName, setPlanName] = useState('');

  useEffect(() => {
    const transactionId = searchParams.get('transaction_id');
    const status = searchParams.get('status');

    if (status === 'cancelled' || !transactionId) {
      setState('failed');
      return;
    }

    api.get(`/payments/verify/${transactionId}`)
      .then((res) => {
        setPlanName(res.data.tenant?.plan ?? '');
        setState('success');
        // Redirect to dashboard after 2 s
        setTimeout(() => router.replace('/'), 2000);
      })
      .catch(() => setState('failed'));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center gap-6 px-4"
      style={{ background: 'linear-gradient(135deg, #eef2ff 0%, #e0e7ff 50%, #c7d2fe 100%)' }}
    >
      <div className="h-12 w-12 rounded-2xl bg-primary-600 flex items-center justify-center shadow-lg">
        <HeadphonesIcon size={22} className="text-white" />
      </div>

      {state === 'verifying' && (
        <>
          <Spinner size="sm" />
          <p className="text-sm text-gray-500">Confirming your payment…</p>
        </>
      )}

      {state === 'success' && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-10 text-center max-w-sm w-full">
          <div className="inline-flex items-center justify-center h-14 w-14 rounded-full bg-green-100 mb-5">
            <CheckCircle2 size={28} className="text-green-600" />
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Payment successful!</h1>
          <p className="text-sm text-gray-500 mb-1">
            Your workspace has been upgraded to
          </p>
          <p className="text-base font-bold text-primary-600 mb-4">{planName}</p>
          <p className="text-xs text-gray-400">Redirecting you to your dashboard…</p>
        </div>
      )}

      {state === 'failed' && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-10 text-center max-w-sm w-full">
          <div className="inline-flex items-center justify-center h-14 w-14 rounded-full bg-amber-100 mb-5">
            <AlertTriangle size={28} className="text-amber-600" />
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Payment not confirmed</h1>
          <p className="text-sm text-gray-500 mb-6">
            We couldn't confirm your payment. Your workspace has been created on the Free plan. If you were charged, please contact support.
          </p>
          <Link
            href="/"
            className="inline-block bg-primary-600 text-white text-sm font-semibold px-6 py-2.5 rounded-xl hover:bg-primary-700 transition-colors"
          >
            Go to dashboard
          </Link>
        </div>
      )}
    </div>
  );
}
