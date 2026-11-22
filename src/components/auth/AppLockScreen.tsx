import React, { useEffect, useState } from 'react';
import { Fingerprint, Lock, LogOut, ShieldAlert, Delete } from 'lucide-react';
import {
  AppLockConfig,
  clearAppLockConfig,
  getRemainingLockoutSeconds,
  isPlatformBiometricAvailable,
  normalizePinDigits,
  verifyAppLockPin,
  verifyPlatformBiometric,
} from '../../utils/appLock';
import { toBengaliNumber } from '../../utils/bengaliUtils';

interface AppLockScreenProps {
  config: AppLockConfig;
  onUnlock: () => void;
  onSignOutReset: () => Promise<void>;
}

export const AppLockScreen: React.FC<AppLockScreenProps> = ({
  config,
  onUnlock,
  onSignOutReset,
}) => {
  const [pinInput, setPinInput] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [remainingCooldown, setRemainingCooldown] = useState<number>(() =>
    getRemainingLockoutSeconds(config)
  );
  const [confirmForgotReset, setConfirmForgotReset] = useState(false);
  const [isResettingSignOut, setIsResettingSignOut] = useState(false);

  useEffect(() => {
    let active = true;
    if (config.webAuthnEnabled && config.webAuthnCredentialIdB64) {
      isPlatformBiometricAvailable().then((ok) => {
        if (active) setBiometricAvailable(ok);
      });
    } else {
      setBiometricAvailable(false);
    }
    return () => {
      active = false;
    };
  }, [config.webAuthnEnabled, config.webAuthnCredentialIdB64]);

  useEffect(() => {
    setRemainingCooldown(getRemainingLockoutSeconds(config));
  }, [config]);

  useEffect(() => {
    if (remainingCooldown <= 0) return;
    const timer = window.setInterval(() => {
      setRemainingCooldown((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [remainingCooldown]);

  const handleSubmitPin = async (rawCandidate?: string) => {
    if (isVerifying || remainingCooldown > 0) return;
    const candidate = normalizePinDigits(rawCandidate ?? pinInput);
    if (candidate.length < 4) {
      setErrorMsg('অনুগ্রহ করে আপনার ৪ থেকে ৬ সংখ্যার পিন লিখুন');
      return;
    }

    setIsVerifying(true);
    setErrorMsg(null);
    try {
      const res = await verifyAppLockPin(candidate);
      if (res.ok) {
        setPinInput('');
        onUnlock();
        return;
      }
      setPinInput('');
      if (res.lockedSeconds > 0) {
        setRemainingCooldown(res.lockedSeconds);
        setErrorMsg(
          `অনেকবার ভুল পিন দেওয়া হয়েছে। ${toBengaliNumber(res.lockedSeconds)} সেকেন্ড পরে আবার চেষ্টা করুন।`
        );
      } else {
        setErrorMsg(
          `পিন সঠিক নয় (${toBengaliNumber(res.failedAttempts)}/৫ বার ভুল)`
        );
      }
    } finally {
      setIsVerifying(false);
    }
  };

  const handleKeypadDigit = (digit: string) => {
    if (remainingCooldown > 0 || isVerifying) return;
    setErrorMsg(null);
    const maxLen = Math.max(4, Math.min(6, config.pinLength || 6));
    if (pinInput.length >= 6) return;
    const next = pinInput + digit;
    setPinInput(next);
    if (next.length === maxLen && maxLen === config.pinLength) {
      void handleSubmitPin(next);
    }
  };

  const handleBackspace = () => {
    if (remainingCooldown > 0 || isVerifying) return;
    setErrorMsg(null);
    setPinInput((prev) => prev.slice(0, -1));
  };

  const handleBiometricUnlock = async () => {
    if (!config.webAuthnCredentialIdB64 || isVerifying) return;
    setIsVerifying(true);
    setErrorMsg(null);
    try {
      const ok = await verifyPlatformBiometric(config.webAuthnCredentialIdB64);
      if (ok) {
        onUnlock();
      } else {
        setErrorMsg('বায়োমেট্রিক যাচাই সম্পন্ন হয়নি। অনুগ্রহ করে পিন ব্যবহার করুন।');
      }
    } finally {
      setIsVerifying(false);
    }
  };

  const handleForgotSignOut = async () => {
    setIsResettingSignOut(true);
    try {
      await onSignOutReset();
      clearAppLockConfig();
      onUnlock();
    } finally {
      setIsResettingSignOut(false);
      setConfirmForgotReset(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label="স্বাস্থ্যবন্ধু অ্যাপ লক"
    >
      <div className="w-full max-w-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl p-6 space-y-5">
        <div className="text-center space-y-2">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-teal-50 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-800 flex items-center justify-center text-teal-700 dark:text-teal-300">
            <Lock className="w-7 h-7" />
          </div>
          <h1 className="text-xl font-extrabold text-slate-900 dark:text-slate-100">
            স্বাস্থ্যবন্ধু লক করা আছে
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            খুলতে আপনার {toBengaliNumber(config.pinLength || 4)} সংখ্যার লোকাল পিন দিন
          </p>
        </div>

        {/* PIN input + dot indicator */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void handleSubmitPin();
          }}
          className="space-y-3"
        >
          <div className="flex justify-center gap-2.5 py-1" aria-hidden="true">
            {Array.from({ length: Math.max(4, Math.min(6, config.pinLength || 4)) }).map(
              (_, idx) => (
                <span
                  key={idx}
                  className={`w-3.5 h-3.5 rounded-full border transition-all ${
                    idx < pinInput.length
                      ? 'bg-teal-600 border-teal-600 scale-110 dark:bg-teal-400 dark:border-teal-400'
                      : 'bg-slate-100 border-slate-300 dark:bg-slate-800 dark:border-slate-600'
                  }`}
                />
              )
            )}
          </div>

          <input
            type="password"
            inputMode="numeric"
            autoComplete="off"
            maxLength={6}
            value={pinInput}
            disabled={remainingCooldown > 0 || isVerifying}
            onChange={(e) => {
              setErrorMsg(null);
              setPinInput(normalizePinDigits(e.target.value).slice(0, 6));
            }}
            placeholder="পিন লিখুন (৪-৬ সংখ্যা)"
            aria-label="অ্যাপ লক পিন"
            className="w-full text-center tracking-[0.4em] text-lg font-bold px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500 disabled:opacity-50"
          />

          {remainingCooldown > 0 && (
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs font-bold tabular-nums">
              <ShieldAlert className="w-4 h-4 shrink-0" />
              <span>
                অপেক্ষা করুন: {toBengaliNumber(remainingCooldown)} সেকেন্ড বাকি
              </span>
            </div>
          )}

          {errorMsg && remainingCooldown === 0 && (
            <p className="text-xs font-bold text-rose-600 dark:text-rose-400 text-center">
              {errorMsg}
            </p>
          )}

          {/* Numeric keypad */}
          <div className="grid grid-cols-3 gap-2 pt-1">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
              <button
                key={d}
                type="button"
                disabled={remainingCooldown > 0 || isVerifying}
                onClick={() => handleKeypadDigit(d)}
                className="min-h-[46px] rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-900 dark:text-slate-100 font-bold text-lg transition-colors disabled:opacity-40"
              >
                {toBengaliNumber(d)}
              </button>
            ))}
            <button
              type="button"
              disabled={remainingCooldown > 0 || isVerifying}
              onClick={handleBackspace}
              aria-label="শেষ সংখ্যা মুছুন"
              className="min-h-[46px] rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 flex items-center justify-center transition-colors disabled:opacity-40"
            >
              <Delete className="w-5 h-5" />
            </button>
            <button
              type="button"
              disabled={remainingCooldown > 0 || isVerifying}
              onClick={() => handleKeypadDigit('0')}
              className="min-h-[46px] rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-900 dark:text-slate-100 font-bold text-lg transition-colors disabled:opacity-40"
            >
              ০
            </button>
            <button
              type="submit"
              disabled={remainingCooldown > 0 || isVerifying || pinInput.length < 4}
              className="min-h-[46px] rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-sm transition-colors disabled:opacity-40"
            >
              খুলুন
            </button>
          </div>
        </form>

        {biometricAvailable && config.webAuthnEnabled && config.webAuthnCredentialIdB64 && (
          <button
            type="button"
            disabled={isVerifying}
            onClick={handleBiometricUnlock}
            className="w-full min-h-[44px] flex items-center justify-center gap-2 rounded-xl border border-teal-200 dark:border-teal-800 bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300 text-sm font-bold hover:bg-teal-100 dark:hover:bg-teal-950/70 transition-colors"
          >
            <Fingerprint className="w-4 h-4" />
            বায়োমেট্রিক দিয়ে খুলুন
          </button>
        )}

        <div className="pt-2 border-t border-slate-100 dark:border-slate-800 text-center">
          {!confirmForgotReset ? (
            <button
              type="button"
              onClick={() => setConfirmForgotReset(true)}
              className="text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 underline underline-offset-2"
            >
              পিন ভুলে গেছেন? লগআউট করে আবার লগইন করুন
            </button>
          ) : (
            <div className="space-y-2 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 rounded-xl p-3 text-left">
              <p className="text-xs text-rose-800 dark:text-rose-200 font-medium">
                লগআউট করলে এই ডিভাইসের পিন লক বন্ধ হবে (আপনার ওষুধ ও স্বাস্থ্য তথ্য মুছবে না)। এগিয়ে যাবেন?
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={isResettingSignOut}
                  onClick={handleForgotSignOut}
                  className="flex-1 min-h-[40px] flex items-center justify-center gap-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  হ্যাঁ, লগআউট করুন
                </button>
                <button
                  type="button"
                  disabled={isResettingSignOut}
                  onClick={() => setConfirmForgotReset(false)}
                  className="px-3 min-h-[40px] rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200"
                >
                  বাতিল
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
