'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  HeadphonesIcon,
  Mail,
  CheckCircle2,
  ArrowLeft,
  Gift,
  Zap,
  Crown,
} from 'lucide-react';
import api from '@/lib/api';
import { Button } from '@/components/ui/Button';

const PLAN_META = {
  FREE:     { label: 'Free',     icon: Gift,  price: 'KES 0 / month',     color: 'bg-gray-100 text-gray-700'           },
  STANDARD: { label: 'Standard', icon: Zap,   price: 'KES 2,500 / month', color: 'bg-primary-100 text-primary-700'     },
  PREMIUM:  { label: 'Premium',  icon: Crown, price: 'KES 7,500 / month', color: 'bg-amber-100 text-amber-700'          },
} as const;
type PlanKey = keyof typeof PLAN_META;

const schema = z.object({
  email: z.string().email('Enter a valid email address'),
});
type FormData = z.infer<typeof schema>;

export default function RegisterPage() {
  const searchParams = useSearchParams();
  const plan = (searchParams.get('plan') as PlanKey) || 'FREE';
  const planMeta = PLAN_META[plan] ?? PLAN_META.FREE;
  const PlanIcon = planMeta.icon;

  const [sent, setSent]               = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormData) => {
    // Pass the chosen plan so the backend stores it in metadata
    await api.post('/auth/pre-register', { email: data.email, plan });
    setSubmittedEmail(data.email);
    setSent(true);
  };

  if (sent) {
    return (
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-10 text-center">
          <div className="inline-flex items-center justify-center h-14 w-14 rounded-full bg-green-100 mb-5">
            <CheckCircle2 size={28} className="text-green-600" />
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Check your email</h1>
          <p className="text-sm text-gray-500 mb-1">We sent a verification link to</p>
          <p className="text-sm font-semibold text-gray-800 mb-6">{submittedEmail}</p>
          <p className="text-xs text-gray-400">
            The link expires in 24 hours. Didn't receive it?{' '}
            <button
              type="button"
              className="text-primary-600 font-medium hover:underline"
              onClick={() => setSent(false)}
            >
              Try again
            </button>
          </p>
        </div>
        <p className="mt-6 text-center text-sm text-gray-500">
          Already have an account?{' '}
          <Link href="/login" className="text-primary-600 font-medium hover:underline">Sign in</Link>
        </p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md">
      {/* Brand */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center h-12 w-12 rounded-2xl bg-primary-600 mb-4">
          <HeadphonesIcon size={24} className="text-white" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900">Create your workspace</h1>
        <p className="text-sm text-gray-500 mt-1">
          Enter your email and we'll send you a verification link.
        </p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
        {/* Selected plan chip */}
        <div className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full mb-5 ${planMeta.color}`}>
          <PlanIcon size={12} />
          {planMeta.label} plan — {planMeta.price}
          <Link href="/plans" className="ml-1 underline opacity-70 hover:opacity-100 font-normal">
            Change
          </Link>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              Email address
            </label>
            <div className="relative">
              <Mail
                size={15}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
              />
              <input
                type="email"
                placeholder="you@example.com"
                className={`w-full pl-10 pr-4 py-2.5 rounded-xl border text-sm bg-gray-50 text-gray-900 placeholder-gray-300 outline-none transition
                  ${errors.email
                    ? 'border-red-400 focus:border-red-500'
                    : 'border-gray-200 focus:border-primary-500 focus:bg-white'
                  }`}
                {...register('email')}
              />
            </div>
            {errors.email?.message && (
              <p className="text-xs text-red-500 mt-1">{errors.email.message}</p>
            )}
          </div>

          <Button type="submit" isLoading={isSubmitting} className="w-full" size="lg">
            Send verification link
          </Button>
        </form>

        <p className="mt-5 text-center text-sm text-gray-400">
          Already have an account?{' '}
          <Link href="/login" className="text-primary-600 font-medium hover:underline">Sign in</Link>
        </p>
      </div>

      <div className="mt-4 text-center">
        <Link
          href="/plans"
          className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors"
        >
          <ArrowLeft size={12} /> Back to plans
        </Link>
      </div>
    </div>
  );
}
