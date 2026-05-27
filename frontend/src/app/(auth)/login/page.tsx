'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { HeadphonesIcon, CheckCircle2, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useNotify } from '@/hooks/useNotify';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';

const schema = z.object({
  email:    z.string().email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
});
type FormData = z.infer<typeof schema>;

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isNewAccount = searchParams.get('welcome') === '1';
  const { login } = useAuth();
  const notify = useNotify();
  const [serverError, setServerError]   = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormData) => {
    setServerError('');
    try {
      await login(data.email, data.password);
      notify.success('Welcome back!');
      router.replace('/');
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Invalid email or password';
      setServerError(msg);
      notify.error(msg);
    }
  };

  return (
    <div className="w-full max-w-md">
      {/* Logo */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center h-12 w-12 rounded-2xl bg-primary-600 mb-4">
          <HeadphonesIcon size={24} className="text-white" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900">Sign in to SupportFlow</h1>
        <p className="text-sm text-gray-500 mt-1">
          {isNewAccount ? 'Your account is ready — sign in to get started.' : 'Welcome back! Please enter your details.'}
        </p>
      </div>

      {isNewAccount && (
        <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-xl px-4 py-3 mb-6">
          <CheckCircle2 size={18} className="text-green-600 flex-shrink-0" />
          <p className="text-sm text-green-800 font-medium">Account created successfully! Sign in with your new credentials.</p>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <Input
            label="Email address"
            type="email"
            placeholder="you@example.com"
            error={errors.email?.message}
            {...register('email')}
          />

          {/* Password with visibility toggle */}
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">Password</label>
            <div className="relative">
              <Input
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                error={errors.password?.message}
                className="pr-10"
                {...register('password')}
              />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                tabIndex={-1}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {errors.password?.message && (
              <p className="text-xs text-red-600">{errors.password.message}</p>
            )}
          </div>

          {serverError && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              {serverError}
            </div>
          )}

          <Button type="submit" isLoading={isSubmitting} className="w-full" size="lg">
            Sign in
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-500">
          Don&apos;t have an account?{' '}
          <Link href="/register" className="text-primary-600 font-medium hover:underline">
            Create workspace
          </Link>
        </p>
      </div>
    </div>
  );
}
