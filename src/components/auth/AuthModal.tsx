import React, { useState, useEffect } from 'react';
import { loginWithGoogle, loginWithEmail, registerWithEmail, resetPassword } from '../../firebase/services';
import { X, Lock, Mail, User, ShieldCheck, AlertCircle, Eye, EyeOff, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { AppLogo } from '../ui/AppLogo';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [authMode, setAuthMode] = useState<'login' | 'register' | 'forgot_password'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [countdown, setCountdown] = useState(0);

  // Check if running inside Android APK WebView bridge
  const isNative =
    typeof window !== 'undefined' &&
    typeof (window as unknown as { AndroidReminders?: unknown }).AndroidReminders !== 'undefined';

  // Countdown timer for password reset rate-limiting
  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(() => {
      setCountdown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  if (!isOpen) return null;

  const handleClose = () => {
    setErrorMessage('');
    setSuccessMessage('');
    setShowPassword(false);
    onClose();
  };

  const handleGoogleLogin = async () => {
    try {
      setLoading(true);
      setErrorMessage('');
      await loginWithGoogle();
      onSuccess();
      handleClose();
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code || '';
      const msg = err instanceof Error ? err.message : '';

      if (code === 'auth/popup-blocked' || msg.includes('popup-blocked')) {
        setErrorMessage('ব্রাউজারে পপআপ ব্লক করা হয়েছে। অনুগ্রহ করে পপআপ অনুমোদন করুন।');
      } else if (
        code === 'auth/operation-not-supported-in-this-environment' ||
        msg.includes('operation-not-supported-in-this-environment')
      ) {
        setErrorMessage('এই ব্রাউজারে গুগল লগইন সমর্থিত নয়। অনুগ্রহ করে ইমেইল ও পাসওয়ার্ড দিয়ে লগইন করুন।');
      } else if (code === 'auth/popup-closed-by-user' || msg.includes('popup-closed-by-user')) {
        setErrorMessage('গুগল সাইন-ইন উইন্ডো বন্ধ করা হয়েছে।');
      } else if (code === 'auth/network-request-failed' || msg.includes('network') || msg.includes('fetch')) {
        setErrorMessage('ইন্টারনেট সংযোগ পরীক্ষা করুন');
      } else {
        setErrorMessage('গুগল লগইন সম্পন্ন করা যায়নি। অনুগ্রহ করে পুনরায় চেষ্টা করুন।');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setErrorMessage('ইমেইল এবং পাসওয়ার্ড পূরণ করুন');
      return;
    }
    if (authMode === 'register' && password.length < 6) {
      setErrorMessage('পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে');
      return;
    }

    try {
      setLoading(true);
      setErrorMessage('');
      if (authMode === 'register') {
        await registerWithEmail(email.trim(), password, displayName.trim());
      } else {
        await loginWithEmail(email.trim(), password);
      }
      onSuccess();
      handleClose();
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code || '';
      const msg = err instanceof Error ? err.message : '';

      if (code === 'auth/weak-password' || msg.includes('weak-password')) {
        setErrorMessage('পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে');
      } else if (code === 'auth/email-already-in-use' || msg.includes('email-already-in-use')) {
        setErrorMessage('এই ইমেইল দিয়ে ইতিমধ্যে একটি অ্যাকাউন্ট রয়েছে');
      } else if (code === 'auth/invalid-email' || msg.includes('invalid-email')) {
        setErrorMessage('ইমেইল ঠিকানাটি সঠিক নয়');
      } else if (
        code === 'auth/invalid-credential' ||
        code === 'auth/user-not-found' ||
        code === 'auth/wrong-password' ||
        msg.includes('invalid-credential') ||
        msg.includes('user-not-found') ||
        msg.includes('wrong-password')
      ) {
        setErrorMessage('ইমেইল বা পাসওয়ার্ড সঠিক নয়');
      } else if (code === 'auth/too-many-requests' || msg.includes('too-many-requests')) {
        setErrorMessage('অনেকবার চেষ্টা হয়েছে, কিছুক্ষণ পরে চেষ্টা করুন');
      } else if (code === 'auth/network-request-failed' || msg.includes('network') || msg.includes('fetch')) {
        setErrorMessage('ইন্টারনেট সংযোগ পরীক্ষা করুন');
      } else {
        setErrorMessage(
          authMode === 'register'
            ? 'অ্যাকাউন্ট তৈরি করতে সমস্যা হয়েছে। আবার চেষ্টা করুন।'
            : 'লগইন করতে সমস্যা হয়েছে। আবার চেষ্টা করুন।'
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setErrorMessage('অনুগ্রহ করে আপনার ইমেইল ঠিকানা লিখুন');
      return;
    }

    try {
      setLoading(true);
      setErrorMessage('');
      setSuccessMessage('');
      await resetPassword(email.trim());
      setSuccessMessage('যদি এই ইমেইলে অ্যাকাউন্ট থাকে, পাসওয়ার্ড রিসেটের লিংক পাঠানো হয়েছে। ইনবক্স ও স্প্যাম ফোল্ডার দেখুন।');
      setCountdown(60);
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code || '';
      const msg = err instanceof Error ? err.message : '';

      if (code === 'auth/invalid-email' || msg.includes('invalid-email')) {
        setErrorMessage('ইমেইল ঠিকানাটি সঠিক নয়');
      } else if (code === 'auth/too-many-requests' || msg.includes('too-many-requests')) {
        setErrorMessage('অনেকবার চেষ্টা হয়েছে, কিছুক্ষণ পরে চেষ্টা করুন');
      } else if (code === 'auth/network-request-failed' || msg.includes('network') || msg.includes('fetch')) {
        setErrorMessage('ইন্টারনেট সংযোগ পরীক্ষা করুন');
      } else if (code === 'auth/user-not-found' || msg.includes('user-not-found')) {
        // Security best practice: don't reveal whether user exists
        setSuccessMessage('যদি এই ইমেইলে অ্যাকাউন্ট থাকে, পাসওয়ার্ড রিসেটের লিংক পাঠানো হয়েছে। ইনবক্স ও স্প্যাম ফোল্ডার দেখুন।');
        setCountdown(60);
      } else {
        setErrorMessage('পাসওয়ার্ড রিসেট লিংক পাঠাতে ব্যর্থ হয়েছে। আবার চেষ্টা করুন।');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={handleClose}
          aria-label="বন্ধ করুন"
          className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Brand Lockup with AppLogo */}
        <div className="flex items-center gap-3 mb-5">
          <AppLogo size="lg" showText={false} />
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              {authMode === 'forgot_password'
                ? 'পাসওয়ার্ড রিসেট করুন'
                : authMode === 'register'
                ? 'স্বাস্থ্যবন্ধু অ্যাকাউন্ট তৈরি'
                : 'স্বাস্থ্যবন্ধুতে লগইন'}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {authMode === 'forgot_password'
                ? 'আপনার ইমেইলে পাসওয়ার্ড পরিবর্তনের লিংক পাঠানো হবে'
                : 'ক্লাউড ফায়ারবেস স্টোরেজে সুরক্ষিত ওষুধ ডেটা সিঙ্ক করুন'}
            </p>
          </div>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div className="mb-4 p-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Success Alert */}
        {successMessage && (
          <div className="mb-4 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-300 flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <span className="leading-relaxed">{successMessage}</span>
          </div>
        )}

        {/* FORGOT PASSWORD VIEW */}
        {authMode === 'forgot_password' ? (
          <form onSubmit={handleResetPassword} className="space-y-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                আপনার অ্যাকাউন্টের ইমেইল ঠিকানা
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full pl-9 pr-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-hidden focus:ring-1 focus:ring-teal-500 text-xs sm:text-sm"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || countdown > 0}
              className="w-full py-2.5 bg-teal-700 hover:bg-teal-800 active:bg-teal-900 text-white font-semibold rounded-lg shadow-xs transition-colors cursor-pointer disabled:opacity-50"
            >
              {loading
                ? 'লিংক পাঠানো হচ্ছে...'
                : countdown > 0
                ? `পুনরায় পাঠান (${countdown} সেকেন্ড)`
                : 'রিসেট লিংক পাঠান'}
            </button>

            <div className="text-center pt-2">
              <button
                type="button"
                onClick={() => {
                  setAuthMode('login');
                  setErrorMessage('');
                  setSuccessMessage('');
                }}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-teal-700 dark:hover:text-teal-400 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>← লগইনে ফিরুন</span>
              </button>
            </div>
          </form>
        ) : (
          /* LOGIN & REGISTER VIEW */
          <>
            {/* Google Login (Show in browser, show informative note in native phone app) */}
            {isNative ? (
              <div className="mb-4 p-3 rounded-xl bg-teal-50/80 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800 text-xs text-teal-900 dark:text-teal-200 leading-relaxed">
                <p className="font-semibold mb-0.5">📱 ফোন অ্যাপ নির্দেশনা:</p>
                <p>
                  ফোন অ্যাপে ইমেইল ও পাসওয়ার্ড দিয়ে প্রবেশ করুন। আগে গুগল দিয়ে খুলে থাকলে &apos;পাসওয়ার্ড ভুলে গেছেন?&apos; চেপে একই ইমেইলে পাসওয়ার্ড সেট করে নিন।
                </p>
              </div>
            ) : (
              <>
                <button
                  type="button"
                  onClick={handleGoogleLogin}
                  disabled={loading}
                  className="w-full py-2.5 px-4 mb-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-750 text-slate-800 dark:text-slate-100 rounded-xl font-semibold text-xs flex items-center justify-center gap-2.5 transition-colors shadow-2xs cursor-pointer disabled:opacity-50"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                  <span>গুগল (Google) দিয়ে সহজে প্রবেশ করুন</span>
                </button>

                <div className="relative my-4">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-slate-200 dark:border-slate-800"></div>
                  </div>
                  <div className="relative flex justify-center text-xs">
                    <span className="bg-white dark:bg-slate-900 px-3 text-slate-400">
                      অথবা ইমেইল দিয়ে
                    </span>
                  </div>
                </div>
              </>
            )}

            {/* Email & Password Form */}
            <form onSubmit={handleEmailAuth} className="space-y-3.5 text-xs">
              {authMode === 'register' && (
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    আপনার নাম
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="যেমন: তানভীর করিম"
                      className="w-full pl-9 pr-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-hidden focus:ring-1 focus:ring-teal-500"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  ইমেইল অ্যাড্রেস
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full pl-9 pr-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-hidden focus:ring-1 focus:ring-teal-500"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block font-semibold text-slate-700 dark:text-slate-300">
                    পাসওয়ার্ড
                  </label>
                  {authMode === 'login' && (
                    <button
                      type="button"
                      onClick={() => {
                        setAuthMode('forgot_password');
                        setErrorMessage('');
                        setSuccessMessage('');
                      }}
                      className="text-[11px] font-semibold text-teal-700 dark:text-teal-400 hover:underline cursor-pointer"
                    >
                      পাসওয়ার্ড ভুলে গেছেন?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="কমপক্ষে ৬ অক্ষর"
                    className="w-full pl-9 pr-10 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-hidden focus:ring-1 focus:ring-teal-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'পাসওয়ার্ড লুকান' : 'পাসওয়ার্ড দেখুন'}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {authMode === 'register' && (
                  <p className="text-[11px] text-slate-400 mt-1">পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে</p>
                )}
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-2 py-2.5 bg-teal-700 hover:bg-teal-800 active:bg-teal-900 text-white font-semibold rounded-lg shadow-xs transition-colors cursor-pointer disabled:opacity-50"
              >
                {loading
                  ? 'প্রসেসিং হচ্ছে...'
                  : authMode === 'register'
                  ? 'নতুন অ্যাকাউন্ট খুলুন'
                  : 'লগইন করুন'}
              </button>
            </form>

            {/* Toggle Register vs Login */}
            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 text-center text-xs text-slate-500">
              {authMode === 'register' ? (
                <span>
                  ইতিপূর্বে অ্যাকাউন্ট আছে?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode('login');
                      setErrorMessage('');
                      setSuccessMessage('');
                    }}
                    className="font-bold text-teal-700 dark:text-teal-400 hover:underline cursor-pointer"
                  >
                    লগইন করুন
                  </button>
                </span>
              ) : (
                <span>
                  নতুন ব্যবহারকারী?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode('register');
                      setErrorMessage('');
                      setSuccessMessage('');
                    }}
                    className="font-bold text-teal-700 dark:text-teal-400 hover:underline cursor-pointer"
                  >
                    বিনামূল্যে অ্যাকাউন্ট খুলুন
                  </button>
                </span>
              )}
            </div>
          </>
        )}

        {/* Privacy Note */}
        <div className="mt-4 text-[11px] text-slate-400 text-center flex items-center justify-center gap-1">
          <ShieldCheck className="w-3.5 h-3.5 text-teal-600" />
          <span>আপনার সমস্ত স্বাস্থ্য তথ্য Firestore ক্লাউডে এনক্রিপ্টেড ও সম্পূর্ণ ব্যক্তিগত থাকবে</span>
        </div>
      </div>
    </div>
  );
};
