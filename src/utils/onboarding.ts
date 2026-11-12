export const ONBOARDING_DONE_KEY = 'shasthobondhu_onboarding_done_v1';

export interface OnboardingStorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function getDefaultStorage(): OnboardingStorageLike | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function shouldShowOnboarding(storage?: OnboardingStorageLike | null): boolean {
  const target = storage === undefined ? getDefaultStorage() : storage;
  if (!target) return false;
  try {
    return target.getItem(ONBOARDING_DONE_KEY) !== '1';
  } catch {
    return false;
  }
}

export function markOnboardingDone(storage?: OnboardingStorageLike | null): void {
  const target = storage === undefined ? getDefaultStorage() : storage;
  if (!target) return;
  try {
    target.setItem(ONBOARDING_DONE_KEY, '1');
  } catch {
    // Ignore storage write errors (e.g., private browsing quota)
  }
}
