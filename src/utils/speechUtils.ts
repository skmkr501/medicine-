import { useEffect, useState, useCallback, useRef } from 'react';
import { setNativeAlarmVoiceEnabled } from '../services/nativeReminders';

export interface VoiceLike {
  lang?: string;
  name?: string;
  default?: boolean;
}

export type VoiceSpeed = 'slow' | 'normal' | 'fast';

export const VOICE_SPEED_RATE: Record<VoiceSpeed, number> = {
  slow: 0.78,
  normal: 0.95,
  fast: 1.15,
};

export const VOICE_SETTINGS_STORAGE_KEY = 'shasthobondhu_voice_settings_v1';
const VOICE_SETTINGS_CHANGED_EVENT = 'shasthobondhuVoiceSettingsChanged';

export const MISSING_BENGALI_VOICE_MESSAGE =
  'আপনার ফোনে বাংলা ভয়েস নেই। ফোনের সেটিংস → ভাষা → টেক্সট-টু-স্পিচ-এ বাংলা ভয়েস ডাউনলোড করুন';

export interface VoiceSettings {
  enabled: boolean;
  speed: VoiceSpeed;
  confirmOnDoseTaken: boolean;
  apkAlarmVoiceEnabled: boolean;
}

export const DEFAULT_VOICE_SETTINGS: VoiceSettings = {
  enabled: true,
  speed: 'normal',
  confirmOnDoseTaken: false,
  apkAlarmVoiceEnabled: true,
};

export interface StorageLike {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
}

function getDefaultStorage(storage?: StorageLike): StorageLike | null {
  if (storage) return storage;
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function loadVoiceSettings(storage?: StorageLike): VoiceSettings {
  const target = getDefaultStorage(storage);
  if (!target) return { ...DEFAULT_VOICE_SETTINGS };
  try {
    const raw = target.getItem(VOICE_SETTINGS_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_VOICE_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<VoiceSettings>;
    const speed: VoiceSpeed =
      parsed.speed === 'slow' || parsed.speed === 'normal' || parsed.speed === 'fast'
        ? parsed.speed
        : DEFAULT_VOICE_SETTINGS.speed;
    return {
      enabled: typeof parsed.enabled === 'boolean' ? parsed.enabled : DEFAULT_VOICE_SETTINGS.enabled,
      speed,
      confirmOnDoseTaken:
        typeof parsed.confirmOnDoseTaken === 'boolean'
          ? parsed.confirmOnDoseTaken
          : DEFAULT_VOICE_SETTINGS.confirmOnDoseTaken,
      apkAlarmVoiceEnabled:
        typeof parsed.apkAlarmVoiceEnabled === 'boolean'
          ? parsed.apkAlarmVoiceEnabled
          : DEFAULT_VOICE_SETTINGS.apkAlarmVoiceEnabled,
    };
  } catch {
    return { ...DEFAULT_VOICE_SETTINGS };
  }
}

export function saveVoiceSettings(
  patch: Partial<VoiceSettings>,
  storage?: StorageLike
): VoiceSettings {
  const current = loadVoiceSettings(storage);
  const next: VoiceSettings = {
    enabled: typeof patch.enabled === 'boolean' ? patch.enabled : current.enabled,
    speed:
      patch.speed === 'slow' || patch.speed === 'normal' || patch.speed === 'fast'
        ? patch.speed
        : current.speed,
    confirmOnDoseTaken:
      typeof patch.confirmOnDoseTaken === 'boolean'
        ? patch.confirmOnDoseTaken
        : current.confirmOnDoseTaken,
    apkAlarmVoiceEnabled:
      typeof patch.apkAlarmVoiceEnabled === 'boolean'
        ? patch.apkAlarmVoiceEnabled
        : current.apkAlarmVoiceEnabled,
  };

  const target = getDefaultStorage(storage);
  if (target) {
    try {
      target.setItem(VOICE_SETTINGS_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Ignore storage quota/security errors
    }
  }

  if (typeof patch.apkAlarmVoiceEnabled === 'boolean') {
    setNativeAlarmVoiceEnabled(next.apkAlarmVoiceEnabled);
  }

  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
    try {
      window.dispatchEvent(new CustomEvent(VOICE_SETTINGS_CHANGED_EVENT, { detail: next }));
    } catch {
      // Ignore custom event errors
    }
  }

  return next;
}

/**
 * Finds a Bengali speech synthesis voice with strict priority:
 * 1. bn-BD
 * 2. bn-IN
 * 3. Any bn* voice
 * Returns null if no Bengali voice is available on the device.
 */
export function findBengaliVoice<T extends VoiceLike>(voices: T[]): T | null {
  if (!Array.isArray(voices) || voices.length === 0) return null;
  const bnVoices = voices.filter((v) =>
    (v.lang || '').trim().toLowerCase().startsWith('bn')
  );
  if (bnVoices.length === 0) return null;

  const bdVoice = bnVoices.find((v) => {
    const lang = (v.lang || '').trim().toLowerCase();
    return lang === 'bn-bd' || lang.startsWith('bn-bd');
  });
  if (bdVoice) return bdVoice;

  const inVoice = bnVoices.find((v) => {
    const lang = (v.lang || '').trim().toLowerCase();
    return lang === 'bn-in' || lang.startsWith('bn-in');
  });
  if (inVoice) return inVoice;

  return bnVoices[0];
}

export function selectSpeechVoice<T extends VoiceLike>(voices: T[]): {
  voice: T | null;
  isBengali: boolean;
} {
  const bengali = findBengaliVoice(voices);
  if (bengali) {
    return { voice: bengali, isBengali: true };
  }
  if (!Array.isArray(voices) || voices.length === 0) {
    return { voice: null, isBengali: false };
  }
  const fallback = voices.find((v) => v.default) || voices[0] || null;
  return { voice: fallback, isBengali: false };
}

function getReadableMedicineName(brandName: string): string {
  const trimmed = (brandName || '').trim();
  const parenMatch = trimmed.match(/\(([^)]+)\)/);
  if (parenMatch && /[\u0980-\u09FF]/.test(parenMatch[1])) {
    return parenMatch[1].trim();
  }
  return trimmed;
}

const DOSAGE_NUMBER_WORD_MAP: Record<string, string> = {
  '০.৫': 'আধা',
  '0.5': 'আধা',
  '১/২': 'আধা',
  '1/2': 'আধা',
  '১': 'এক',
  '1': 'এক',
  '১.৫': 'দেড়',
  '1.5': 'দেড়',
  '২': 'দুই',
  '2': 'দুই',
  '৩': 'তিন',
  '3': 'তিন',
  '৪': 'চার',
  '4': 'চার',
  '৫': 'পাঁচ',
  '5': 'পাঁচ',
};

function formatDosePhrase(dosage?: string, type?: string): string {
  const cleanDosage = (dosage || '').trim();
  const cleanType = (type || '').trim();
  if (!cleanDosage) return '';

  // Match pattern like "১টি", "1টি", "২টি", "০.৫টি"
  const countMatch = cleanDosage.match(/^([০-৯0-9./]+)\s*টি$/);
  if (countMatch) {
    const word = DOSAGE_NUMBER_WORD_MAP[countMatch[1]] || countMatch[1];
    const unitWord = word === 'আধা' ? 'আধা' : `${word}টি`;
    if (cleanType && cleanType !== 'অন্যান্য') {
      return `${unitWord} ${cleanType}`;
    }
    return unitWord;
  }

  // If dosage is already complete (e.g., "১ চামচ", "৫ মি.লি.", "১ পফ"), keep it natural
  if (cleanType && cleanType !== 'অন্যান্য' && !cleanDosage.includes(cleanType)) {
    // Only append type if dosage looks like a plain number
    if (/^[০-৯0-9./]+$/.test(cleanDosage)) {
      const word = DOSAGE_NUMBER_WORD_MAP[cleanDosage] || cleanDosage;
      return `${word} ${cleanType}`;
    }
  }

  return cleanDosage;
}

function formatMealTimingForSpeech(mealTiming?: string): string {
  const raw = (mealTiming || '').trim();
  if (!raw) return '';
  if (raw === 'খাওয়ার পরে') return 'খাবারের পরে';
  if (raw === 'খাওয়ার আগে') return 'খাবারের আগে';
  if (raw === 'খাওয়ার সাথে') return 'খাবারের সাথে';
  return raw;
}

export function buildDoseSpeechText(params: {
  patientName?: string;
  timeSlot?: string;
  brandName: string;
  dosage?: string;
  type?: string;
  mealTiming?: string;
}): string {
  const patient = (params.patientName || '').trim();
  const readableName = getReadableMedicineName(params.brandName);
  const firstSentence = patient
    ? `${patient}, এখন ${readableName} খাওয়ার সময়।`
    : `এখন ${readableName} খাওয়ার সময়।`;

  const dosePhrase = formatDosePhrase(params.dosage, params.type);
  const mealPhrase = formatMealTimingForSpeech(params.mealTiming);
  const detailParts = [dosePhrase, mealPhrase].filter((p) => p.length > 0);

  if (detailParts.length === 0) {
    return firstSentence;
  }
  return `${firstSentence} ${detailParts.join(', ')}।`;
}

export function buildDoseTakenSpeechText(params: {
  patientName?: string;
  brandName: string;
}): string {
  const patient = (params.patientName || '').trim();
  const readableName = getReadableMedicineName(params.brandName);
  if (patient) {
    return `ভালো হয়েছে, ${patient}, ${readableName} খাওয়া হয়েছে।`;
  }
  return `ভালো হয়েছে, ${readableName} খাওয়া হয়েছে।`;
}

export function buildMedicineDetailSpeechText(params: {
  brandName: string;
  purpose?: string;
  indication?: string;
  therapeuticClass?: string;
  type?: string;
  mealTiming?: string;
  schedules?: Array<{ timeSlot: string; time?: string; dosage: string }>;
  instructions?: string;
}): string {
  const sentences: string[] = [];
  const readableName = getReadableMedicineName(params.brandName);
  sentences.push(`${readableName}।`);

  const usageInfo = (params.purpose || params.indication || params.therapeuticClass || '').trim();
  if (usageInfo) {
    sentences.push(`কী কাজে লাগে: ${usageInfo}।`);
  }

  const howToTakeParts: string[] = [];
  if (Array.isArray(params.schedules) && params.schedules.length > 0) {
    const scheduleTexts = params.schedules
      .map((s) => {
        const dosePhrase = formatDosePhrase(s.dosage, params.type);
        const slot = (s.timeSlot || '').trim();
        if (slot && dosePhrase) return `${slot}বেলা ${dosePhrase}`;
        return dosePhrase || slot;
      })
      .filter((s) => s.length > 0);
    if (scheduleTexts.length > 0) {
      howToTakeParts.push(scheduleTexts.join(', '));
    }
  }

  const mealPhrase = formatMealTimingForSpeech(params.mealTiming);
  if (mealPhrase) {
    howToTakeParts.push(mealPhrase);
  }

  if (howToTakeParts.length > 0) {
    sentences.push(`খাওয়ার নিয়ম: ${howToTakeParts.join(', ')}।`);
  }

  const extraInstructions = (params.instructions || '').trim();
  if (extraInstructions) {
    sentences.push(`সতর্কতা: ${extraInstructions}।`);
  }

  return sentences.join(' ');
}

export function buildGlobalMedicineDetailSpeechText(params: {
  brandName: string;
  genericName?: string;
  strength?: string;
  dosageForm?: string;
  therapeuticClass?: string;
  indication?: string;
  packageDescription?: string;
}): string {
  const sentences: string[] = [];
  const readableName = getReadableMedicineName(params.brandName);
  const strength = (params.strength || '').trim();
  const dosageForm = (params.dosageForm || '').trim();

  const headerParts = [readableName, strength, dosageForm].filter((p) => p.length > 0);
  if (headerParts.length > 0) {
    sentences.push(`${headerParts.join(', ')}।`);
  }

  const indication = (params.indication || '').trim();
  const therapeuticClass = (params.therapeuticClass || '').trim();
  if (indication) {
    sentences.push(`কী কাজে লাগে: ${indication}।`);
  } else if (therapeuticClass) {
    sentences.push(`ওষুধের ধরন: ${therapeuticClass}।`);
  }

  const pack = (params.packageDescription || '').trim();
  if (pack) {
    sentences.push(`প্যাকেটের বিবরণ: ${pack}।`);
  }

  return sentences.join(' ');
}

export function buildAiResponseSpeechText(medicineName: string, rawInfo: string): string {
  const cleaned = (rawInfo || '')
    .replace(/\r\n/g, '\n')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/[*_`#>~|]/g, ' ')
    .replace(/^\s*[-•–—]\s+/gm, '')
    .replace(/\n{2,}/g, '। ')
    .replace(/\n/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();

  const med = getReadableMedicineName(medicineName);
  if (!cleaned) {
    return med ? `${med} সম্পর্কে তথ্য।` : '';
  }
  return med ? `${med} সম্পর্কে তথ্য। ${cleaned}` : cleaned;
}

export function stopBengaliSpeech(): void {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel();
    } catch {
      // Ignore synthesis cancel errors
    }
  }
}

export interface SpeakOptions {
  speed?: VoiceSpeed;
  allowDefaultVoice?: boolean;
  onStart?: () => void;
  onEnd?: () => void;
}

export function speakBengaliText(text: string, options: SpeakOptions = {}): boolean {
  const cleanText = (text || '').trim();
  if (!cleanText) return false;

  if (
    typeof window === 'undefined' ||
    !('speechSynthesis' in window) ||
    typeof SpeechSynthesisUtterance === 'undefined'
  ) {
    return false;
  }

  try {
    const voices = window.speechSynthesis.getVoices();
    const { voice, isBengali } = selectSpeechVoice(voices);
    if (!isBengali && !options.allowDefaultVoice) {
      return false;
    }

    // Ensure two speeches never overlap
    window.speechSynthesis.cancel();

    const activeSettings = loadVoiceSettings();
    const speedKey = options.speed || activeSettings.speed || 'normal';

    const utterance = new SpeechSynthesisUtterance(cleanText);
    if (voice) {
      utterance.voice = voice;
      utterance.lang = voice.lang || 'bn-BD';
    } else {
      utterance.lang = 'bn-BD';
    }
    utterance.rate = VOICE_SPEED_RATE[speedKey] ?? VOICE_SPEED_RATE.normal;

    if (options.onStart) {
      utterance.onstart = () => options.onStart?.();
    }
    if (options.onEnd) {
      utterance.onend = () => options.onEnd?.();
      utterance.onerror = () => options.onEnd?.();
    }

    window.speechSynthesis.speak(utterance);
    return true;
  } catch {
    options.onEnd?.();
    return false;
  }
}

export function useBengaliSpeech() {
  const [hasBengaliVoice, setHasBengaliVoice] = useState<boolean>(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      return false;
    }
    try {
      return findBengaliVoice(window.speechSynthesis.getVoices()) !== null;
    } catch {
      return false;
    }
  });

  const [voiceSettings, setVoiceSettings] = useState<VoiceSettings>(() => loadVoiceSettings());
  const [isSpeaking, setIsSpeaking] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      stopBengaliSpeech();
    };
  }, []);

  useEffect(() => {
    const syncFromStorage = () => {
      if (mountedRef.current) {
        setVoiceSettings(loadVoiceSettings());
      }
    };

    const handleCustomEvent = (e: Event) => {
      const detail = (e as CustomEvent<VoiceSettings>).detail;
      if (mountedRef.current) {
        setVoiceSettings(detail || loadVoiceSettings());
      }
    };

    window.addEventListener(VOICE_SETTINGS_CHANGED_EVENT, handleCustomEvent);
    window.addEventListener('storage', syncFromStorage);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        stopBengaliSpeech();
        if (mountedRef.current) setIsSpeaking(false);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener(VOICE_SETTINGS_CHANGED_EVENT, handleCustomEvent);
      window.removeEventListener('storage', syncFromStorage);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      return;
    }

    const updateVoices = () => {
      try {
        setHasBengaliVoice(findBengaliVoice(window.speechSynthesis.getVoices()) !== null);
      } catch {
        setHasBengaliVoice(false);
      }
    };

    updateVoices();
    const synth = window.speechSynthesis;
    if (typeof synth.addEventListener === 'function') {
      synth.addEventListener('voiceschanged', updateVoices);
      return () => synth.removeEventListener('voiceschanged', updateVoices);
    }

    const previousHandler = synth.onvoiceschanged;
    synth.onvoiceschanged = updateVoices;
    return () => {
      if (synth.onvoiceschanged === updateVoices) {
        synth.onvoiceschanged = previousHandler;
      }
    };
  }, []);

  const updateVoiceSettings = useCallback((patch: Partial<VoiceSettings>) => {
    const next = saveVoiceSettings(patch);
    if (!next.enabled) {
      stopBengaliSpeech();
      if (mountedRef.current) setIsSpeaking(false);
    }
    if (mountedRef.current) {
      setVoiceSettings(next);
    }
    return next;
  }, []);

  const stop = useCallback(() => {
    stopBengaliSpeech();
    if (mountedRef.current) {
      setIsSpeaking(false);
    }
  }, []);

  const speak = useCallback((text: string, options: SpeakOptions = {}) => {
    const started = speakBengaliText(text, {
      ...options,
      onStart: () => {
        if (mountedRef.current) setIsSpeaking(true);
        options.onStart?.();
      },
      onEnd: () => {
        if (mountedRef.current) setIsSpeaking(false);
        options.onEnd?.();
      },
    });
    if (started && mountedRef.current) {
      setIsSpeaking(true);
    }
    return started;
  }, []);

  return {
    hasBengaliVoice,
    isSpeaking,
    voiceSettings,
    updateVoiceSettings,
    speak,
    stop,
  };
}
