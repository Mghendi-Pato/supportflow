'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, X, ArrowLeft } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import api from '@/lib/api';

const PLANS = [
  {
    key: 'FREE' as const,
    label: 'Free',
    monthlyUsd: 0,
    yearlyUsd: 0,
    description: 'Perfect for freelancers just getting started.',
    cardStyle: { background: '#ffffff' },
    subTextClass: 'text-gray-400',
    priceClass: 'text-gray-900',
    featureClass: 'text-gray-700',
    unavailableClass: 'text-gray-300',
    checkClass: 'text-indigo-500',
    ringSelected: 'ring-indigo-400',
    ringIdle: 'ring-gray-200',
    features: [
      '1 agent',
      '1 client',
      '10 tickets / month',
      '5 MB file size limit',
      '1 file per ticket',
      'Basic ticket management',
      'Email support',
    ],
    unavailable: [
      'Analytics & reporting',
      'Live chat',
      'Email-to-ticket',
      'Billing requests',
      'Custom branding',
      'API access',
      'Advanced analytics',
      'Priority support',
    ],
  },
  {
    key: 'STANDARD' as const,
    label: 'Standard',
    monthlyUsd: 5,
    yearlyUsd: 50,
    description: 'For growing teams that need more power.',
    cardStyle: { background: 'linear-gradient(145deg, #dbeafe 0%, #ede9fe 60%, #fce7f3 100%)' },
    subTextClass: 'text-indigo-400',
    priceClass: 'text-indigo-900',
    featureClass: 'text-indigo-800',
    unavailableClass: 'text-indigo-300',
    checkClass: 'text-indigo-500',
    ringSelected: 'ring-indigo-500',
    ringIdle: 'ring-gray-200',
    features: [
      '5 agents',
      '3 clients',
      '50 tickets / month',
      '10 MB file size limit',
      '10 files per ticket',
      'Analytics & reporting',
      'Live chat',
      'Email-to-ticket',
      'Billing requests',
    ],
    unavailable: [
      'Custom branding',
      'API access',
      'Advanced analytics',
      'Priority support',
    ],
  },
  {
    key: 'PREMIUM' as const,
    label: 'Premium',
    monthlyUsd: 10,
    yearlyUsd: 100,
    description: 'Unlimited everything for serious operations.',
    cardStyle: { background: 'linear-gradient(160deg, #0d9488 0%, #0891b2 100%)' },
    subTextClass: 'text-teal-200',
    priceClass: 'text-white',
    featureClass: 'text-white',
    unavailableClass: 'text-teal-300/50',
    checkClass: 'text-teal-300',
    ringSelected: 'ring-teal-400',
    ringIdle: 'ring-gray-200',
    features: [
      'Unlimited agents',
      'Unlimited clients',
      'Unlimited tickets / month',
      '50 MB file size limit',
      '50 files per ticket',
      'Analytics & reporting',
      'Live chat',
      'Email-to-ticket',
      'Billing requests',
      'Custom branding',
      'API access',
      'Advanced analytics',
      'Priority support',
    ],
    unavailable: [],
  },
] as const;

type PlanKey = (typeof PLANS)[number]['key'];

export default function UpgradePage() {
  const router = useRouter();
  const { user } = useAuth();
  const currentPlan = ((user?.tenant as any)?.plan ?? 'FREE') as PlanKey;
  const [selected, setSelected] = useState<PlanKey>(currentPlan);
  const [yearly, setYearly] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const selectedPlan = PLANS.find((p) => p.key === selected)!;
  const price = yearly ? selectedPlan.yearlyUsd : selectedPlan.monthlyUsd;
  const period = yearly ? 'year' : 'month';

  const handleUpgrade = async () => {
    if (selected === currentPlan) return;
    if (selected === 'FREE') return;
    setLoading(true);
    setError('');
    try {
      const res = await api.post('/payments/initiate', {
        plan: selected,
        billingCycle: yearly ? 'YEARLY' : 'MONTHLY',
      });
      window.location.href = res.data.paymentUrl;
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Could not create payment link. Please try again.');
      setLoading(false);
    }
  };

  const ctaLabel = () => {
    if (loading) return 'Redirecting to payment…';
    if (selected === currentPlan) return 'This is your current plan';
    if (selected === 'FREE') return 'Downgrade not available here';
    return `Upgrade to ${selectedPlan.label} — $${price} / ${period}`;
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
      <p className="text-sm text-gray-500 mb-6">
        You&apos;re currently on the{' '}
        <span className="font-semibold text-gray-700">{currentPlan}</span> plan.
      </p>

      {/* Monthly / Yearly toggle */}
      <div className="flex items-center gap-3 mb-8">
        <span className={`text-sm font-medium transition-colors ${!yearly ? 'text-gray-900' : 'text-gray-400'}`}>
          Monthly
        </span>
        <button
          type="button"
          onClick={() => setYearly((v) => !v)}
          className={`relative w-11 h-6 rounded-full transition-colors duration-300 ${yearly ? 'bg-teal-500' : 'bg-gray-300'}`}
        >
          <span
            className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-300 ${yearly ? 'translate-x-5' : 'translate-x-0'}`}
          />
        </button>
        <span className={`text-sm font-medium transition-colors ${yearly ? 'text-gray-900' : 'text-gray-400'}`}>
          Yearly
        </span>
        {yearly && (
          <span className="text-[10px] font-bold uppercase tracking-wide bg-teal-100 text-teal-700 px-2 py-0.5 rounded-full">
            Save ~17%
          </span>
        )}
      </div>

      <div className="grid sm:grid-cols-3 gap-4 mb-8">
        {PLANS.map((plan) => {
          const planPrice = yearly ? plan.yearlyUsd : plan.monthlyUsd;
          const isSelected = selected === plan.key;
          const isCurrent = plan.key === currentPlan;
          return (
            <button
              key={plan.key}
              type="button"
              disabled={isCurrent}
              onClick={() => setSelected(plan.key)}
              className={`relative w-full text-left rounded-2xl ring-2 p-5 transition-all
                ${isSelected ? plan.ringSelected : plan.ringIdle}
                ${isCurrent ? 'opacity-70 cursor-default' : 'cursor-pointer hover:ring-gray-300'}`}
              style={plan.cardStyle as React.CSSProperties}
            >
              {isCurrent && (
                <span className="absolute -top-2.5 right-3 text-[10px] font-bold uppercase tracking-wide bg-gray-600 text-white px-2 py-0.5 rounded-full">
                  Current
                </span>
              )}

              <p className={`text-xs font-semibold mb-0.5 ${plan.subTextClass}`}>{plan.label} Plan</p>
              <div className="flex items-end gap-1 mb-1">
                <span className={`text-2xl font-bold leading-none ${plan.priceClass}`}>
                  {planPrice === 0 ? 'Free' : `$${planPrice}`}
                </span>
                {planPrice > 0 && (
                  <span className={`text-xs mb-0.5 ${plan.subTextClass}`}>/ {period}</span>
                )}
              </div>
              <p className={`text-[11px] mb-4 leading-relaxed ${plan.subTextClass}`}>{plan.description}</p>

              <ul className="space-y-1.5">
                {plan.features.map((f) => (
                  <li key={f} className={`flex items-start gap-2 text-xs ${plan.featureClass}`}>
                    <Check size={11} className={`mt-0.5 shrink-0 ${plan.checkClass}`} /> {f}
                  </li>
                ))}
                {plan.unavailable.map((f) => (
                  <li key={f} className={`flex items-start gap-2 text-xs ${plan.unavailableClass}`}>
                    <X size={10} className="mt-0.5 shrink-0 opacity-40" /> {f}
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
            : 'bg-indigo-600 hover:bg-indigo-700 text-white'
          }`}
      >
        {ctaLabel()}
      </button>
      <p className="text-xs text-center text-gray-400 mt-3">
        Payments are processed securely via Flutterwave.
        {yearly ? ' Your plan renews annually.' : ' Your plan renews monthly.'}
      </p>
    </div>
  );
}
