'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { HeadphonesIcon, Mail, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import api from '@/lib/api';

const schema = z.object({
  email: z.string().email('Enter a valid email address'),
});
type FormData = z.infer<typeof schema>;

export default function ForgotPasswordPage() {
  const [submitted, setSubmitted] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState('');

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormData) => {
    // Always show success — backend never reveals whether the email exists
    await api.post('/auth/forgot-password', { email: data.email }).catch(() => {});
    setSubmittedEmail(data.email);
    setSubmitted(true);
  };

  return (
    <div className="w-full max-w-md">
      {/* Brand */}
      <div className="flex items-center justify-center gap-2.5 mb-8">
        <div className="h-9 w-9 rounded-xl bg-primary-600 flex items-center justify-center">
          <HeadphonesIcon size={18} className="text-white" />
        </div>
        <span className="text-lg font-bold text-gray-900 tracking-tight">SupportFlow</span>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
        {submitted ? (
          /* ── Success state ── */
          <div className="flex flex-col items-center text-center">
            <div className="h-14 w-14 rounded-full bg-green-100 flex items-center justify-center mb-4">
              <CheckCircle2 size={28} className="text-green-600" />
            </div>
            <h1 className="text-xl font-bold text-gray-900 mb-2">Check your email</h1>
            <p className="text-sm text-gray-500 leading-relaxed mb-1">
              If an account exists for{' '}
              <span className="font-medium text-gray-700">{submittedEmail}</span>,
              we've sent a password reset link.
            </p>
            <p className="text-sm text-gray-400 leading-relaxed mb-6">
              The link will expire in <strong className="text-gray-600">30 minutes</strong>.
              Check your spam folder if you don't see it.
            </p>
            <Link
              href="/login"
              className="text-sm text-primary-600 font-medium hover:underline flex items-center gap-1.5"
            >
              <ArrowLeft size={14} />
              Back to login
            </Link>
          </div>
        ) : (
          /* ── Request form ── */
          <>
            <div className="mb-6">
              <h1 className="text-xl font-bold text-gray-900 mb-1">Forgot your password?</h1>
              <p className="text-sm text-gray-400">
                Enter the email associated with your account and we'll send you a reset link.
              </p>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Email address</label>
                <div className="relative">
                  <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  <input
                    type="email"
                    placeholder="you@example.com"
                    autoFocus
                    className={`w-full pl-10 pr-4 py-2.5 rounded-xl border text-sm bg-gray-50 text-gray-900 placeholder-gray-300 outline-none transition
                      ${errors.email ? 'border-red-400 focus:border-red-500' : 'border-gray-200 focus:border-primary-500 focus:bg-white'}`}
                    {...register('email')}
                  />
                </div>
                {errors.email?.message && (
                  <p className="text-xs text-red-500 mt-1">{errors.email.message}</p>
                )}
              </div>

              <Button type="submit" isLoading={isSubmitting} className="w-full" size="lg">
                Send reset link
              </Button>
            </form>

            <p className="mt-5 text-center text-sm text-gray-400">
              Remembered it?{' '}
              <Link href="/login" className="text-primary-600 font-medium hover:underline">
                Back to login
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
