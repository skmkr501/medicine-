import React, { useState, useEffect } from 'react';
import { supabase, getSupabaseAuthErrorMessageBn } from '../../supabase/client';
import { GOOGLE_LOGIN_ENABLED } from '../../config';
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
    if (!GOOGLE_LOGIN_ENABLED || isNative) {
      return;
    }

    try {
      setLoading(true);
      setErrorMessage('');
      setSuccessMessage('');
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: typeof window !== 'undefined' ? window.location.origin : undefined,
        },
      });
      if (error) {
        setErrorMessage(getSupabaseAuthErrorMessageBn(error, 'oauth'));
      }
    } catch (err: unknown) {
      setErrorMessage(getSupabaseAuthErrorMessageBn(err, 'oauth'));
    } finally {
      setLoading(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedEmail = email.trim();
    const trimmedName = displayName.trim();

    if (!trimmedEmail || !password) {
      setErrorMessage('ইমেইল এবং পাসওয়ার্ড পূরণ করুন');
      return;
    }
    if (authMode === 'register' && !trimmedName) {
      setErrorMessage('অনুগ্রহ করে আপনার পূর্ণ নাম লিখুন');
      return;
    }
    if (authMode === 'register' && password.length < 6) {
      setErrorMessage('পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে');
      return;
    }

    try {
      setLoading(true);
      setErrorMessage('');
      setSuccessMessage('');

      if (authMode === 'register') {
        const { data, error } = await supabase.auth.signUp({
          email: trimmedEmail,
          password,
          options: {
            data: {
              full_name: trimmedName,
            },
          },
        });

        if (error) {
          setErrorMessage(getSupabaseAuthErrorMessageBn(error, 'register'));
          return;
        }

        if (data.session) {
          onSuccess();
          handleClose();
          return;
        }

        if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
          setErrorMessage('এই ইমেইল দিয়ে ইতিমধ্যে একটি অ্যাকাউন্ট রয়েছে');
          return;
        }

        setSuccessMessage('নিবন্ধন সম্পন্ন হয়েছে! অ্যাকাউন্ট সক্রিয় করতে ইমেইলে পাঠানো লিংকে চাপ দিন।');
        return;
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password,
      });

      if (error) {
        setErrorMessage(getSupabaseAuthErrorMessageBn(error, 'login'));
        return;
      }

      if (data.session) {
        onSuccess();
        handleClose();
      }
    } catch (err: unknown) {
      setErrorMessage(
        getSupabaseAuthErrorMessageBn(err, authMode === 'register' ? 'register' : 'login')
      );
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setErrorMessage('অনুগ্রহ করে আপনার ইমেইল ঠিকানা লিখুন');
      return;
    }

    try {
      setLoading(true);
      setErrorMessage('');
      setSuccessMessage('');
      const { error } = await supabase.auth.resetPasswordForEmail(trimmedEmail, {
        redirectTo: typeof window !== 'undefined' ? window.location.origin : undefined,
      });
      if (error) {
        setErrorMessage(getSupabaseAuthErrorMessageBn(error, 'reset'));
        return;
      }
      setSuccessMessage(
        'যদি এই ইমেইলে অ্যাকাউন্ট থাকে, পাসওয়ার্ড রিসেটের লিংক পাঠানো হয়েছে। ইনবক্স ও স্প্যাম ফোল্ডার দেখুন।'
      );
      setCountdown(60);
    } catch (err: unknown) {
      setErrorMessage(getSupabaseAuthErrorMessageBn(err, 'reset'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className="bg-surface border border-border rounded-2xl max-w-md w-full p-6 shadow-2xl relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={handleClose}
          aria-label="বন্ধ করুন"
          className="absolute top-4 right-4 p-1.5 rounded-lg text-text-muted hover:text-text hover:bg-surface-2 cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Brand Lockup with AppLogo */}
        <div className="flex items-center gap-3 mb-5">
          <AppLogo size="lg" showText={false} />
          <div>
            <h2 className="text-lg font-bold text-text">
              {authMode === 'forgot_password'
                ? 'পাসওয়ার্ড রিসেট করুন'
                : authMode === 'register'
                ? 'স্বাস্থ্যবন্ধু অ্যাকাউন্ট তৈরি'
                : 'স্বাস্থ্যবন্ধুতে লগইন'}
            </h2>
            <p className="text-xs text-text-muted">
              {authMode === 'forgot_password'
                ? 'আপনার ইমেইলে পাসওয়ার্ড পরিবর্তনের লিংক পাঠানো হবে'
                : 'ক্লাউডে আপনার ওষুধ ও প্রোফাইলের তথ্য নিরাপদে সংরক্ষণ করুন'}
            </p>
          </div>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div className="mb-4 p-3 rounded-lg bg-danger-soft border border-danger/30 text-xs text-danger-text flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Success Alert */}
        {successMessage && (
          <div className="mb-4 p-3 rounded-lg bg-success-soft border border-success/30 text-xs text-success-text flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-success shrink-0 mt-0.5" />
            <span className="leading-relaxed">{successMessage}</span>
          </div>
        )}

        {/* FORGOT PASSWORD VIEW */}
        {authMode === 'forgot_password' ? (
          <form onSubmit={handleResetPassword} className="space-y-4 text-xs">
            <div>
              <label className="block font-semibold text-text mb-1">
                আপনার অ্যাকাউন্টের ইমেইল ঠিকানা
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full pl-9 pr-3.5 py-2.5 bg-surface-2 border border-border rounded-lg text-text focus:outline-hidden focus:ring-1 focus:ring-primary text-xs sm:text-sm"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || countdown > 0}
              className="w-full py-2.5 bg-primary hover:bg-primary-hover text-on-primary font-semibold rounded-lg shadow-xs transition-colors cursor-pointer disabled:opacity-50"
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
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-text-muted hover:text-primary cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>← লগইনে ফিরুন</span>
              </button>
            </div>
          </form>
        ) : (
          /* LOGIN & REGISTER VIEW */
          <>
            {isNative && (
              <div className="mb-4 p-3 rounded-xl bg-primary-soft border border-primary/25 text-xs text-text leading-relaxed">
                <p className="font-semibold mb-0.5 text-primary">📱 ফোন অ্যাপ নির্দেশনা:</p>
                <p>
                  ফোন অ্যাপে ইমেইল ও পাসওয়ার্ড দিয়ে প্রবেশ করুন। আগে গুগল দিয়ে খুলে থাকলে &apos;পাসওয়ার্ড ভুলে গেছেন?&apos; চেপে একই ইমেইলে পাসওয়ার্ড সেট করে নিন।
                </p>
              </div>
            )}

            {!isNative && (
              <>
                <button
                  type="button"
                  onClick={handleGoogleLogin}
                  disabled={!GOOGLE_LOGIN_ENABLED || loading}
                  aria-disabled={!GOOGLE_LOGIN_ENABLED || loading}
                  className={`w-full py-2.5 px-4 mb-4 border rounded-xl font-semibold text-xs flex items-center justify-between gap-2.5 transition-colors shadow-2xs ${
                    GOOGLE_LOGIN_ENABLED
                      ? 'bg-surface-2 border-border hover:bg-surface text-text cursor-pointer disabled:opacity-50'
                      : 'bg-surface-2/70 border-border text-text-muted opacity-65 cursor-not-allowed'
                  }`}
                >
                  <span className="flex items-center gap-2.5">
                    <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                      <path
                        fill={GOOGLE_LOGIN_ENABLED ? '#4285F4' : '#94A3B8'}
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill={GOOGLE_LOGIN_ENABLED ? '#34A853' : '#94A3B8'}
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill={GOOGLE_LOGIN_ENABLED ? '#FBBC05' : '#94A3B8'}
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                      />
                      <path
                        fill={GOOGLE_LOGIN_ENABLED ? '#EA4335' : '#94A3B8'}
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                      />
                    </svg>
                    <span>Google দিয়ে লগইন</span>
                  </span>
                  {!GOOGLE_LOGIN_ENABLED && (
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-surface border border-border text-text-muted">
                      শীঘ্রই আসছে
                    </span>
                  )}
                </button>

                <div className="relative my-4">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-border"></div>
                  </div>
                  <div className="relative flex justify-center text-xs">
                    <span className="bg-surface px-3 text-text-muted">
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
                  <label className="block font-semibold text-text mb-1">
                    পূর্ণ নাম
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="যেমন: তানভীর করিম"
                      className="w-full pl-9 pr-3.5 py-2 bg-surface-2 border border-border rounded-lg text-text focus:outline-hidden focus:ring-1 focus:ring-primary"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block font-semibold text-text mb-1">
                  ইমেইল অ্যাড্রেস
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full pl-9 pr-3.5 py-2 bg-surface-2 border border-border rounded-lg text-text focus:outline-hidden focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block font-semibold text-text">
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
                      className="text-[11px] font-semibold text-primary hover:underline cursor-pointer"
                    >
                      পাসওয়ার্ড ভুলে গেছেন?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="কমপক্ষে ৬ অক্ষর"
                    className="w-full pl-9 pr-10 py-2 bg-surface-2 border border-border rounded-lg text-text focus:outline-hidden focus:ring-1 focus:ring-primary"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'পাসওয়ার্ড লুকান' : 'পাসওয়ার্ড দেখুন'}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text p-1 cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {authMode === 'register' && (
                  <p className="text-[11px] text-text-muted mt-1">পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে</p>
                )}
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-2 py-2.5 bg-primary hover:bg-primary-hover text-on-primary font-semibold rounded-lg shadow-xs transition-colors cursor-pointer disabled:opacity-50"
              >
                {loading
                  ? 'প্রসেসিং হচ্ছে...'
                  : authMode === 'register'
                  ? 'নতুন অ্যাকাউন্ট খুলুন'
                  : 'লগইন করুন'}
              </button>
            </form>

            {/* Toggle Register vs Login */}
            <div className="mt-4 pt-3 border-t border-border text-center text-xs text-text-muted">
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
                    className="font-bold text-primary hover:underline cursor-pointer"
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
                    className="font-bold text-primary hover:underline cursor-pointer"
                  >
                    বিনামূল্যে অ্যাকাউন্ট খুলুন
                  </button>
                </span>
              )}
            </div>
          </>
        )}

        {/* Privacy Note */}
        <div className="mt-4 text-[11px] text-text-muted text-center flex items-center justify-center gap-1">
          <ShieldCheck className="w-3.5 h-3.5 text-primary" />
          <span>আপনার সমস্ত স্বাস্থ্য তথ্য সুরক্ষিত ও সম্পূর্ণ ব্যক্তিগত থাকবে</span>
        </div>
      </div>
    </div>
  );
};
