'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  HeadphonesIcon,
  CheckCircle2,
  Eye,
  EyeOff,
  Mail,
  Lock,
  Ticket,
  BarChart3,
  MessageCircle,
  Users,
  Zap,
  ShieldCheck,
  Clock,
  Star,
  TrendingUp,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useNotify } from '@/hooks/useNotify';
import { Button } from '@/components/ui/Button';

const schema = z.object({
  email:    z.string().email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
});
type FormData = z.infer<typeof schema>;

/* ── Carousel slides ── */
const slides = [
  {
    heading: <>Resolve Faster,{' '}<span className="text-primary-600">Together</span></>,
    caption: (
      <>Compatible with <strong className="text-gray-700">email, live chat, and web portals</strong> for a seamless support experience anywhere.</>
    ),
    icons: [
      { icon: Ticket,        style: 'top-0 left-1/2 -translate-x-1/2 -translate-y-1/2' },
      { icon: MessageCircle, style: 'top-[14%] right-0 translate-x-1/2' },
      { icon: BarChart3,     style: 'bottom-[14%] right-0 translate-x-1/2' },
      { icon: Zap,           style: 'bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2' },
      { icon: Users,         style: 'bottom-[14%] left-0 -translate-x-1/2' },
      { icon: ShieldCheck,   style: 'top-[14%] left-0 -translate-x-1/2' },
    ],
  },
  {
    heading: <>Respond in{' '}<span className="text-primary-600">Record Time</span></>,
    caption: (
      <>Built-in <strong className="text-gray-700">SLA tracking and priority queues</strong> help your team hit every response target.</>
    ),
    icons: [
      { icon: Clock,      style: 'top-0 left-1/2 -translate-x-1/2 -translate-y-1/2' },
      { icon: Zap,        style: 'top-[14%] right-0 translate-x-1/2' },
      { icon: TrendingUp, style: 'bottom-[14%] right-0 translate-x-1/2' },
      { icon: Ticket,     style: 'bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2' },
      { icon: BarChart3,  style: 'bottom-[14%] left-0 -translate-x-1/2' },
      { icon: Star,       style: 'top-[14%] left-0 -translate-x-1/2' },
    ],
  },
  {
    heading: <>Delight Every{' '}<span className="text-primary-600">Customer</span></>,
    caption: (
      <>Collect <strong className="text-gray-700">CSAT ratings and real-time feedback</strong> to continuously improve your support quality.</>
    ),
    icons: [
      { icon: Star,          style: 'top-0 left-1/2 -translate-x-1/2 -translate-y-1/2' },
      { icon: MessageCircle, style: 'top-[14%] right-0 translate-x-1/2' },
      { icon: Users,         style: 'bottom-[14%] right-0 translate-x-1/2' },
      { icon: TrendingUp,    style: 'bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2' },
      { icon: ShieldCheck,   style: 'bottom-[14%] left-0 -translate-x-1/2' },
      { icon: BarChart3,     style: 'top-[14%] left-0 -translate-x-1/2' },
    ],
  },
];

export default function LoginPage() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const isNewAccount = searchParams.get('welcome') === '1';
  const { login }    = useAuth();
  const notify       = useNotify();
  const [serverError,  setServerError]  = useState(
    searchParams.get('error') === 'google_failed'
      ? 'Google sign-in failed. Please try again or use your email and password.'
      : ''
  );
  const [showPassword, setShowPassword] = useState(false);
  const [slide, setSlide]               = useState(0);
  const [fading, setFading]             = useState(false);

  /* Auto-advance every 4 s */
  useEffect(() => {
    const timer = setInterval(() => {
      setFading(true);
      setTimeout(() => {
        setSlide(s => (s + 1) % slides.length);
        setFading(false);
      }, 350);
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  const goTo = (i: number) => {
    if (i === slide) return;
    setFading(true);
    setTimeout(() => { setSlide(i); setFading(false); }, 350);
  };

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

  const current = slides[slide];

  return (
    <div className="flex w-full max-w-4xl rounded-2xl overflow-hidden shadow-2xl">

      {/* ── Left Panel ── */}
      <div className="flex-1 bg-white px-10 py-12 flex flex-col justify-center">

        {/* Brand */}
        <div className="flex items-center gap-2.5 mb-8">
          <div className="h-9 w-9 rounded-xl bg-primary-600 flex items-center justify-center">
            <HeadphonesIcon size={18} className="text-white" />
          </div>
          <span className="text-lg font-bold text-gray-900 tracking-tight">SupportFlow</span>
        </div>

        <div className="h-6 mb-3" />

        <h1 className="text-2xl font-bold text-gray-900 mb-1">Login to your account!</h1>
        <p className="text-sm text-gray-400 mb-7">
          {isNewAccount
            ? 'Your account is ready — sign in to get started.'
            : 'Enter your registered email address and password to login!'}
        </p>

        {isNewAccount && (
          <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-xl px-4 py-3 mb-5">
            <CheckCircle2 size={16} className="text-green-600 shrink-0" />
            <p className="text-sm text-green-800 font-medium">Account created successfully! Sign in to continue.</p>
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Email */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Email</label>
            <div className="relative">
              <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              <input
                type="email"
                placeholder="eg. you@example.com"
                className={`w-full pl-10 pr-4 py-2.5 rounded-xl border text-sm bg-gray-50 text-gray-900 placeholder-gray-300 outline-none transition
                  ${errors.email ? 'border-red-400 focus:border-red-500' : 'border-gray-200 focus:border-primary-500 focus:bg-white'}`}
                {...register('email')}
              />
            </div>
            {errors.email?.message && (
              <p className="text-xs text-red-500 mt-1">{errors.email.message}</p>
            )}
          </div>

          {/* Password */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Password</label>
            <div className="relative">
              <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••••••"
                className={`w-full pl-10 pr-10 py-2.5 rounded-xl border text-sm bg-gray-50 text-gray-900 placeholder-gray-300 outline-none transition
                  ${errors.password ? 'border-red-400 focus:border-red-500' : 'border-gray-200 focus:border-primary-500 focus:bg-white'}`}
                {...register('password')}
              />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                tabIndex={-1}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
            {errors.password?.message && (
              <p className="text-xs text-red-500 mt-1">{errors.password.message}</p>
            )}
          </div>

          {/* Remember + Forgot */}
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-sm text-gray-500 cursor-pointer select-none">
              <input type="checkbox" className="w-3.5 h-3.5 accent-primary-600 cursor-pointer" />
              Remember me
            </label>
            <Link href="/forgot-password" className="text-sm text-primary-600 font-medium hover:underline">
              Forgot Password?
            </Link>
          </div>

          {serverError && (
            <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              {serverError}
            </div>
          )}

          <Button type="submit" isLoading={isSubmitting} className="w-full" size="lg">
            Login
          </Button>
        </form>

        {/* Divider */}
        <div className="flex items-center gap-3 my-4">
          <div className="flex-1 h-px bg-gray-200" />
          <span className="text-xs text-gray-400">Or login with</span>
          <div className="flex-1 h-px bg-gray-200" />
        </div>

        {/* Google */}
        <button
          type="button"
          onClick={() => window.location.href = `${process.env.NEXT_PUBLIC_API_URL}/auth/google`}
          className="w-full flex items-center justify-center gap-2.5 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 hover:border-gray-300 transition-colors"
        >
          <svg width="17" height="17" viewBox="0 0 48 48">
            <path fill="#EA4335" d="M24 9.5c3.1 0 5.6 1.1 7.6 2.8l5.7-5.7C33.7 3.5 29.2 1.5 24 1.5 14.9 1.5 7.2 7 3.7 14.8l6.6 5.1C12.1 13.6 17.6 9.5 24 9.5z"/>
            <path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v8.5h12.4c-.5 2.8-2.1 5.1-4.5 6.7l6.9 5.4C43.1 36.7 46.1 31 46.1 24.5z"/>
            <path fill="#FBBC05" d="M10.3 28.6c-.5-1.5-.8-3-.8-4.6s.3-3.1.8-4.6l-6.6-5.1C2 17.2 1 20.5 1 24s1 6.8 2.7 9.7l6.6-5.1z"/>
            <path fill="#34A853" d="M24 46.5c5.2 0 9.6-1.7 12.8-4.6l-6.9-5.4c-1.7 1.2-3.9 1.9-5.9 1.9-6.4 0-11.9-4.3-13.7-10.1l-6.6 5.1C7.2 41 14.9 46.5 24 46.5z"/>
          </svg>
          Continue with Google
        </button>

        <p className="mt-5 text-center text-sm text-gray-400">
          Don&apos;t have an account?{' '}
          <Link href="/plans" className="text-primary-600 font-medium hover:underline">
            See all plans
          </Link>
        </p>
      </div>

      {/* ── Right Panel ── */}
      <div
        className="hidden lg:flex w-96 flex-col items-center justify-center px-10 py-12 relative overflow-hidden"
        style={{ background: 'linear-gradient(145deg, #dbeafe 0%, #ede9fe 55%, #fce7f3 100%)' }}
      >
        {/* Orbit graphic */}
        <div className="relative w-52 h-52 shrink-0">
          {/* Static rings */}
          <div className="absolute inset-0 rounded-full border border-slate-300/40" />
          <div className="absolute inset-8 rounded-full border border-slate-300/40" />

          {/* Static center */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 bg-primary-600 rounded-full flex items-center justify-center shadow-lg shadow-primary-400/30 z-10">
            <HeadphonesIcon size={26} className="text-white" />
          </div>

          {/* Revolving icons wrapper */}
          <div
            className="absolute inset-0"
            style={{ animation: 'orbit-spin 18s linear infinite' }}
          >
            {slides[0].icons.map(({ icon: Icon, style }, i) => (
              <div key={i} className={`absolute w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-md ${style}`}>
                {/* Counter-rotate so icon stays upright */}
                <div style={{ animation: 'orbit-spin-reverse 18s linear infinite' }}>
                  <Icon size={17} className="text-primary-600" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Fading text — fixed height prevents layout shift */}
        <div
          className="flex flex-col items-center w-full mt-8 transition-opacity duration-300"
          style={{ opacity: fading ? 0 : 1, height: '112px', overflow: 'hidden' }}
        >
          <h2 className="text-2xl font-bold text-gray-900 text-center leading-snug">
            {current.heading}
          </h2>
          <p className="mt-3 text-center text-[13px] text-gray-500 leading-relaxed max-w-xs">
            {current.caption}
          </p>
        </div>

        {/* Dots */}
        <div className="flex gap-1.5 mt-6">
          {slides.map((_, i) => (
            <button
              key={i}
              onClick={() => goTo(i)}
              className={`h-2 rounded-full transition-all duration-300 ${i === slide ? 'w-5 bg-primary-500' : 'w-2 bg-slate-300 hover:bg-slate-400'}`}
              aria-label={`Slide ${i + 1}`}
            />
          ))}
        </div>
      </div>

    </div>
  );
}
