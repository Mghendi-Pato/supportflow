'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  HeadphonesIcon,
  Lock,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useNotify } from '@/hooks/useNotify';
import api from '@/lib/api';

const schema = z
  .object({
    password:        z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });
type FormData = z.infer<typeof schema>;

export default function ResetPasswordPage() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const notify       = useNotify();
  const token        = searchParams.get('token');

  const [showPassword,        setShowPassword]        = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [success,             setSuccess]             = useState(false);
  const [tokenError,          setTokenError]          = useState('');

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  // Guard: if no token in URL, show error immediately
  useEffect(() => {
    if (!token) {
      setTokenError('No reset token found. Please request a new password reset link.');
    }
  }, [token]);

  const onSubmit = async (data: FormData) => {
    try {
      await api.post('/auth/reset-password', { token, password: data.password });
      setSuccess(true);
      setTimeout(() => router.replace('/login'), 3000);
    } catch (err: any) {
      const msg: string =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        'Something went wrong. Please try again.';

      // Detect expiry message from backend
      if (msg.toLowerCase().includes('expired')) {
        setTokenError(msg);
      } else {
        notify.error(msg);
      }
    }
  };

  /* ── Token error state ── */
  if (tokenError) {
    return (
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center gap-2.5 mb-8">
          <div className="h-9 w-9 rounded-xl bg-primary-600 flex items-center justify-center">
            <HeadphonesIcon size={18} className="text-white" />
          </div>
          <span className="text-lg font-bold text-gray-900 tracking-tight">SupportFlow</span>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 flex flex-col items-center text-center">
          <div className="h-14 w-14 rounded-full bg-amber-100 flex items-center justify-center mb-4">
            <AlertTriangle size={28} className="text-amber-500" />
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Link expired</h1>
          <p className="text-sm text-gray-500 leading-relaxed mb-6">{tokenError}</p>
          <Link
            href="/forgot-password"
            className="inline-flex items-center justify-center px-5 py-2.5 bg-primary-600 text-white text-sm font-semibold rounded-xl hover:bg-primary-700 transition-colors"
          >
            Request a new reset link
          </Link>
          <Link href="/login" className="mt-4 text-sm text-gray-400 hover:text-gray-600 hover:underline">
            Back to login
          </Link>
        </div>
      </div>
    );
  }

  /* ── Success state ── */
  if (success) {
    return (
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center gap-2.5 mb-8">
          <div className="h-9 w-9 rounded-xl bg-primary-600 flex items-center justify-center">
            <HeadphonesIcon size={18} className="text-white" />
          </div>
          <span className="text-lg font-bold text-gray-900 tracking-tight">SupportFlow</span>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 flex flex-col items-center text-center">
          <div className="h-14 w-14 rounded-full bg-green-100 flex items-center justify-center mb-4">
            <CheckCircle2 size={28} className="text-green-600" />
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Password reset!</h1>
          <p className="text-sm text-gray-500 leading-relaxed mb-2">
            Your password has been updated successfully.
          </p>
          <p className="text-sm text-gray-400">Redirecting you to login…</p>
        </div>
      </div>
    );
  }

  /* ── Reset form ── */
  return (
    <div className="w-full max-w-md">
      <div className="flex items-center justify-center gap-2.5 mb-8">
        <div className="h-9 w-9 rounded-xl bg-primary-600 flex items-center justify-center">
          <HeadphonesIcon size={18} className="text-white" />
        </div>
        <span className="text-lg font-bold text-gray-900 tracking-tight">SupportFlow</span>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
        <div className="mb-6">
          <h1 className="text-xl font-bold text-gray-900 mb-1">Set a new password</h1>
          <p className="text-sm text-gray-400">Choose a strong password — at least 8 characters.</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* New password */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">New password</label>
            <div className="relative">
              <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••••••"
                autoFocus
                className={`w-full pl-10 pr-10 py-2.5 rounded-xl border text-sm bg-gray-50 text-gray-900 placeholder-gray-300 outline-none transition
                  ${errors.password ? 'border-red-400 focus:border-red-500' : 'border-gray-200 focus:border-primary-500 focus:bg-white'}`}
                {...register('password')}
              />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
            {errors.password?.message && (
              <p className="text-xs text-red-500 mt-1">{errors.password.message}</p>
            )}
          </div>

          {/* Confirm password */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Confirm password</label>
            <div className="relative">
              <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                placeholder="••••••••••••"
                className={`w-full pl-10 pr-10 py-2.5 rounded-xl border text-sm bg-gray-50 text-gray-900 placeholder-gray-300 outline-none transition
                  ${errors.confirmPassword ? 'border-red-400 focus:border-red-500' : 'border-gray-200 focus:border-primary-500 focus:bg-white'}`}
                {...register('confirmPassword')}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(v => !v)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                tabIndex={-1}
              >
                {showConfirmPassword ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
            {errors.confirmPassword?.message && (
              <p className="text-xs text-red-500 mt-1">{errors.confirmPassword.message}</p>
            )}
          </div>

          <Button type="submit" isLoading={isSubmitting} className="w-full" size="lg">
            Reset password
          </Button>
        </form>

        <p className="mt-5 text-center text-sm text-gray-400">
          <Link href="/login" className="text-primary-600 font-medium hover:underline">
            Back to login
          </Link>
        </p>
      </div>
    </div>
  );
}
