'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, Zap, Crown, Gift, ArrowLeft } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import api from '@/lib/api';

const PLANS = [
  {
    key: 'FREE' as const,
    label: 'Free',
    price: 'KES 0',
    period: '/month',
    icon: Gift,
    ringClass: 'ring-gray-200',
    selectedClass: 'ring-primary-500 bg-primary-50',
    badge: null,
    features: ['1 agent', '1 client', '10 tickets/month', '5 MB per file'],
    locked: ['Analytics', 'Live chat', 'Email-to-ticket', 'Billing'],
  },
  {
    key: 'STANDARD' as const,
    label: 'Standard',
    price: 'KES 2,500',
    period: '/month',
    icon: Zap,
    ringClass: 'ring-gray-200',
    selectedClass: 'ring-primary-500 bg-primary-50',
    badge: 'Popular',
    features: ['5 agents', '3 clients', '50 tickets/month', '10 MB per file', 'Analytics', 'Live chat', 'Email-to-ticket', 'Billing'],
    locked: ['Custom branding', 'API access', 'Priority support'],
  },
  {
    key: 'PREMIUM' as const,
    label: 'Premium',
    price: 'KES 7,500',
    period: '/month',
    icon: Crown,
    ringClass: 'ring-gray-200',
    selectedClass: 'ring-amber-400 bg-amber-50',
    badge: 'Best value',
    features: ['Unlimited agents & clients', 'Unlimited tickets', '50 MB per file', 'All features', 'Custom branding', 'API access', 'Advanced analytics', 'Priority support'],
    locked: [],
  },
] as const;
type PlanKey = (typeof PLANS)[number]['key'];

export default function UpgradePage() {
  const router = useRouter();
  const { user } = useAuth();
  const currentPlan = ((user?.tenant as any)?.plan ?? 'FREE') as PlanKey;
  const [selected, setSelected] = useState<PlanKey>(currentPlan);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleUpgrade = async () => {
    if (selected === currentPlan) return;
    if (selected === 'FREE') return; // Downgrade not yet supported
    setLoading(true);
    setError('');
    try {
      const res = await api.post('/payments/initiate', { plan: selected });
      window.location.href = res.data.paymentUrl;
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Could not create payment link. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
      <button
        onClick={() => router.back()}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-6 transition-colors"
      >
        <ArrowLeft size={14} /> Back
      </button>

      <h1 className="text-2xl font-bold text-gray-900 mb-1">Upgrade your plan</h1>
      <p className="text-sm text-gray-500 mb-8">
        You're currently on the <span className="font-semibold text-gray-700">{currentPlan}</span> plan. Choose a new plan below.
      </p>

      <div className="grid sm:grid-cols-3 gap-4 mb-8">
        {PLANS.map((plan) => {
          const Icon = plan.icon;
          const isSelected = selected === plan.key;
          const isCurrent = plan.key === currentPlan;
          return (
            <button
              key={plan.key}
              type="button"
              disabled={isCurrent}
              onClick={() => setSelected(plan.key)}
              className={`relative w-full text-left rounded-2xl ring-2 p-5 transition-all
                ${isSelected ? plan.selectedClass : 'ring-gray-200 bg-white hover:ring-gray-300'}
                ${isCurrent ? 'opacity-70 cursor-default' : 'cursor-pointer'}`}
            >
              {plan.badge && (
                <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 text-[10px] font-bold uppercase tracking-wide bg-primary-600 text-white px-2.5 py-0.5 rounded-full whitespace-nowrap">
                  {plan.badge}
                </span>
              )}
              {isCurrent && (
                <span className="absolute -top-2.5 right-3 text-[10px] font-bold uppercase tracking-wide bg-gray-600 text-white px-2 py-0.5 rounded-full">
                  Current
                </span>
              )}

              <div className="flex items-center gap-3 mb-3">
                <div className={`h-9 w-9 rounded-xl flex items-center justify-center ${isSelected ? 'bg-primary-600' : 'bg-gray-100'}`}>
                  <Icon size={17} className={isSelected ? 'text-white' : 'text-gray-500'} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">{plan.label}</p>
                  <p className="text-xs text-gray-500">{plan.price}<span className="text-gray-400">{plan.period}</span></p>
                </div>
              </div>

              <ul className="space-y-1.5">
                {plan.features.map(f => (
                  <li key={f} className="flex items-center gap-2 text-xs text-gray-600">
                    <CheckCircle2 size={11} className="text-green-500 shrink-0" /> {f}
                  </li>
                ))}
                {plan.locked.map(f => (
                  <li key={f} className="flex items-center gap-2 text-xs text-gray-400">
                    <div className="h-2.5 w-2.5 rounded-full border border-gray-300 shrink-0" /> {f}
                  </li>
                ))}
              </ul>
            </button>
          );
        })}
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 mb-4">
          {error}
        </div>
      )}

      <button
        onClick={handleUpgrade}
        disabled={selected === currentPlan || selected === 'FREE' || loading}
        className={`w-full py-3 rounded-xl font-semibold text-sm transition-colors
          ${selected === currentPlan || selected === 'FREE'
            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
            : 'bg-primary-600 hover:bg-primary-700 text-white'
          }`}
      >
        {loading
          ? 'Redirecting to payment…'
          : selected === currentPlan
          ? 'This is your current plan'
          : selected === 'FREE'
          ? 'Downgrade not available here'
          : `Upgrade to ${PLANS.find(p => p.key === selected)?.label} — ${PLANS.find(p => p.key === selected)?.price}/month`}
      </button>
      <p className="text-xs text-center text-gray-400 mt-3">
        Payments are processed securely via Flutterwave. Your plan renews monthly.
      </p>
    </div>
  );
}
