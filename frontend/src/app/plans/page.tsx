'use client';
import Link from 'next/link';
import { useState } from 'react';
import { CheckIcon, HeadphonesIcon, X } from 'lucide-react';

const PLANS = [
  {
    key: 'FREE',
    label: 'Free',
    monthlyUsd: 0,
    yearlyUsd: 0,
    description: 'Perfect for freelancers just getting started.',
    cardStyle: { background: '#ffffff' },
    textClass: 'text-gray-900',
    subTextClass: 'text-gray-400',
    priceClass: 'text-gray-900',
    featureClass: 'text-gray-700',
    unavailableClass: 'text-gray-300',
    checkClass: 'text-indigo-500',
    ctaClass: 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100',
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
    key: 'STANDARD',
    label: 'Standard',
    monthlyUsd: 5,
    yearlyUsd: 50,
    description: 'For growing teams that need more power.',
    cardStyle: { background: 'linear-gradient(145deg, #dbeafe 0%, #ede9fe 60%, #fce7f3 100%)' },
    textClass: 'text-indigo-900',
    subTextClass: 'text-indigo-400',
    priceClass: 'text-indigo-900',
    featureClass: 'text-indigo-800',
    unavailableClass: 'text-indigo-300',
    checkClass: 'text-indigo-500',
    ctaClass: 'bg-indigo-600 text-white hover:bg-indigo-700',
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
    key: 'PREMIUM',
    label: 'Premium',
    monthlyUsd: 10,
    yearlyUsd: 100,
    description: 'Unlimited everything for serious operations.',
    cardStyle: { background: 'linear-gradient(160deg, #0d9488 0%, #0891b2 100%)' },
    textClass: 'text-white',
    subTextClass: 'text-teal-200',
    priceClass: 'text-white',
    featureClass: 'text-white',
    unavailableClass: 'text-teal-300/50',
    checkClass: 'text-teal-300',
    ctaClass: 'bg-white text-teal-700 hover:bg-teal-50',
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

export default function PlansPage() {
  const [yearly, setYearly] = useState(false);

  return (
    <div className="min-h-screen bg-[#f0f2ff]">

      {/* ── Nav ── */}
      <nav className="flex items-center justify-between px-8 py-5 max-w-6xl mx-auto">
        <Link href="/" className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-indigo-600 flex items-center justify-center">
            <HeadphonesIcon size={16} className="text-white" />
          </div>
          <span className="font-bold text-indigo-900 tracking-tight">SupportFlow</span>
        </Link>
        <Link href="/login" className="text-sm font-medium text-indigo-700 hover:text-indigo-900 transition-colors">
          Sign in →
        </Link>
      </nav>

      {/* ── Hero ── */}
      <div
        className="relative overflow-hidden pt-14 pb-52"
        style={{ background: 'linear-gradient(135deg, #4338ca 0%, #5b21b6 50%, #6d28d9 100%)' }}
      >
        {/* Waves */}
        <svg className="absolute inset-0 w-full h-full opacity-20" viewBox="0 0 1440 320" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
          <path fill="none" stroke="white" strokeWidth="2"   d="M0,160 C180,60 360,260 540,160 C720,60 900,260 1080,160 C1260,60 1440,200 1440,160" />
          <path fill="none" stroke="white" strokeWidth="1.5" d="M0,200 C200,100 400,300 600,200 C800,100 1000,300 1200,200 C1350,130 1440,240 1440,200" />
          <path fill="none" stroke="white" strokeWidth="1"   d="M0,100 C240,20 480,220 720,100 C960,20 1200,200 1440,100" />
        </svg>

        <div className="relative text-center px-4">
          <h1 className="text-4xl sm:text-5xl font-bold text-white mb-3 tracking-tight">
            Pricing plans for everyone
          </h1>
          <p className="text-indigo-200 text-base">No surprise fees. Cancel anytime.</p>

          {/* Toggle */}
          <div className="inline-flex items-center gap-3 mt-8 bg-white/10 backdrop-blur px-5 py-2.5 rounded-full">
            <span className={`text-sm font-medium transition-colors ${!yearly ? 'text-white' : 'text-indigo-300'}`}>Monthly</span>
            <button
              type="button"
              onClick={() => setYearly(v => !v)}
              className={`relative w-11 h-6 rounded-full transition-colors duration-300 ${yearly ? 'bg-teal-400' : 'bg-white/30'}`}
            >
              <span className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-300 ${yearly ? 'translate-x-5' : 'translate-x-0'}`} />
            </button>
            <span className={`text-sm font-medium transition-colors ${yearly ? 'text-white' : 'text-indigo-300'}`}>Yearly</span>
            {yearly && (
              <span className="text-[10px] font-bold uppercase tracking-wide bg-teal-400 text-teal-900 px-2 py-0.5 rounded-full">Save ~17%</span>
            )}
          </div>
        </div>
      </div>

      {/* ── Cards ── */}
      <div className="relative max-w-5xl mx-auto px-4 -mt-36 pb-20">
        {/* items-stretch + h-full on inner flex makes all cards same height */}
        <div className="grid md:grid-cols-3 gap-6 items-stretch">
          {PLANS.map((plan) => {
            const price = yearly ? plan.yearlyUsd : plan.monthlyUsd;
            const period = yearly ? 'year' : 'month';

            return (
              <div
                key={plan.key}
                className="rounded-3xl p-6 shadow-lg flex flex-col"
                style={plan.cardStyle as React.CSSProperties}
              >
                {/* Plan name + description */}
                <p className={`text-sm font-semibold mb-1 ${plan.subTextClass}`}>{plan.label} Plan</p>

                {/* Price */}
                <div className="flex items-end gap-1 mb-1">
                  <span className={`text-4xl font-bold leading-none ${plan.priceClass}`}>
                    {price === 0 ? 'Free' : `$${price}`}
                  </span>
                  {price > 0 && (
                    <span className={`text-sm mb-1 ${plan.subTextClass}`}>/ {period}</span>
                  )}
                </div>
                {yearly && price > 0 && (
                  <p className={`text-xs mb-2 ${plan.subTextClass}`}>billed annually</p>
                )}

                <p className={`text-xs mb-5 leading-relaxed ${plan.subTextClass}`}>{plan.description}</p>

                {/* Features — flex-1 pushes CTA to bottom */}
                <ul className="space-y-2.5 mb-6 flex-1">
                  {plan.features.map((f) => (
                    <li key={f} className={`flex items-start gap-2.5 text-sm ${plan.featureClass}`}>
                      <CheckIcon size={14} className={`mt-0.5 shrink-0 ${plan.checkClass}`} />
                      {f}
                    </li>
                  ))}
                  {plan.unavailable.map((f) => (
                    <li key={f} className={`flex items-start gap-2.5 text-sm ${plan.unavailableClass}`}>
                      <X size={13} className="mt-0.5 shrink-0 opacity-40" />
                      {f}
                    </li>
                  ))}
                </ul>

                {/* CTA */}
                <Link
                  href={`/register?plan=${plan.key}`}
                  className={`w-full py-3 rounded-2xl font-bold text-sm text-center transition-colors ${plan.ctaClass}`}
                >
                  Choose Plan
                </Link>
              </div>
            );
          })}
        </div>

        <p className="text-center text-sm text-gray-400 mt-10">
          Already have an account?{' '}
          <Link href="/login" className="text-indigo-600 font-medium hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
