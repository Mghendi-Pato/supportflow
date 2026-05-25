'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { HeadphonesIcon } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import api from '@/lib/api';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';

const schema = z.object({
  firstName:     z.string().min(1, 'First name required'),
  lastName:      z.string().min(1, 'Last name required'),
  email:         z.string().email('Enter a valid email'),
  password:      z.string().min(8, 'Password must be at least 8 characters'),
  workspaceName: z.string().min(2, 'Workspace name required'),
  workspaceSlug: z
    .string()
    .min(2, 'Slug required')
    .regex(/^[a-z0-9-]+$/, 'Only lowercase letters, numbers and hyphens'),
});
type FormData = z.infer<typeof schema>;

export default function RegisterPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [serverError, setServerError] = useState('');

  const {
    register, handleSubmit,
    formState: { errors, isSubmitting },
    watch, setValue,
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  // Auto-generate slug from workspace name
  const handleWorkspaceName = (e: React.ChangeEvent<HTMLInputElement>) => {
    const slug = e.target.value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    setValue('workspaceSlug', slug, { shouldValidate: true });
  };

  const onSubmit = async (data: FormData) => {
    setServerError('');
    try {
      await api.post('/auth/register', data);
      await login(data.email, data.password);
      router.replace('/dashboard');
    } catch (err: any) {
      setServerError(err?.response?.data?.message || 'Registration failed. Please try again.');
    }
  };

  return (
    <div className="w-full max-w-lg">
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center h-12 w-12 rounded-2xl bg-primary-600 mb-4">
          <HeadphonesIcon size={24} className="text-white" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900">Create your workspace</h1>
        <p className="text-sm text-gray-500 mt-1">Set up your SupportFlow account in seconds.</p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="First name"
              placeholder="Patrick"
              error={errors.firstName?.message}
              {...register('firstName')}
            />
            <Input
              label="Last name"
              placeholder="Mwamburi"
              error={errors.lastName?.message}
              {...register('lastName')}
            />
          </div>

          <Input
            label="Email address"
            type="email"
            placeholder="you@example.com"
            error={errors.email?.message}
            {...register('email')}
          />

          <Input
            label="Password"
            type="password"
            placeholder="Min. 8 characters"
            error={errors.password?.message}
            {...register('password')}
          />

          <div className="border-t border-gray-100 pt-5">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">
              Workspace details
            </p>
            <div className="space-y-4">
              <Input
                label="Workspace name"
                placeholder="My Agency"
                error={errors.workspaceName?.message}
                {...register('workspaceName', { onChange: handleWorkspaceName })}
              />
              <Input
                label="Workspace slug"
                placeholder="my-agency"
                hint="Used in URLs — only lowercase letters, numbers, hyphens"
                error={errors.workspaceSlug?.message}
                {...register('workspaceSlug')}
              />
            </div>
          </div>

          {serverError && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              {serverError}
            </div>
          )}

          <Button type="submit" isLoading={isSubmitting} className="w-full" size="lg">
            Create workspace
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-500">
          Already have an account?{' '}
          <Link href="/login" className="text-primary-600 font-medium hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
