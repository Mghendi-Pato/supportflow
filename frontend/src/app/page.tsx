'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import {
  HeadphonesIcon,
  Check,
  X,
  Menu,
  ArrowRight,
  ChevronRight,
  MessageSquare,
  Bell,
  Users,
  BarChart3,
  Shield,
  CheckCircle2,
  Star,
  Paperclip,
  Ticket,
  Zap,
  AlertCircle,
  Eye,
  Activity,
} from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// NAVBAR
// ─────────────────────────────────────────────────────────────────────────────

function Navbar({ scrolled }: { scrolled: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <nav
      className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'bg-white/95 backdrop-blur-sm border-b border-gray-100 shadow-sm'
          : 'bg-transparent'
      }`}
    >
      <div className="max-w-6xl mx-auto px-5 sm:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-xl bg-gray-950 flex items-center justify-center">
              <HeadphonesIcon size={15} className="text-white" />
            </div>
            <span className="font-black text-gray-950 text-lg tracking-tight">
              SupportFlow
            </span>
          </div>

          <div className="hidden md:flex items-center gap-8">
            {[
              ['#how-it-works', 'How it works'],
              ['#features', 'Features'],
              ['#pricing', 'Pricing'],
            ].map(([href, label]) => (
              <a
                key={href}
                href={href}
                className="text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors"
              >
                {label}
              </a>
            ))}
          </div>

          <div className="hidden md:flex items-center gap-3">
            <Link
              href="/login"
              className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors px-3 py-2"
            >
              Sign in
            </Link>
            <Link
              href="/register"
              className="text-sm font-bold bg-gray-950 hover:bg-gray-800 text-white px-5 py-2.5 rounded-xl transition-colors"
            >
              Start free
            </Link>
          </div>

          <button
            onClick={() => setOpen((v) => !v)}
            className="md:hidden p-2 text-gray-700"
          >
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {open && (
        <div className="md:hidden bg-white border-t border-gray-100 px-5 py-5 space-y-4">
          {[
            ['#how-it-works', 'How it works'],
            ['#features', 'Features'],
            ['#pricing', 'Pricing'],
          ].map(([href, label]) => (
            <a
              key={href}
              href={href}
              onClick={() => setOpen(false)}
              className="block text-sm font-medium text-gray-700"
            >
              {label}
            </a>
          ))}
          <div className="pt-3 flex flex-col gap-2 border-t border-gray-100">
            <Link
              href="/login"
              className="text-sm text-center font-medium text-gray-700 py-2"
            >
              Sign in
            </Link>
            <Link
              href="/register"
              className="text-sm font-bold bg-gray-950 text-white text-center py-3 rounded-xl"
            >
              Start free
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FLOATING HERO ICONS
// ─────────────────────────────────────────────────────────────────────────────

function FloatingIcons() {
  return (
    <>
      <style>{`
        @keyframes fi-a{0%,100%{transform:translateY(0px) rotate(-10deg)}50%{transform:translateY(-14px) rotate(-10deg)}}
        @keyframes fi-b{0%,100%{transform:translateY(0px) rotate(8deg)}50%{transform:translateY(-12px) rotate(8deg)}}
        @keyframes fi-c{0%,100%{transform:translateY(0px) rotate(-6deg)}50%{transform:translateY(-16px) rotate(-6deg)}}
        @keyframes fi-d{0%,100%{transform:translateY(0px) rotate(13deg)}50%{transform:translateY(-10px) rotate(13deg)}}
        @keyframes fi-e{0%,100%{transform:translateY(0px) rotate(0deg)}50%{transform:translateY(-13px) rotate(0deg)}}
      `}</style>
      <div
        className="absolute inset-0 pointer-events-none hidden lg:block"
        style={{ zIndex: 0 }}
      >
        {/* 1 — Support ticket card · far left */}
        <div
          className="absolute"
          style={{
            left: '2%',
            top: '40%',
            animation: 'fi-a 5.2s ease-in-out 0s infinite',
          }}
        >
          <svg
            width="68"
            height="68"
            viewBox="0 0 68 68"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <circle cx="34" cy="34" r="34" fill="#FFD6E7" />
            <circle cx="34" cy="34" r="26" fill="#F43F8E" />
            {/* ticket card */}
            <rect
              x="18"
              y="20"
              width="32"
              height="28"
              rx="5"
              fill="white"
              fillOpacity="0.95"
            />
            {/* hash / ticket-id block */}
            <rect
              x="21"
              y="23.5"
              width="1.5"
              height="9"
              rx="0.75"
              fill="#F43F8E"
              fillOpacity="0.35"
            />
            <rect
              x="24.5"
              y="23.5"
              width="1.5"
              height="9"
              rx="0.75"
              fill="#F43F8E"
              fillOpacity="0.35"
            />
            <rect
              x="20"
              y="26"
              width="8"
              height="1.5"
              rx="0.75"
              fill="#F43F8E"
              fillOpacity="0.35"
            />
            <rect
              x="20"
              y="29"
              width="8"
              height="1.5"
              rx="0.75"
              fill="#F43F8E"
              fillOpacity="0.35"
            />
            {/* title line */}
            <rect
              x="31"
              y="24.5"
              width="15"
              height="2.5"
              rx="1.25"
              fill="#F43F8E"
              fillOpacity="0.45"
            />
            {/* body line */}
            <rect
              x="31"
              y="29.5"
              width="11"
              height="2"
              rx="1"
              fill="#F43F8E"
              fillOpacity="0.25"
            />
            {/* divider */}
            <rect
              x="21"
              y="34.5"
              width="26"
              height="1"
              rx="0.5"
              fill="#F43F8E"
              fillOpacity="0.12"
            />
            {/* status pill — OPEN */}
            <rect
              x="21"
              y="37.5"
              width="18"
              height="7"
              rx="3.5"
              fill="#FEF3C7"
            />
            <circle cx="26.5" cy="41" r="2.2" fill="#F59E0B" />
            <rect
              x="30"
              y="40"
              width="7"
              height="2"
              rx="1"
              fill="#92400E"
              fillOpacity="0.55"
            />
          </svg>
        </div>

        {/* 2 — Notification bell · far right */}
        <div
          className="absolute"
          style={{
            right: '1%',
            top: '34%',
            animation: 'fi-b 6s ease-in-out 1s infinite',
          }}
        >
          <svg
            width="72"
            height="72"
            viewBox="0 0 72 72"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <circle cx="36" cy="36" r="36" fill="#FEF3C7" />
            <circle cx="36" cy="36" r="27" fill="#D97706" />
            {/* bell stem */}
            <rect
              x="34"
              y="15"
              width="4"
              height="6"
              rx="2"
              fill="white"
              fillOpacity="0.9"
            />
            {/* bell body */}
            <path
              d="M36,21 C36,21 24,26 23,41 L49,41 C48,26 36,21 36,21 Z"
              fill="white"
              fillOpacity="0.92"
            />
            {/* bell bottom rim */}
            <ellipse
              cx="36"
              cy="41"
              rx="13"
              ry="2.5"
              fill="white"
              fillOpacity="0.55"
            />
            {/* clapper */}
            <ellipse
              cx="36"
              cy="45.5"
              rx="4"
              ry="3"
              fill="white"
              fillOpacity="0.88"
            />
            {/* notification badge */}
            <circle
              cx="48"
              cy="24"
              r="7.5"
              fill="#EF4444"
              stroke="#D97706"
              strokeWidth="1.5"
            />
            <rect
              x="44.5"
              y="22.5"
              width="7"
              height="1.5"
              rx="0.75"
              fill="white"
            />
            <rect
              x="44.5"
              y="25.5"
              width="7"
              height="1.5"
              rx="0.75"
              fill="white"
            />
          </svg>
        </div>

        {/* 3 — Client-to-agent chat · lower left */}
        <div
          className="absolute"
          style={{
            left: '17%',
            top: '67%',
            animation: 'fi-c 5.5s ease-in-out 0.5s infinite',
          }}
        >
          <svg
            width="62"
            height="62"
            viewBox="0 0 62 62"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <circle cx="31" cy="31" r="31" fill="#CCFBF1" />
            <circle cx="31" cy="31" r="23" fill="#0D9488" />
            {/* agent bubble — left */}
            <rect
              x="10"
              y="16"
              width="27"
              height="17"
              rx="5"
              fill="white"
              fillOpacity="0.92"
            />
            <path d="M14,33 L11,41 L23,33 Z" fill="white" fillOpacity="0.92" />
            <rect
              x="14"
              y="21"
              width="13"
              height="2"
              rx="1"
              fill="#0D9488"
              fillOpacity="0.4"
            />
            <rect
              x="14"
              y="25.5"
              width="9"
              height="2"
              rx="1"
              fill="#0D9488"
              fillOpacity="0.4"
            />
            {/* client bubble — right, lower */}
            <rect
              x="25"
              y="30"
              width="27"
              height="14"
              rx="4"
              fill="white"
              fillOpacity="0.72"
            />
            <path d="M48,44 L51,51 L40,44 Z" fill="white" fillOpacity="0.72" />
            <rect
              x="29"
              y="34.5"
              width="14"
              height="2"
              rx="1"
              fill="#0D9488"
              fillOpacity="0.35"
            />
            <rect
              x="29"
              y="38.5"
              width="9"
              height="2"
              rx="1"
              fill="#0D9488"
              fillOpacity="0.35"
            />
          </svg>
        </div>

        {/* 4 — Ticket status tracker · lower right */}
        <div
          className="absolute"
          style={{
            right: '14%',
            top: '63%',
            animation: 'fi-d 4.8s ease-in-out 1.5s infinite',
          }}
        >
          <svg
            width="66"
            height="66"
            viewBox="0 0 66 66"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <circle cx="33" cy="33" r="33" fill="#DBEAFE" />
            <circle cx="33" cy="33" r="25" fill="#2563EB" />
            {/* track background */}
            <rect
              x="16"
              y="30"
              width="34"
              height="3"
              rx="1.5"
              fill="white"
              fillOpacity="0.2"
            />
            {/* track fill — 2 of 3 done */}
            <rect
              x="16"
              y="30"
              width="22"
              height="3"
              rx="1.5"
              fill="white"
              fillOpacity="0.75"
            />
            {/* step 1 — completed (white circle + checkmark) */}
            <circle
              cx="18"
              cy="31.5"
              r="7.5"
              fill="#1D4ED8"
              stroke="white"
              strokeWidth="1.5"
            />
            <path
              d="M15,31.5 L17.5,34.5 L21.5,27.5"
              stroke="white"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
            {/* step 2 — in progress (ring + center dot) */}
            <circle
              cx="33"
              cy="31.5"
              r="7.5"
              fill="#1D4ED8"
              stroke="white"
              strokeWidth="2"
            />
            <circle cx="33" cy="31.5" r="3" fill="white" />
            {/* step 3 — pending (faint outline) */}
            <circle
              cx="48"
              cy="31.5"
              r="7.5"
              fill="none"
              stroke="white"
              strokeWidth="1.5"
              strokeOpacity="0.45"
            />
            <circle cx="48" cy="31.5" r="2.5" fill="white" fillOpacity="0.25" />
            {/* step labels */}
            <rect
              x="13"
              y="43"
              width="10"
              height="2"
              rx="1"
              fill="white"
              fillOpacity="0.5"
            />
            <rect
              x="27.5"
              y="43"
              width="11"
              height="2"
              rx="1"
              fill="white"
              fillOpacity="0.5"
            />
            <rect
              x="42.5"
              y="43"
              width="11"
              height="2"
              rx="1"
              fill="white"
              fillOpacity="0.28"
            />
          </svg>
        </div>

        {/* 5 — Issue resolved checkmark · bottom center */}
        <div
          className="absolute"
          style={{
            left: '45%',
            top: '77%',
            animation: 'fi-e 5.8s ease-in-out 0.3s infinite',
          }}
        >
          <svg
            width="62"
            height="62"
            viewBox="0 0 62 62"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <circle cx="31" cy="31" r="31" fill="#EEF2FF" />
            <circle cx="31" cy="31" r="23" fill="#6366F1" />
            {/* outer ring */}
            <circle
              cx="31"
              cy="31"
              r="16"
              fill="none"
              stroke="white"
              strokeWidth="1.5"
              strokeOpacity="0.3"
            />
            {/* inner white circle */}
            <circle cx="31" cy="31" r="11" fill="white" fillOpacity="0.92" />
            {/* checkmark */}
            <path
              d="M25,31 L29,35.5 L37,25.5"
              stroke="#6366F1"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          </svg>
        </div>
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// HERO
// ─────────────────────────────────────────────────────────────────────────────

function HeroSection() {
  const tickets = [
    {
      id: 'SF-042',
      title: 'Payment gateway not responding',
      status: 'OPEN',
      statusColor: 'bg-amber-100 text-amber-700',
      dot: 'bg-amber-500',
      time: '2m ago',
    },
    {
      id: 'SF-041',
      title: 'Mobile app crash on checkout',
      status: 'IN PROGRESS',
      statusColor: 'bg-blue-100 text-blue-700',
      dot: 'bg-blue-500',
      time: '1h ago',
    },
    {
      id: 'SF-039',
      title: 'Reports not exporting as PDF',
      status: 'FIXED',
      statusColor: 'bg-green-100 text-green-700',
      dot: 'bg-green-500',
      time: 'Yesterday',
    },
  ];

  return (
    <section className="relative overflow-hidden min-h-screen flex flex-col pt-16">
      {/* Subtle radial tint */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_60%_-10%,_#eef2ff_0%,_transparent_70%)]" />

      {/* Decorative wave lines */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none"
        viewBox="0 0 1440 900"
        preserveAspectRatio="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ opacity: 0.055 }}
      >
        <path fill="none" stroke="#4338ca" strokeWidth="2"   d="M0,280 C240,160 480,400 720,280 C960,160 1200,360 1440,280" />
        <path fill="none" stroke="#4338ca" strokeWidth="1.5" d="M0,440 C300,320 600,560 900,440 C1100,360 1300,500 1440,440" />
        <path fill="none" stroke="#4338ca" strokeWidth="1"   d="M0,600 C200,480 500,700 800,580 C1050,480 1280,640 1440,580" />
      </svg>

      <FloatingIcons />

      {/* Main content — vertically centred in remaining space */}
      <div className="flex-1 flex items-center relative z-10">
        <div className="max-w-6xl mx-auto px-5 sm:px-8 py-16 sm:py-20 w-full">
          <div className="grid lg:grid-cols-[1fr_400px] xl:grid-cols-[1fr_440px] gap-14 xl:gap-20 items-center">
            {/* Copy */}
            <div>
              <h1 className="text-5xl sm:text-6xl lg:text-7xl xl:text-[5rem] font-black text-gray-950 leading-[0.92] tracking-tight mb-7">
                Client support
                <br />
                without the{' '}
                <span className="bg-amber-300 text-gray-950 rounded-2xl px-3 py-1.5 inline-block leading-tight whitespace-nowrap">
                  chaos.
                </span>
              </h1>

              <p className="text-lg text-gray-500 max-w-md leading-relaxed mb-10">
                A dedicated portal for your clients to report, track, and
                resolve issues — replacing WhatsApp threads, scattered emails,
                and forgotten spreadsheets.
              </p>

              <div className="flex flex-wrap items-center gap-4 mb-8">
                <Link
                  href="/register"
                  className="inline-flex items-center gap-2 bg-gray-950 hover:bg-gray-800 text-white font-bold px-7 py-3.5 rounded-2xl transition-all hover:-translate-y-0.5 shadow-lg shadow-gray-900/20"
                >
                  Start free <ArrowRight size={16} />
                </Link>
                <a
                  href="#how-it-works"
                  className="inline-flex items-center gap-1.5 text-gray-600 font-semibold hover:text-gray-900 transition-colors"
                >
                  See how it works <ChevronRight size={16} />
                </a>
              </div>

              <div className="flex flex-wrap items-center gap-5 text-sm text-gray-400">
                {['Free plan forever', 'No credit card', '2-minute setup'].map(
                  (t) => (
                    <span key={t} className="flex items-center gap-1.5">
                      <CheckCircle2 size={14} className="text-green-500" /> {t}
                    </span>
                  ),
                )}
              </div>
            </div>

            {/* Mockup */}
            <div className="relative hidden lg:block">
              <div className="bg-white rounded-3xl border border-gray-200 shadow-2xl overflow-hidden">
                {/* Window chrome */}
                <div className="flex items-center gap-1.5 px-4 py-3 bg-gray-50 border-b border-gray-100">
                  <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
                  <span className="h-2.5 w-2.5 rounded-full bg-yellow-400" />
                  <span className="h-2.5 w-2.5 rounded-full bg-green-400" />
                  <span className="ml-3 text-xs text-gray-400 font-mono">
                    app.supportflow.io
                  </span>
                </div>
                {/* Header row */}
                <div className="px-5 py-3.5 flex items-center justify-between border-b border-gray-100">
                  <span className="text-sm font-bold text-gray-900">
                    Open Tickets
                  </span>
                  <span className="text-xs bg-indigo-50 text-indigo-600 border border-indigo-100 px-2.5 py-1 rounded-full font-bold">
                    3 active
                  </span>
                </div>
                {/* Rows */}
                <div className="divide-y divide-gray-50">
                  {tickets.map((t) => (
                    <div
                      key={t.id}
                      className="flex items-center gap-3 px-5 py-3.5 hover:bg-gray-50/60 transition-colors"
                    >
                      <span
                        className={`h-2 w-2 rounded-full flex-shrink-0 ${t.dot}`}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {t.title}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {t.id} · {t.time}
                        </p>
                      </div>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${t.statusColor}`}
                      >
                        {t.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Floating badge — resolved */}
              <div className="absolute -top-5 -right-5 bg-white rounded-2xl border border-gray-200 shadow-xl px-4 py-2.5 flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center">
                  <CheckCircle2 size={15} className="text-green-600" />
                </div>
                <div>
                  <p className="text-xs font-black text-gray-900">Resolved</p>
                  <p className="text-[10px] text-gray-400">Client notified</p>
                </div>
              </div>

              {/* Floating badge — response time */}
              <div className="absolute -bottom-4 -left-5 bg-gray-950 rounded-2xl px-4 py-2.5 flex items-center gap-2.5 shadow-2xl">
                <div className="h-7 w-7 rounded-lg bg-indigo-600 flex items-center justify-center flex-shrink-0">
                  <Zap size={13} className="text-white" />
                </div>
                <div>
                  <p className="text-[10px] text-gray-500">Avg. response</p>
                  <p className="text-xs font-black text-white">under 2 hours</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Social proof strip — pinned to bottom of hero */}
      <div className="relative z-10 border-t border-gray-100/80 bg-white/70 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-5 sm:px-8 py-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
            <p className="text-xs font-bold uppercase tracking-widest text-gray-400">
              Trusted by 500+ teams across the world
            </p>
            <div className="flex flex-wrap justify-center sm:justify-end gap-10">
              {[
                { n: '500+', label: 'Businesses' },
                { n: '98%', label: 'Satisfaction' },
                { n: '4×', label: 'Faster resolution' },
                { n: '0', label: 'Lost requests' },
              ].map(({ n, label }) => (
                <div key={label} className="text-center">
                  <p className="text-2xl font-black text-gray-950">{n}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PROBLEM — dark floating section
// ─────────────────────────────────────────────────────────────────────────────

function ProblemSection() {
  const pains = [
    {
      Icon: MessageSquare,
      title: 'Lost in the chats',
      body: 'Client requests scattered across WhatsApp, email, and DMs. Nothing is findable when it actually matters.',
    },
    {
      Icon: AlertCircle,
      title: 'Issues fall through',
      body: 'A request mentioned in passing two weeks ago. Did anyone follow up? Nobody knows.',
    },
    {
      Icon: Eye,
      title: 'Zero visibility',
      body: 'Clients keep asking for updates because they have no idea what is happening on your end.',
    },
  ];

  return (
    <section id="problem" className="py-6 sm:py-10">
      <div className="bg-gray-950 rounded-[2.5rem] mx-4 sm:mx-8 lg:mx-16 px-8 sm:px-14 lg:px-20 py-16 sm:py-20">
        <div className="max-w-5xl mx-auto">
          <p className="text-xs font-bold uppercase tracking-widest text-indigo-400 mb-5">
            The problem
          </p>
          <h2 className="text-4xl sm:text-5xl lg:text-6xl font-black text-white leading-[0.95] tracking-tight mb-6">
            Your support is <span className="text-amber-300">everywhere!</span>
            <br />
            That is the problem.
          </h2>
          <p className="text-gray-400 text-lg max-w-2xl mb-14 leading-relaxed">
            Managing client issues through WhatsApp and email is not a system —
            it is a liability. Issues slip, clients feel ignored, and your
            reputation takes the hit.
          </p>

          <div className="grid sm:grid-cols-3 gap-5">
            {pains.map(({ Icon, title, body }) => (
              <div
                key={title}
                className="bg-white/5 hover:bg-white/8 border border-white/10 hover:border-white/20 rounded-2xl p-6 transition-all"
              >
                <div className="h-10 w-10 rounded-xl bg-white/10 flex items-center justify-center mb-4">
                  <Icon size={18} className="text-indigo-400" />
                </div>
                <h3 className="text-white font-bold text-base mb-2">{title}</h3>
                <p className="text-gray-400 text-sm leading-relaxed">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FEATURES
// ─────────────────────────────────────────────────────────────────────────────

function FeaturesSection() {
  const features = [
    {
      Icon: Ticket,
      title: 'Ticket portal',
      body: 'Clients submit and track every issue in a dedicated space — not a WhatsApp group.',
    },
    {
      Icon: Activity,
      title: 'Live status',
      body: 'Open to In Progress to Fixed. Every status change notifies the client automatically.',
    },
    {
      Icon: MessageSquare,
      title: 'On-ticket chat',
      body: 'All conversations happen on the ticket. Context is never lost.',
    },
    {
      Icon: Paperclip,
      title: 'File attachments',
      body: 'Screenshots, logs, and documents attached directly where they belong.',
    },
    {
      Icon: Bell,
      title: 'Smart notifications',
      body: 'Clients and agents are alerted on every update. Zero manual chasing.',
    },
    {
      Icon: BarChart3,
      title: 'Analytics',
      body: 'Resolution times, open tickets, agent performance — metrics that matter.',
    },
    {
      Icon: Users,
      title: 'Team workspace',
      body: 'Assign tickets, leave internal notes, and collaborate as a proper team.',
    },
    {
      Icon: Shield,
      title: 'Audit trail',
      body: 'Every action, status change, and comment — permanently on record.',
    },
  ];

  return (
    <section id="features" className="py-20 sm:py-28 bg-white">
      <div className="max-w-6xl mx-auto px-5 sm:px-8">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 mb-14">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-indigo-600 mb-4">
              Features
            </p>
            <h2 className="text-4xl sm:text-5xl font-black text-gray-950 leading-[0.95] tracking-tight">
              Everything you need.
              <br />
              <span className="text-gray-400">Nothing you do not.</span>
            </h2>
          </div>
          <Link
            href="/register"
            className="inline-flex items-center gap-1.5 text-sm font-bold text-gray-950 hover:text-indigo-600 transition-colors whitespace-nowrap"
          >
            Start free <ArrowRight size={15} />
          </Link>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {features.map(({ Icon, title, body }) => (
            <div
              key={title}
              className="group bg-gray-50 hover:bg-indigo-50 border border-gray-100 hover:border-indigo-100 rounded-2xl p-5 transition-all"
            >
              <div className="h-9 w-9 rounded-xl bg-white border border-gray-200 group-hover:border-indigo-200 flex items-center justify-center mb-3 shadow-sm transition-colors">
                <Icon
                  size={16}
                  className="text-gray-600 group-hover:text-indigo-600 transition-colors"
                />
              </div>
              <h3 className="font-bold text-gray-900 text-sm mb-1.5">
                {title}
              </h3>
              <p className="text-xs text-gray-500 leading-relaxed">{body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// HOW IT WORKS
// ─────────────────────────────────────────────────────────────────────────────

function HowItWorksSection() {
  // Canvas: 900 × 200. All elements sit on y = 100.
  const W = 900,
    H = 200,
    yc = 100;
  const r = 24; // half-width of every icon (48 × 48 px)

  const steps = [
    {
      id: 'ticket',
      x: 215,
      label: 'Reports issue',
      Icon: Ticket,
      color: '#EC4899',
      num: 1,
    },
    {
      id: 'team',
      x: 385,
      label: 'Team assigned',
      Icon: Users,
      color: '#3B82F6',
      num: 2,
    },
    {
      id: 'bell',
      x: 555,
      label: 'Client updated',
      Icon: Bell,
      color: '#F59E0B',
      num: 3,
    },
    {
      id: 'check',
      x: 725,
      label: 'Issue resolved',
      Icon: CheckCircle2,
      color: '#10B981',
      num: 4,
    },
  ];

  const clientX = 55;
  const agentX = 855;

  // Arrow segments: start just after the left icon edge, end just before the right icon edge
  const arrowGap = 6;
  const arrows = [
    { x1: clientX + r + arrowGap, x2: steps[0].x - r - arrowGap },
    { x1: steps[0].x + r + arrowGap, x2: steps[1].x - r - arrowGap },
    { x1: steps[1].x + r + arrowGap, x2: steps[2].x - r - arrowGap },
    { x1: steps[2].x + r + arrowGap, x2: steps[3].x - r - arrowGap },
    { x1: steps[3].x + r + arrowGap, x2: agentX - r - arrowGap },
  ];

  return (
    <section
      id="how-it-works"
      className="py-20 sm:py-28 bg-gray-50 overflow-hidden"
    >
      <div className="max-w-6xl mx-auto px-5 sm:px-8">
        <div className="text-center mb-14">
          <p className="text-xs font-bold uppercase tracking-widest text-indigo-600 mb-4">
            How it works
          </p>
          <h2 className="text-4xl sm:text-5xl font-black text-gray-950 leading-[0.95] tracking-tight">
            From report to resolved.
            <br />
            <span className="text-gray-400">In one place.</span>
          </h2>
        </div>

        {/* ── Flow pipeline diagram (md+) ── */}
        <div
          className="relative hidden md:block w-full max-w-5xl mx-auto"
          style={{ paddingBottom: `${(H / W) * 100}%` }}
        >
          <div className="absolute inset-0">
            <svg
              className="absolute inset-0 w-full h-full"
              viewBox={`0 0 ${W} ${H}`}
              preserveAspectRatio="xMidYMid meet"
            >
              <defs>
                <marker
                  id="arr"
                  viewBox="0 0 10 10"
                  refX="8"
                  refY="5"
                  markerWidth="5"
                  markerHeight="5"
                  orient="auto"
                >
                  <path d="M0,1 L9,5 L0,9 Z" fill="#A5B4FC" />
                </marker>
              </defs>

              {/* Subtle horizontal track behind every element */}
              <rect
                x={clientX - r}
                y={yc - 3}
                width={agentX - clientX + r * 2}
                height={6}
                rx="3"
                fill="#F1F5F9"
              />

              {/* Directional arrows */}
              {arrows.map((a, i) => (
                <line
                  key={i}
                  x1={a.x1}
                  y1={yc}
                  x2={a.x2}
                  y2={yc}
                  stroke="#C7D2FE"
                  strokeWidth="1.5"
                  markerEnd="url(#arr)"
                />
              ))}

              {/* Step number badges above each step node */}
              {steps.map((s) => (
                <g key={`badge-${s.id}`}>
                  <circle cx={s.x} cy={yc - r - 16} r="11" fill="#4F46E5" />
                  <text
                    x={s.x}
                    y={yc - r - 16 + 4}
                    textAnchor="middle"
                    fontSize="10"
                    fontWeight="800"
                    fill="white"
                    fontFamily="system-ui, -apple-system, sans-serif"
                  >
                    {s.num}
                  </text>
                </g>
              ))}
            </svg>

            {/* Client avatar */}
            <div
              className="absolute"
              style={{
                left: `${(clientX / W) * 100}%`,
                top: `${(yc / H) * 100}%`,
                transform: 'translate(-50%, -50%)',
              }}
            >
              <div className="h-12 w-12 rounded-2xl bg-white border-2 border-indigo-100 shadow-lg flex items-center justify-center">
                <span className="text-base font-black text-indigo-500">C</span>
              </div>
              <p className="text-[10px] font-bold text-gray-400 text-center mt-1.5">
                Client
              </p>
            </div>

            {/* Step nodes */}
            {steps.map((s) => (
              <div
                key={s.id}
                className="absolute"
                style={{
                  left: `${(s.x / W) * 100}%`,
                  top: `${(yc / H) * 100}%`,
                  transform: 'translate(-50%, -50%)',
                }}
              >
                <div
                  className="h-12 w-12 rounded-2xl flex items-center justify-center shadow-lg"
                  style={{ backgroundColor: s.color }}
                >
                  <s.Icon size={22} className="text-white" />
                </div>
                <p className="text-[10px] font-bold text-gray-500 text-center mt-1.5 whitespace-nowrap">
                  {s.label}
                </p>
              </div>
            ))}

            {/* Agent avatar */}
            <div
              className="absolute"
              style={{
                left: `${(agentX / W) * 100}%`,
                top: `${(yc / H) * 100}%`,
                transform: 'translate(-50%, -50%)',
              }}
            >
              <div className="h-12 w-12 rounded-2xl bg-white border-2 border-violet-100 shadow-lg flex items-center justify-center">
                <span className="text-base font-black text-violet-500">A</span>
              </div>
              <p className="text-[10px] font-bold text-gray-400 text-center mt-1.5">
                Agent
              </p>
            </div>
          </div>
        </div>

        {/* ── Mobile: 2×2 step cards ── */}
        <div className="md:hidden grid grid-cols-2 gap-4 mt-2">
          {[
            {
              n: '01',
              title: 'Client reports',
              body: 'Client submits a ticket through their dedicated portal.',
              Icon: Ticket,
              bg: 'bg-pink-500',
            },
            {
              n: '02',
              title: 'Team investigates',
              body: 'Assigned to the right agent. Everything on the ticket.',
              Icon: Users,
              bg: 'bg-blue-500',
            },
            {
              n: '03',
              title: 'Client notified',
              body: 'Automatic updates on every status change. No chasing.',
              Icon: Bell,
              bg: 'bg-amber-500',
            },
            {
              n: '04',
              title: 'Issue resolved',
              body: 'Resolution documented. Permanent record for both sides.',
              Icon: CheckCircle2,
              bg: 'bg-emerald-500',
            },
          ].map((s) => (
            <div
              key={s.n}
              className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm"
            >
              <div
                className={`h-9 w-9 rounded-xl ${s.bg} flex items-center justify-center mb-3`}
              >
                <s.Icon size={16} className="text-white" />
              </div>
              <span className="text-4xl font-black text-gray-100 block leading-none mb-2 select-none">
                {s.n}
              </span>
              <h3 className="font-bold text-gray-950 text-sm mb-1">
                {s.title}
              </h3>
              <p className="text-xs text-gray-500 leading-relaxed">{s.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PRICING — dark floating section
// ─────────────────────────────────────────────────────────────────────────────

function PricingSection() {
  const [yearly, setYearly] = useState(false);

  const plans = [
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

  return (
    <section id="pricing" className="py-6 sm:py-10">
      <div className="bg-gray-950 rounded-[2.5rem] mx-4 sm:mx-8 lg:mx-16 px-8 sm:px-14 lg:px-20 py-16 sm:py-20">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-xs font-bold uppercase tracking-widest text-indigo-400 mb-5">
              Pricing
            </p>
            <h2 className="text-4xl sm:text-5xl font-black text-white leading-[0.95] tracking-tight mb-4">
              Simple, honest pricing.
            </h2>
            <p className="text-gray-400 text-lg mb-8">
              Start free. Upgrade when you are ready. No hidden fees.
            </p>
            {/* Monthly / Yearly toggle */}
            <div className="inline-flex items-center gap-3 bg-white/10 backdrop-blur px-5 py-2.5 rounded-full">
              <span className={`text-sm font-medium transition-colors ${!yearly ? 'text-white' : 'text-gray-400'}`}>
                Monthly
              </span>
              <button
                type="button"
                onClick={() => setYearly((v) => !v)}
                className={`relative w-11 h-6 rounded-full transition-colors duration-300 ${yearly ? 'bg-teal-400' : 'bg-white/30'}`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-300 ${yearly ? 'translate-x-5' : 'translate-x-0'}`}
                />
              </button>
              <span className={`text-sm font-medium transition-colors ${yearly ? 'text-white' : 'text-gray-400'}`}>
                Yearly
              </span>
              {yearly && (
                <span className="text-[10px] font-bold uppercase tracking-wide bg-teal-400 text-teal-900 px-2 py-0.5 rounded-full">
                  Save ~17%
                </span>
              )}
            </div>
          </div>

          <div className="grid sm:grid-cols-3 gap-5 items-stretch">
            {plans.map((plan) => {
              const price = yearly ? plan.yearlyUsd : plan.monthlyUsd;
              const period = yearly ? 'year' : 'month';
              return (
                <div
                  key={plan.key}
                  className="rounded-3xl p-6 shadow-lg flex flex-col"
                  style={plan.cardStyle as React.CSSProperties}
                >
                  <p className={`text-sm font-semibold mb-1 ${plan.subTextClass}`}>{plan.label} Plan</p>
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
                  <ul className="space-y-2.5 mb-6 flex-1">
                    {plan.features.map((f) => (
                      <li key={f} className={`flex items-start gap-2.5 text-sm ${plan.featureClass}`}>
                        <Check size={14} className={`mt-0.5 shrink-0 ${plan.checkClass}`} />
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
                  <Link
                    href={`/register?plan=${plan.key}`}
                    className={`w-full py-3 rounded-2xl font-bold text-sm text-center transition-colors ${plan.ctaClass}`}
                  >
                    {price === 0 ? 'Start free' : 'Choose Plan'}
                  </Link>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TESTIMONIALS
// ─────────────────────────────────────────────────────────────────────────────

function TestimonialsSection() {
  const testimonials = [
    {
      quote:
        'Before SupportFlow, I was juggling requests across three WhatsApp groups and two email threads. Now everything is in one place and my clients feel genuinely taken care of.',
      name: 'Brian O.',
      role: 'Freelance Web Developer',
      initials: 'BO',
      color: 'bg-indigo-600',
    },
    {
      quote:
        'We manage support for 12 software clients. SupportFlow gave us a system where nothing falls through the cracks. The client portal alone is worth it — they love tracking their issues.',
      name: 'Amara K.',
      role: 'Operations Lead, Nexus Software',
      initials: 'AK',
      color: 'bg-violet-600',
    },
    {
      quote:
        'We deploy POS systems across 50+ retail locations. The accountability SupportFlow creates has dramatically reduced repeat issues and complaint escalations.',
      name: 'James M.',
      role: 'Technical Director, RetailPoint',
      initials: 'JM',
      color: 'bg-emerald-600',
    },
  ];

  return (
    <section className="py-20 sm:py-28 bg-white">
      <div className="max-w-6xl mx-auto px-5 sm:px-8">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 mb-14">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-indigo-600 mb-4">
              Testimonials
            </p>
            <h2 className="text-4xl sm:text-5xl font-black text-gray-950 leading-[0.95] tracking-tight">
              Teams that made the switch.
            </h2>
          </div>
          <p className="text-gray-400 text-sm max-w-xs">
            500+ businesses already delivering a better support experience.
          </p>
        </div>

        <div className="grid sm:grid-cols-3 gap-5">
          {testimonials.map((t) => (
            <div
              key={t.name}
              className="bg-gray-50 border border-gray-100 rounded-2xl p-6 flex flex-col"
            >
              <div className="flex gap-0.5 mb-4">
                {[1, 2, 3, 4, 5].map((n) => (
                  <Star
                    key={n}
                    size={13}
                    className="text-amber-400 fill-amber-400"
                  />
                ))}
              </div>
              <p className="text-gray-700 text-sm leading-relaxed flex-1 mb-5">
                {t.quote}
              </p>
              <div className="flex items-center gap-3 pt-4 border-t border-gray-200">
                <div
                  className={`h-9 w-9 rounded-full ${t.color} flex items-center justify-center flex-shrink-0`}
                >
                  <span className="text-white text-xs font-black">
                    {t.initials}
                  </span>
                </div>
                <div>
                  <p className="font-bold text-gray-900 text-sm">{t.name}</p>
                  <p className="text-gray-400 text-xs">{t.role}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FINAL CTA + FOOTER — combined dark floating section
// ─────────────────────────────────────────────────────────────────────────────

function CtaAndFooter() {
  return (
    <>
      {/* CTA */}
      <section className="py-6 sm:py-10">
        <div className="bg-gray-950 rounded-[2.5rem] mx-4 sm:mx-8 lg:mx-16 px-8 sm:px-14 lg:px-20 py-16 sm:py-24 text-center">
          <p className="text-xs font-bold uppercase tracking-widest text-indigo-400 mb-5">
            Get started today
          </p>
          <h2 className="text-4xl sm:text-5xl lg:text-6xl font-black text-white leading-[0.95] tracking-tight mb-6 max-w-3xl mx-auto">
            Professional support starts with the{' '}
            <span className="text-amber-300">right system.</span>
          </h2>
          <p className="text-gray-400 text-lg mb-10 max-w-xl mx-auto leading-relaxed">
            Give your clients the support experience they deserve — and give
            your team a system they can actually rely on.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link
              href="/register"
              className="inline-flex items-center gap-2 bg-white text-gray-950 font-black px-8 py-4 rounded-2xl hover:bg-gray-100 transition-all hover:-translate-y-0.5 text-base shadow-xl shadow-black/30"
            >
              Start free <ArrowRight size={18} />
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 bg-white/10 hover:bg-white/15 text-white font-semibold px-8 py-4 rounded-2xl border border-white/20 transition-colors text-base"
            >
              Sign in
            </Link>
          </div>
          <p className="text-gray-600 text-sm mt-6">
            No credit card required · Free plan available forever
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-10 px-5 sm:px-8">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="h-7 w-7 rounded-lg bg-gray-950 flex items-center justify-center">
              <HeadphonesIcon size={13} className="text-white" />
            </div>
            <span className="font-black text-gray-950 tracking-tight">
              SupportFlow
            </span>
          </div>
          <div className="flex flex-wrap justify-center gap-6 text-sm text-gray-400">
            {[
              ['#how-it-works', 'How it works'],
              ['#features', 'Features'],
              ['#pricing', 'Pricing'],
            ].map(([href, label]) => (
              <a
                key={href}
                href={href}
                className="hover:text-gray-700 transition-colors"
              >
                {label}
              </a>
            ))}
            <Link
              href="/login"
              className="hover:text-gray-700 transition-colors"
            >
              Sign in
            </Link>
            <Link
              href="/register"
              className="hover:text-gray-700 transition-colors"
            >
              Register
            </Link>
          </div>
          <p className="text-xs text-gray-400">
            © {new Date().getFullYear()} SupportFlow
          </p>
        </div>
      </footer>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ROOT PAGE
// ─────────────────────────────────────────────────────────────────────────────

export default function HomePage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    if (isLoading || !user) return;
    if (user.role === 'CLIENT') router.replace('/portal');
    else router.replace('/dashboard');
  }, [user, isLoading, router]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  if (isLoading || user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-950" />
      </div>
    );
  }

  return (
    <div className="bg-white">
      <Navbar scrolled={scrolled} />
      <HeroSection />
      <ProblemSection />
      <FeaturesSection />
      <HowItWorksSection />
      <PricingSection />
      <TestimonialsSection />
      <CtaAndFooter />
    </div>
  );
}
