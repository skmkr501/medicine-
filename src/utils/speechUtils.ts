import { useEffect, useState, useCallback } from 'react';

export interface VoiceLike {
  lang?: string;
  name?: string;
}

/**
 * Finds a Bengali speech synthesis voice, preferring bn-BD when available.
 */
export function findBengaliVoice<T extends VoiceLike>(voices: T[]): T | null {
  if (!Array.isArray(voices) || voices.length === 0) return null;
  const bnVoices = voices.filter((v) =>
    (v.lang || '').trim().toLowerCase().startsWith('bn')
  );
  if (bnVoices.length === 0) return null;
  const bdVoice = bnVoices.find(
    (v) => (v.lang || '').trim().toLowerCase() === 'bn-bd'
  );
  return bdVoice || bnVoices[0];
}

function getReadableMedicineName(brandName: string): string {
  const trimmed = (brandName || '').trim();
  const parenMatch = trimmed.match(/\(([^)]+)\)/);
  if (parenMatch && /[\u0980-\u09FF]/.test(parenMatch[1])) {
    return parenMatch[1].trim();
  }
  return trimmed;
}

const SLOT_GENITIVE_MAP: Record<string, string> = {
  'সকাল': 'সকালের',
  'দুপুর': 'দুপুরের',
  'সন্ধ্যা': 'সন্ধ্যার',
  'রাত': 'রাতের',
};

export function buildDoseSpeechText(params: {
  timeSlot: string;
  brandName: string;
  dosage: string;
  mealTiming?: string;
}): string {
  const slotWord = SLOT_GENITIVE_MAP[params.timeSlot] || params.timeSlot;
  const readableName = getReadableMedicineName(params.brandName);
  const parts = [
    `এখন ${slotWord} ওষুধ`,
    readableName,
    params.dosage,
    params.mealTiming,
  ].filter((p) => typeof p === 'string' && p.trim().length > 0);
  return parts.join(', ');
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

export function speakBengaliText(text: string): boolean {
  if (
    typeof window === 'undefined' ||
    !('speechSynthesis' in window) ||
    typeof SpeechSynthesisUtterance === 'undefined'
  ) {
    return false;
  }

  try {
    const voices = window.speechSynthesis.getVoices();
    const bengaliVoice = findBengaliVoice(voices);
    if (!bengaliVoice) {
      return false;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.voice = bengaliVoice;
    utterance.lang = bengaliVoice.lang || 'bn-BD';
    utterance.rate = 0.92;
    window.speechSynthesis.speak(utterance);
    return true;
  } catch {
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

  const speak = useCallback((text: string) => {
    return speakBengaliText(text);
  }, []);

  return {
    hasBengaliVoice,
    speak,
    stop: stopBengaliSpeech,
  };
}
