'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  HeadphonesIcon,
  Eye, EyeOff,
  AlertTriangle,
  ArrowLeft,
  Gift, Zap, Crown,
  CheckCircle2,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import api from '@/lib/api';
import { Button } from '@/components/ui/Button';

/* ── Plan display info ── */
const PLAN_META = {
  FREE:     { label: 'Free',     icon: Gift,  price: 'KES 0 / month',     chipClass: 'bg-gray-100 text-gray-700'        },
  STANDARD: { label: 'Standard', icon: Zap,   price: 'KES 2,500 / month', chipClass: 'bg-primary-100 text-primary-700'  },
  PREMIUM:  { label: 'Premium',  icon: Crown, price: 'KES 7,500 / month', chipClass: 'bg-amber-100 text-amber-700'       },
} as const;
type PlanKey = keyof typeof PLAN_META;

/* ── Inline plan picker (shown when user taps "Change") ── */
const PLANS = [
  { key: 'FREE'     as const, label: 'Free',     price: 'KES 0 / mo',     icon: Gift  },
  { key: 'STANDARD' as const, label: 'Standard', price: 'KES 2,500 / mo', icon: Zap   },
  { key: 'PREMIUM'  as const, label: 'Premium',  price: 'KES 7,500 / mo', icon: Crown },
];

/* ── Form schema ── */
const schema = z.object({
  firstName:     z.string().min(2, 'First name required'),
  lastName:      z.string().min(2, 'Last name required'),
  password:      z.string().min(8, 'At least 8 characters'),
  workspaceName: z.string().min(2, 'Workspace name required'),
  workspaceSlug: z
    .string()
    .min(2, 'Slug required')
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Lowercase letters, numbers and hyphens only'),
});
type FormData = z.infer<typeof schema>;

export default function CompleteRegistrationPage() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const token        = searchParams.get('token') ?? '';
  const isGoogle     = searchParams.get('google') === '1';
  const { login }    = useAuth();

  const [tokenState,    setTokenState]    = useState<'loading' | 'valid' | 'invalid'>('loading');
  const [email,         setEmail]         = useState('');
  const [selectedPlan,  setSelectedPlan]  = useState<PlanKey>('FREE');
  const [showPicker,    setShowPicker]    = useState(false);
  const [showPassword,  setShowPassword]  = useState(false);
  const [serverError,   setServerError]   = useState('');

  const { register, handleSubmit, formState: { errors, isSubmitting }, setValue } =
    useForm<FormData>({ resolver: zodResolver(schema) });

  /* Validate token on mount */
  useEffect(() => {
    if (isGoogle) { setTokenState('valid'); return; }
    if (!token)   { setTokenState('invalid'); return; }

    api.get(`/auth/verify-registration/${token}`)
      .then((res) => {
        setEmail(res.data.email);
        if (['FREE', 'STANDARD', 'PREMIUM'].includes(res.data.plan)) {
          setSelectedPlan(res.data.plan as PlanKey);
        }
        setTokenState('valid');
      })
      .catch(() => setTokenState('invalid'));
  }, [token, isGoogle]); // eslint-disable-line

  /* Auto-slug from workspace name */
  const handleWorkspaceName = (e: React.ChangeEvent<HTMLInputElement>) => {
    const slug = e.target.value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    setValue('workspaceSlug', slug, { shouldValidate: true });
  };

  /* Submit */
  const onSubmit = async (data: FormData) => {
    setServerError('');
    try {
      const res = await api.post('/auth/register/complete', {
        token,
        ...data,
        plan: selectedPlan,
      });

      if (res.data.requiresPayment) {
        localStorage.setItem('accessToken',  res.data.accessToken);
        localStorage.setItem('refreshToken', res.data.refreshToken);
        const payRes = await api.post('/payments/initiate', { plan: selectedPlan }, {
          headers: { Authorization: `Bearer ${res.data.accessToken}` },
        });
        window.location.href = payRes.data.paymentUrl;
      } else {
        await login(email, data.password);
        router.replace('/');
      }
    } catch (err: any) {
      setServerError(err?.response?.data?.message || 'Something went wrong. Please try again.');
    }
  };

  /* ── Loading ── */
  if (tokenState === 'loading') {
    return (
      <div className="w-full max-w-md flex flex-col items-center py-16 gap-4">
        <div className="h-10 w-10 rounded-2xl bg-primary-600 flex items-center justify-center">
          <HeadphonesIcon size={20} className="text-white" />
        </div>
        <p className="text-sm text-gray-400 animate-pulse">Verifying your link…</p>
      </div>
    );
  }

  /* ── Invalid / expired ── */
  if (tokenState === 'invalid') {
    return (
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-10 text-center">
          <div className="inline-flex items-center justify-center h-14 w-14 rounded-full bg-amber-100 mb-5">
            <AlertTriangle size={28} className="text-amber-600" />
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Link expired or invalid</h1>
          <p className="text-sm text-gray-500 mb-6">
            This verification link has expired or has already been used. Please start the registration process again.
          </p>
          <Link
            href="/plans"
            className="inline-flex items-center gap-2 text-sm font-medium text-primary-600 hover:underline"
          >
            <ArrowLeft size={14} /> Back to plans
          </Link>
        </div>
      </div>
    );
  }

  /* ── Form ── */
  const planMeta = PLAN_META[selectedPlan];
  const PlanIcon = planMeta.icon;

  return (
    <div className="w-full max-w-lg">
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center h-12 w-12 rounded-2xl bg-primary-600 mb-4">
          <HeadphonesIcon size={24} className="text-white" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900">Set up your workspace</h1>
        {email && (
          <p className="text-sm text-gray-500 mt-1">Creating account for <span className="font-medium text-gray-700">{email}</span></p>
        )}
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
        {/* Plan chip */}
        <div className="mb-5">
          <div className={`inline-flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-full ${planMeta.chipClass}`}>
            <PlanIcon size={12} />
            {planMeta.label} — {planMeta.price}
          </div>
          <button
            type="button"
            className="ml-2 text-xs text-gray-400 hover:text-primary-600 underline transition-colors"
            onClick={() => setShowPicker(v => !v)}
          >
            {showPicker ? 'Close' : 'Change plan'}
          </button>

          {/* Inline plan picker */}
          {showPicker && (
            <div className="mt-3 grid grid-cols-3 gap-2">
              {PLANS.map((p) => {
                const PIcon = p.icon;
                const active = selectedPlan === p.key;
                return (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => { setSelectedPlan(p.key); setShowPicker(false); }}
                    className={`p-3 rounded-xl border-2 text-left transition-all ${
                      active
                        ? 'border-primary-500 bg-primary-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <PIcon size={14} className={active ? 'text-primary-600' : 'text-gray-400'} />
                    <p className="text-xs font-semibold text-gray-800 mt-1">{p.label}</p>
                    <p className="text-[10px] text-gray-500">{p.price}</p>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">First name</label>
              <input
                placeholder="Patrick"
                className={`w-full px-3.5 py-2.5 rounded-xl border text-sm bg-gray-50 text-gray-900 placeholder-gray-300 outline-none transition
                  ${errors.firstName ? 'border-red-400' : 'border-gray-200 focus:border-primary-500 focus:bg-white'}`}
                {...register('firstName')}
              />
              {errors.firstName?.message && <p className="text-xs text-red-500 mt-1">{errors.firstName.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Last name</label>
              <input
                placeholder="Mwamburi"
                className={`w-full px-3.5 py-2.5 rounded-xl border text-sm bg-gray-50 text-gray-900 placeholder-gray-300 outline-none transition
                  ${errors.lastName ? 'border-red-400' : 'border-gray-200 focus:border-primary-500 focus:bg-white'}`}
                {...register('lastName')}
              />
              {errors.lastName?.message && <p className="text-xs text-red-500 mt-1">{errors.lastName.message}</p>}
            </div>
          </div>

          {!isGoogle && (
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Min. 8 characters"
                  className={`w-full pl-3.5 pr-10 py-2.5 rounded-xl border text-sm bg-gray-50 text-gray-900 placeholder-gray-300 outline-none transition
                    ${errors.password ? 'border-red-400' : 'border-gray-200 focus:border-primary-500 focus:bg-white'}`}
                  {...register('password')}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              {errors.password?.message && <p className="text-xs text-red-500 mt-1">{errors.password.message}</p>}
            </div>
          )}

          <div className="border-t border-gray-100 pt-4">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Workspace</p>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Workspace name</label>
                <input
                  placeholder="My Agency"
                  className={`w-full px-3.5 py-2.5 rounded-xl border text-sm bg-gray-50 text-gray-900 placeholder-gray-300 outline-none transition
                    ${errors.workspaceName ? 'border-red-400' : 'border-gray-200 focus:border-primary-500 focus:bg-white'}`}
                  {...register('workspaceName', { onChange: handleWorkspaceName })}
                />
                {errors.workspaceName?.message && <p className="text-xs text-red-500 mt-1">{errors.workspaceName.message}</p>}
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Workspace URL</label>
                <div className="flex items-center">
                  <span className="px-3.5 py-2.5 rounded-l-xl border border-r-0 border-gray-200 bg-gray-100 text-xs text-gray-400 whitespace-nowrap">
                    supportflow.app/
                  </span>
                  <input
                    placeholder="my-agency"
                    className={`flex-1 px-3.5 py-2.5 rounded-r-xl border text-sm bg-gray-50 text-gray-900 placeholder-gray-300 outline-none transition
                      ${errors.workspaceSlug ? 'border-red-400' : 'border-gray-200 focus:border-primary-500 focus:bg-white'}`}
                    {...register('workspaceSlug')}
                  />
                </div>
                {errors.workspaceSlug?.message && <p className="text-xs text-red-500 mt-1">{errors.workspaceSlug.message}</p>}
              </div>
            </div>
          </div>

          {serverError && (
            <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              {serverError}
            </div>
          )}

          <Button type="submit" isLoading={isSubmitting} className="w-full" size="lg">
            {selectedPlan === 'FREE'
              ? 'Create workspace'
              : `Create workspace & pay ${planMeta.price}`}
          </Button>
        </form>

        <p className="mt-5 text-center text-sm text-gray-400">
          Already have an account?{' '}
          <Link href="/login" className="text-primary-600 font-medium hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
