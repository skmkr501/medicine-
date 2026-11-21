import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import jsQR from 'jsqr';
import { useMedicine } from '../../context/MedicineContext';
import { generateQrMatrix } from '../../utils/emergencyQr';
import {
  MAX_TRANSFER_CIPHERTEXT_CHARS,
  MAX_TRANSFER_PLAINTEXT_BYTES,
  PhoneTransferBundle,
  buildPhoneTransferBundle,
  buildTransferManualCode,
  buildTransferUrl,
  decryptAndDecompressTransferPayload,
  encryptAndCompressTransferPayload,
  isTransferCryptoSupported,
  parseTransferInput,
} from '../../utils/phoneTransfer';
import {
  consumePhoneTransferInSupabase,
  createPhoneTransferInSupabase,
} from '../../supabase/sharingService';
import { toBengaliNumber } from '../../utils/bengaliUtils';
import {
  AlertTriangle,
  ArrowLeft,
  Camera,
  CameraOff,
  Check,
  CheckCircle2,
  Copy,
  Download,
  ImageUp,
  KeyRound,
  Loader2,
  Lock,
  QrCode,
  RefreshCw,
  ShieldCheck,
  Smartphone,
} from 'lucide-react';

interface BarcodeDetectorResultLike {
  rawValue?: string;
}

interface BarcodeDetectorLike {
  detect: (source: ImageBitmapSource) => Promise<BarcodeDetectorResultLike[]>;
}

interface PhoneTransferPageProps {
  initialTransferInput?: string | null;
  onConsumeInitialInput?: () => void;
}

const TransferQrSvg: React.FC<{ url: string; sizePx?: number }> = ({ url, sizePx = 220 }) => {
  const matrix = useMemo(() => generateQrMatrix(url), [url]);
  const quiet = 2;
  const total = matrix.size + quiet * 2;

  return (
    <svg
      width={sizePx}
      height={sizePx}
      viewBox={`0 0 ${total} ${total}`}
      shapeRendering="crispEdges"
      role="img"
      aria-label="ফোন বদল QR কোড"
      className="rounded-xl border border-slate-200 bg-white shadow-xs"
    >
      <rect x="0" y="0" width={total} height={total} fill="#FFFFFF" />
      {matrix.modules.map((row, rIdx) =>
        row.map((isDark, cIdx) =>
          isDark ? (
            <rect
              key={`${rIdx}-${cIdx}`}
              x={cIdx + quiet}
              y={rIdx + quiet}
              width="1"
              height="1"
              fill="#0F172A"
            />
          ) : null
        )
      )}
    </svg>
  );
};

function formatCountdownBn(remainingMs: number): string {
  const totalSec = Math.max(0, Math.floor(remainingMs / 1000));
  const mm = String(Math.floor(totalSec / 60)).padStart(2, '0');
  const ss = String(totalSec % 60).padStart(2, '0');
  return `${toBengaliNumber(mm)}:${toBengaliNumber(ss)}`;
}

export const PhoneTransferPage: React.FC<PhoneTransferPageProps> = ({
  initialTransferInput,
  onConsumeInitialInput,
}) => {
  const {
    currentUser,
    openAuthModal,
    setCurrentPage,
    medicines,
    patients,
    doseLogs,
    doctors,
    phonebook,
    healthRecords,
    appointments,
    settings,
    downloadLocalBackup,
    applyTransferSnapshot,
    showToast,
  } = useMedicine();

  const [activeTab, setActiveTab] = useState<'send' | 'receive'>(() =>
    initialTransferInput ? 'receive' : 'send'
  );

  // Send Tab State
  const [isGenerating, setIsGenerating] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [generatedSession, setGeneratedSession] = useState<{
    id: string;
    keyB64: string;
    url: string;
    manualCode: string;
    expiresAtMs: number;
    rawBytes: number;
    gzipBytes: number;
  } | null>(null);
  const [remainingMs, setRemainingMs] = useState<number>(0);
  const [copiedField, setCopiedField] = useState<'url' | 'code' | null>(null);

  // Receive Tab State
  const [receiveInput, setReceiveInput] = useState<string>(() => initialTransferInput || '');
  const [isScanningCamera, setIsScanningCamera] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isConsuming, setIsConsuming] = useState(false);
  const [receiveError, setReceiveError] = useState<string | null>(null);
  const [decryptedBundle, setDecryptedBundle] = useState<PhoneTransferBundle | null>(null);
  const [importMode, setImportMode] = useState<'merge' | 'replace'>('merge');
  const [isApplying, setIsApplying] = useState(false);
  const [applySuccessMsg, setApplySuccessMsg] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const qrImageInputRef = useRef<HTMLInputElement | null>(null);

  const cryptoSupported = useMemo(() => isTransferCryptoSupported(), []);

  const currentPayloadSizeBytes = useMemo(() => {
    try {
      const bundle = buildPhoneTransferBundle({
        medicines,
        patients,
        doseLogs,
        doctors,
        phonebook,
        healthRecords,
        appointments,
        settings,
      });
      return new TextEncoder().encode(JSON.stringify(bundle)).byteLength;
    } catch {
      return 0;
    }
  }, [medicines, patients, doseLogs, doctors, phonebook, healthRecords, appointments, settings]);

  const isPayloadOverLimit = currentPayloadSizeBytes > MAX_TRANSFER_PLAINTEXT_BYTES;

  // Countdown tick for generated transfer session
  useEffect(() => {
    if (!generatedSession) {
      setRemainingMs(0);
      return;
    }
    const updateTick = () => {
      setRemainingMs(Math.max(0, generatedSession.expiresAtMs - Date.now()));
    };
    updateTick();
    const timer = setInterval(updateTick, 1000);
    return () => clearInterval(timer);
  }, [generatedSession]);

  // Pre-fill from #/transfer?id=...&k=... deep link
  useEffect(() => {
    if (initialTransferInput) {
      setActiveTab('receive');
      setReceiveInput(initialTransferInput);
      setReceiveError(null);
      onConsumeInitialInput?.();
    }
  }, [initialTransferInput, onConsumeInitialInput]);

  const stopCameraScanner = useCallback(() => {
    if (scanTimerRef.current) {
      clearTimeout(scanTimerRef.current);
      scanTimerRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsScanningCamera(false);
  }, []);

  useEffect(() => {
    return () => {
      stopCameraScanner();
    };
  }, [stopCameraScanner]);

  useEffect(() => {
    if (activeTab !== 'receive') {
      stopCameraScanner();
    }
  }, [activeTab, stopCameraScanner]);

  const handleCopyText = async (text: string, field: 'url' | 'code') => {
    try {
      if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        await navigator.clipboard.writeText(text);
      } else {
        const input = document.createElement('input');
        input.value = text;
        document.body.appendChild(input);
        input.select();
        document.execCommand('copy');
        input.remove();
      }
      setCopiedField(field);
      showToast(field === 'url' ? 'ট্রান্সফার লিংক কপি হয়েছে' : 'কোড কপি হয়েছে', 'success');
      setTimeout(() => setCopiedField((c) => (c === field ? null : c)), 2500);
    } catch {
      showToast('কপি করা যায়নি — নিচের বক্স থেকে কপি করুন', 'info');
    }
  };

  const handleGenerateQr = async () => {
    if (!currentUser) {
      openAuthModal();
      return;
    }
    setSendError(null);
    setIsGenerating(true);
    try {
      const bundle = buildPhoneTransferBundle({
        medicines,
        patients,
        doseLogs,
        doctors,
        phonebook,
        healthRecords,
        appointments,
        settings,
      });
      const encrypted = await encryptAndCompressTransferPayload(bundle);
      if (encrypted.ciphertext.length > MAX_TRANSFER_CIPHERTEXT_CHARS) {
        throw new Error('ডেটার আকার নির্ধারিত সীমার চেয়ে বড় — JSON ব্যাকআপ ব্যবহার করুন।');
      }
      const created = await createPhoneTransferInSupabase(encrypted.ciphertext);
      const url = buildTransferUrl(created.id, encrypted.keyB64);
      const manualCode = buildTransferManualCode(created.id, encrypted.keyB64);
      const expiresAtMs = Date.parse(created.expiresAt) || Date.now() + 10 * 60 * 1000;

      setGeneratedSession({
        id: created.id,
        keyB64: encrypted.keyB64,
        url,
        manualCode,
        expiresAtMs,
        rawBytes: encrypted.rawBytes,
        gzipBytes: encrypted.gzipBytes,
      });
      showToast('নিরাপদ QR কোড তৈরি হয়েছে (১০ মিনিট মেয়াদ)', 'success');
    } catch (err: any) {
      const msg = err?.message || 'ট্রান্সফার QR কোড তৈরি করা যায়নি।';
      setSendError(msg);
      showToast(msg, 'alert');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleFetchAndDecrypt = useCallback(
    async (rawInputToParse: string) => {
      if (!currentUser) {
        openAuthModal();
        return;
      }
      const parsed = parseTransferInput(rawInputToParse);
      if (!parsed) {
        setReceiveError('লিংক বা কোডটির গঠন সঠিক নয়। পুরো লিংক বা <id>.<key> কোড দিন।');
        return;
      }

      setReceiveError(null);
      setApplySuccessMsg(null);
      setDecryptedBundle(null);
      setIsConsuming(true);
      try {
        const ciphertext = await consumePhoneTransferInSupabase(parsed.id);
        if (!ciphertext) {
          setReceiveError('এই ট্রান্সফার কোডের মেয়াদ (১০ মিনিট) শেষ হয়েছে অথবা আগেই একবার ব্যবহার হয়ে গেছে।');
          return;
        }
        const bundle = await decryptAndDecompressTransferPayload(ciphertext, parsed.keyB64);
        setDecryptedBundle(bundle);
        showToast('ডেটা সফলভাবে যাচাই ও ডিক্রিপ্ট হয়েছে — নিচে সংরক্ষণ পদ্ধতি বেছে নিন', 'success');
      } catch (err: any) {
        const msg = err?.message || 'ট্রান্সফার ডেটা পড়া বা ডিক্রিপ্ট করা যায়নি।';
        setReceiveError(msg);
        showToast(msg, 'alert');
      } finally {
        setIsConsuming(false);
      }
    },
    [currentUser, openAuthModal, showToast]
  );

  const startCameraScanner = async () => {
    setCameraError(null);
    setReceiveError(null);

    if (
      typeof navigator === 'undefined' ||
      !navigator.mediaDevices ||
      typeof navigator.mediaDevices.getUserMedia !== 'function'
    ) {
      setCameraError('এই ব্রাউজারে ক্যামেরা স্ক্যানার সমর্থিত নয় — QR ছবি আপলোড করুন বা কোড লিখুন।');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      });
      streamRef.current = stream;
      setIsScanningCamera(true);

      // Wait a tick for video element to mount
      setTimeout(() => {
        const video = videoRef.current;
        if (!video || !streamRef.current) return;
        video.srcObject = streamRef.current;
        void video.play().catch(() => {});

        const DetectorCtor = (
          window as unknown as {
            BarcodeDetector?: new (opts: { formats: string[] }) => BarcodeDetectorLike;
          }
        ).BarcodeDetector;
        const detector = DetectorCtor ? new DetectorCtor({ formats: ['qr_code'] }) : null;
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        const scanFrame = async () => {
          if (!streamRef.current || !videoRef.current) return;
          const v = videoRef.current;
          if (v.readyState >= 2 && v.videoWidth > 0 && v.videoHeight > 0) {
            let detectedText = '';
            if (detector) {
              try {
                const hits = await detector.detect(v);
                if (hits && hits.length > 0 && hits[0]?.rawValue) {
                  detectedText = hits[0].rawValue;
                }
              } catch {
                // fallback below
              }
            }
            if (!detectedText && ctx) {
              canvas.width = v.videoWidth;
              canvas.height = v.videoHeight;
              ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
              const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
              const qr = jsQR(imgData.data, canvas.width, canvas.height);
              if (qr?.data) {
                detectedText = qr.data;
              }
            }

            if (detectedText && parseTransferInput(detectedText)) {
              stopCameraScanner();
              setReceiveInput(detectedText);
              void handleFetchAndDecrypt(detectedText);
              return;
            }
          }
          scanTimerRef.current = setTimeout(scanFrame, 180);
        };

        scanTimerRef.current = setTimeout(scanFrame, 250);
      }, 60);
    } catch {
      setCameraError('ক্যামেরা চালু করা যায়নি বা অনুমতি দেওয়া হয়নি। QR স্ক্রিনশট ছবি আপলোড করুন অথবা নিচে কোড লিখুন।');
      stopCameraScanner();
    }
  };

  const handleQrImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setReceiveError(null);
    setCameraError(null);
    try {
      const bitmap = await createImageBitmap(file);
      const canvas = document.createElement('canvas');
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('ক্যানভাস তৈরি করা যায়নি।');
      ctx.drawImage(bitmap, 0, 0);
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imgData.data, canvas.width, canvas.height);
      if (!code?.data) {
        setReceiveError('ছবিটিতে কোনো স্পষ্ট QR কোড পাওয়া যায়নি। অনুগ্রহ করে পরিষ্কার ছবি দিন বা কোড লিখুন।');
        return;
      }
      setReceiveInput(code.data);
      await handleFetchAndDecrypt(code.data);
    } catch (err: any) {
      setReceiveError(err?.message || 'ছবি থেকে QR কোড পড়া যায়নি।');
    }
  };

  const handleApplyImportedBundle = async () => {
    if (!decryptedBundle) return;
    setIsApplying(true);
    try {
      const res = await applyTransferSnapshot(decryptedBundle, importMode);
      if (res.ok) {
        setApplySuccessMsg(res.message);
        setDecryptedBundle(null);
      } else {
        setReceiveError(res.message);
      }
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setCurrentPage('me')}
            aria-label="ফিরে যান"
            className="min-h-[48px] min-w-[48px] flex items-center justify-center rounded-xl bg-surface border border-border text-text hover:bg-surface-2 cursor-pointer"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-text flex items-center gap-2">
              <Smartphone className="w-6 h-6 text-primary" />
              <span>ফোন বদল / QR ট্রান্সফার</span>
            </h1>
            <p className="text-sm text-text-muted mt-0.5">
              পুরনো ফোন থেকে নতুন ফোনে এন্ড-টু-এন্ড এনক্রিপ্টেড ডেটা স্থানান্তর করুন (একবার ব্যবহারযোগ্য, ১০ মিনিট মেয়াদ)
            </p>
          </div>
        </div>
      </div>

      {/* Mode Tabs */}
      <div className="grid grid-cols-2 gap-2 p-1.5 bg-surface-2 border border-border rounded-2xl">
        <button
          type="button"
          onClick={() => setActiveTab('send')}
          className={`min-h-[48px] px-4 py-2.5 rounded-xl font-bold text-sm sm:text-base transition-colors cursor-pointer ${
            activeTab === 'send'
              ? 'bg-primary text-on-primary shadow-xs'
              : 'text-text hover:bg-surface'
          }`}
        >
          পুরনো ফোন থেকে পাঠান
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('receive')}
          className={`min-h-[48px] px-4 py-2.5 rounded-xl font-bold text-sm sm:text-base transition-colors cursor-pointer ${
            activeTab === 'receive'
              ? 'bg-primary text-on-primary shadow-xs'
              : 'text-text hover:bg-surface'
          }`}
        >
          নতুন ফোনে নিন
        </button>
      </div>

      {/* Privacy & Photo Scope Notice */}
      <div className="p-4 rounded-2xl bg-primary-soft border border-primary/25 flex items-start gap-3 text-sm">
        <ShieldCheck className="w-5 h-5 text-primary shrink-0 mt-0.5" />
        <div className="space-y-1 text-text">
          <p className="font-bold">এনক্রিপশন ও তথ্যের সীমা</p>
          <p className="text-text-muted leading-relaxed">
            আপনার ওষুধ, রোগী প্রোফাইল, ডোজ লগ, ডাক্তার, জরুরি ফোনবুক, স্বাস্থ্য রেকর্ড, অ্যাপয়েন্টমেন্ট ও সেটিংস ব্রাউজারেই এনক্রিপ্ট হয়ে যাবে — এনক্রিপশন চাবিটি শুধু QR বা লিংকে থাকে। <strong>প্রেসক্রিপশন ও রিপোর্টের ছবি QR ট্রান্সফারে যাবে না</strong> (একই অ্যাকাউন্টে লগইন করলে সেগুলো আলাদাভাবে ক্লাউড থেকে আসবে)।
          </p>
        </div>
      </div>

      {!currentUser ? (
        <section className="bg-surface border border-border rounded-2xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-text">ফোন বদল ব্যবহার করতে লগইন প্রয়োজন</h2>
            <p className="text-sm text-text-muted mt-1">
              নিরাপদ এনক্রিপ্টেড ট্রান্সফার সেশন তৈরি ও গ্রহণ করতে অনুগ্রহ করে লগইন করুন।
            </p>
          </div>
          <button
            type="button"
            onClick={openAuthModal}
            className="min-h-[48px] px-5 py-2.5 bg-primary hover:bg-primary-hover text-on-primary font-bold text-base rounded-xl inline-flex items-center gap-2 cursor-pointer shrink-0"
          >
            <Lock className="w-4 h-4" />
            <span>লগইন করুন</span>
          </button>
        </section>
      ) : activeTab === 'send' ? (
        <section className="bg-surface border border-border rounded-2xl p-5 sm:p-6 shadow-xs space-y-5">
          {/* Summary counts */}
          <div className="p-4 rounded-xl bg-surface-2 border border-border space-y-2">
            <p className="text-sm font-bold text-text">এই ফোন থেকে যা পাঠানো হবে:</p>
            <p className="text-sm text-text-muted">
              রোগী {toBengaliNumber(patients.length)}জন · ওষুধ {toBengaliNumber(medicines.length)}টি · ডোজ লগ {toBengaliNumber(doseLogs.length)}টি · ডাক্তার {toBengaliNumber(doctors.length)}জন · ফোনবুক {toBengaliNumber(phonebook.length)}টি · স্বাস্থ্য রেকর্ড {toBengaliNumber(healthRecords.length)}টি · অ্যাপয়েন্টমেন্ট {toBengaliNumber(appointments.length)}টি
            </p>
            <p className="text-xs text-text-muted">
              মোট আকার: প্রায় {toBengaliNumber(Math.max(1, Math.round(currentPayloadSizeBytes / 1024)))} KB (সীমা: ১,২০০ KB)
            </p>
          </div>

          {(!cryptoSupported || isPayloadOverLimit) && (
            <div className="p-4 rounded-xl bg-warning-soft border border-warning/35 space-y-3">
              <div className="flex items-start gap-2.5 text-warning-text">
                <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                <p className="text-sm font-bold">
                  {!cryptoSupported
                    ? 'এই ব্রাউজারে WebCrypto/Gzip সমর্থন নেই — অনুগ্রহ করে JSON ব্যাকআপ ফাইল ব্যবহার করুন।'
                    : 'আপনার ডেটার আকার QR ট্রান্সফারের ১.২ এমবি সীমার চেয়ে বড় — JSON ব্যাকআপ ফাইল ডাউনলোড করে নিন।'}
                </p>
              </div>
              <button
                type="button"
                onClick={downloadLocalBackup}
                className="min-h-[48px] px-4 py-2 rounded-xl bg-surface border border-warning/40 text-text font-bold text-sm inline-flex items-center gap-2 cursor-pointer"
              >
                <Download className="w-4 h-4 text-primary" />
                <span>JSON ব্যাকআপ ডাউনলোড করুন</span>
              </button>
            </div>
          )}

          {sendError && (
            <div
              role="alert"
              className="p-4 rounded-xl bg-danger-soft border border-danger/30 text-danger-text text-sm font-semibold flex items-start gap-2"
            >
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{sendError}</span>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={isGenerating || !cryptoSupported || isPayloadOverLimit}
              onClick={handleGenerateQr}
              className="min-h-[48px] px-6 py-2.5 rounded-xl bg-primary hover:bg-primary-hover disabled:opacity-50 text-on-primary font-bold text-base inline-flex items-center gap-2 cursor-pointer"
            >
              {isGenerating ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <QrCode className="w-5 h-5" />
              )}
              <span>
                {generatedSession ? 'নতুন QR কোড তৈরি করুন' : 'QR কোড তৈরি করুন'}
              </span>
            </button>

            <button
              type="button"
              onClick={downloadLocalBackup}
              className="min-h-[48px] px-4 py-2.5 rounded-xl bg-surface-2 hover:bg-border/60 text-text font-bold text-sm inline-flex items-center gap-2 cursor-pointer"
            >
              <Download className="w-4 h-4 text-primary" />
              <span>JSON ব্যাকআপ ডাউনলোড</span>
            </button>
          </div>

          {generatedSession && (
            <div className="p-5 rounded-2xl border border-primary/30 bg-surface-2 space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-base font-bold text-text">
                  নতুন ফোন দিয়ে নিচের QR কোডটি স্ক্যান করুন
                </p>
                <span
                  className={`text-sm font-bold font-mono tabular-nums ${
                    remainingMs > 0 ? 'text-primary' : 'text-danger-text'
                  }`}
                >
                  {remainingMs > 0
                    ? `বাকি সময়: ${formatCountdownBn(remainingMs)}`
                    : 'মেয়াদ শেষ — নতুন কোড তৈরি করুন'}
                </span>
              </div>

              <div className="flex flex-col md:flex-row items-center gap-6">
                <div className="shrink-0">
                  <TransferQrSvg url={generatedSession.url} sizePx={220} />
                </div>

                <div className="flex-1 w-full space-y-4">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-text-muted">
                      ট্রান্সফার লিংক
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        readOnly
                        value={generatedSession.url}
                        onFocus={(e) => e.currentTarget.select()}
                        className="min-h-[44px] flex-1 px-3 py-2 rounded-xl bg-surface border border-border text-xs font-mono text-text"
                      />
                      <button
                        type="button"
                        onClick={() => handleCopyText(generatedSession.url, 'url')}
                        className="min-h-[44px] px-3.5 py-2 rounded-xl bg-surface border border-border hover:border-primary text-text font-bold text-xs inline-flex items-center gap-1.5 cursor-pointer shrink-0"
                      >
                        {copiedField === 'url' ? <Check className="w-4 h-4 text-success-text" /> : <Copy className="w-4 h-4 text-primary" />}
                        <span>কপি</span>
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-text-muted">
                      ম্যানুয়াল কোড (স্ক্যান না হলে নতুন ফোনে লিখুন)
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        readOnly
                        value={generatedSession.manualCode}
                        onFocus={(e) => e.currentTarget.select()}
                        className="min-h-[44px] flex-1 px-3 py-2 rounded-xl bg-surface border border-border text-xs font-mono text-text"
                      />
                      <button
                        type="button"
                        onClick={() => handleCopyText(generatedSession.manualCode, 'code')}
                        className="min-h-[44px] px-3.5 py-2 rounded-xl bg-surface border border-border hover:border-primary text-text font-bold text-xs inline-flex items-center gap-1.5 cursor-pointer shrink-0"
                      >
                        {copiedField === 'code' ? <Check className="w-4 h-4 text-success-text" /> : <Copy className="w-4 h-4 text-primary" />}
                        <span>কপি</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </section>
      ) : (
        /* RECEIVE TAB */
        <section className="bg-surface border border-border rounded-2xl p-5 sm:p-6 shadow-xs space-y-5">
          {applySuccessMsg && (
            <div className="p-4 rounded-xl bg-success-soft border border-success/35 text-success-text flex items-center gap-2.5 font-bold">
              <CheckCircle2 className="w-5 h-5 shrink-0" />
              <span>{applySuccessMsg}</span>
            </div>
          )}

          {/* Camera & Upload triggers */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={isScanningCamera ? stopCameraScanner : startCameraScanner}
              className={`min-h-[52px] px-4 py-3 rounded-xl font-bold text-sm sm:text-base flex items-center justify-center gap-2 cursor-pointer border transition-colors ${
                isScanningCamera
                  ? 'bg-danger-soft border-danger/30 text-danger-text'
                  : 'bg-primary hover:bg-primary-hover border-primary text-on-primary'
              }`}
            >
              {isScanningCamera ? (
                <>
                  <CameraOff className="w-5 h-5" />
                  <span>ক্যামেরা বন্ধ করুন</span>
                </>
              ) : (
                <>
                  <Camera className="w-5 h-5" />
                  <span>ক্যামেরা দিয়ে QR স্ক্যান করুন</span>
                </>
              )}
            </button>

            <input
              ref={qrImageInputRef}
              type="file"
              accept="image/*"
              onChange={handleQrImageUpload}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => qrImageInputRef.current?.click()}
              className="min-h-[52px] px-4 py-3 rounded-xl bg-surface-2 hover:bg-border/60 border border-border text-text font-bold text-sm sm:text-base flex items-center justify-center gap-2 cursor-pointer"
            >
              <ImageUp className="w-5 h-5 text-primary" />
              <span>QR স্ক্রিনশট/ছবি থেকে পড়ুন</span>
            </button>
          </div>

          {cameraError && (
            <div className="p-3.5 rounded-xl bg-warning-soft border border-warning/35 text-warning-text text-sm font-semibold">
              {cameraError}
            </div>
          )}

          {isScanningCamera && (
            <div className="rounded-2xl overflow-hidden border border-border bg-black relative">
              <video
                ref={videoRef}
                playsInline
                muted
                className="w-full max-h-[320px] object-cover"
              />
              <p className="text-xs text-center text-white bg-black/75 py-2">
                পুরনো ফোনের QR কোডটি ক্যামেরার সামনে ধরুন…
              </p>
            </div>
          )}

          {/* Manual code / link paste */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void handleFetchAndDecrypt(receiveInput);
            }}
            className="space-y-2.5 pt-2 border-t border-border"
          >
            <label className="block text-sm font-bold text-text flex items-center gap-1.5">
              <KeyRound className="w-4 h-4 text-primary" />
              <span>অথবা লিংক / ম্যানুয়াল কোড লিখুন</span>
            </label>
            <div className="flex flex-col sm:flex-row gap-2.5">
              <input
                type="text"
                value={receiveInput}
                onChange={(e) => {
                  setReceiveInput(e.target.value);
                  setReceiveError(null);
                }}
                placeholder="লিংক বা কোড (যেমন: uuid.key)"
                className="min-h-[48px] flex-1 px-4 py-2 rounded-xl bg-surface-2 border border-border font-mono text-sm text-text focus:outline-hidden focus:border-primary"
              />
              <button
                type="submit"
                disabled={isConsuming || !receiveInput.trim()}
                className="min-h-[48px] px-5 py-2.5 rounded-xl bg-primary hover:bg-primary-hover disabled:opacity-50 text-on-primary font-bold text-sm sm:text-base inline-flex items-center justify-center gap-2 cursor-pointer shrink-0"
              >
                {isConsuming ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>আনা হচ্ছে...</span>
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4" />
                    <span>ডেটা যাচাই করুন</span>
                  </>
                )}
              </button>
            </div>
          </form>

          {receiveError && (
            <div
              role="alert"
              className="p-4 rounded-xl bg-danger-soft border border-danger/30 text-danger-text text-sm font-semibold flex items-start gap-2"
            >
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{receiveError}</span>
            </div>
          )}

          {/* Preview & Import Choice */}
          {decryptedBundle && (
            <div className="p-5 rounded-2xl border-2 border-primary/40 bg-primary-soft/40 space-y-4">
              <div>
                <h2 className="text-lg font-bold text-text">
                  প্রাপ্ত ডেটার বিবরণ (ডিক্রিপ্ট সম্পন্ন ✓)
                </h2>
                <p className="text-sm text-text-muted mt-1">
                  রোগী {toBengaliNumber(decryptedBundle.patients?.length || 0)}জন · ওষুধ{' '}
                  {toBengaliNumber(decryptedBundle.medicines?.length || 0)}টি · ডোজ লগ{' '}
                  {toBengaliNumber(decryptedBundle.doseLogs?.length || 0)}টি · ডাক্তার{' '}
                  {toBengaliNumber(decryptedBundle.doctors?.length || 0)}জন · ফোনবুক{' '}
                  {toBengaliNumber(decryptedBundle.phonebook?.length || 0)}টি · স্বাস্থ্য রেকর্ড{' '}
                  {toBengaliNumber(decryptedBundle.healthRecords?.length || 0)}টি · অ্যাপয়েন্টমেন্ট{' '}
                  {toBengaliNumber(decryptedBundle.appointments?.length || 0)}টি
                </p>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-bold text-text">কীভাবে সংরক্ষণ করবেন?</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setImportMode('merge')}
                    className={`min-h-[56px] p-3.5 rounded-xl border text-left cursor-pointer transition-colors ${
                      importMode === 'merge'
                        ? 'bg-primary text-on-primary border-primary'
                        : 'bg-surface border-border text-text hover:border-primary/40'
                    }`}
                  >
                    <span className="block font-bold text-sm">
                      আগের ডেটার সাথে মিলিয়ে নেবে (ডিফল্ট)
                    </span>
                    <span
                      className={`block text-xs mt-0.5 ${
                        importMode === 'merge' ? 'text-on-primary/90' : 'text-text-muted'
                      }`}
                    >
                      এই ফোনের ডেটা রেখে নতুনগুলো যোগ করবে
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setImportMode('replace')}
                    className={`min-h-[56px] p-3.5 rounded-xl border text-left cursor-pointer transition-colors ${
                      importMode === 'replace'
                        ? 'bg-danger text-white border-danger'
                        : 'bg-surface border-border text-text hover:border-danger/40'
                    }`}
                  >
                    <span className="block font-bold text-sm">
                      সব মুছে নতুন করে বসাবে
                    </span>
                    <span
                      className={`block text-xs mt-0.5 ${
                        importMode === 'replace' ? 'text-white/90' : 'text-text-muted'
                      }`}
                    >
                      পুরনো ফোনের হুবহু কপি এই ফোনে বসাবে
                    </span>
                  </button>
                </div>
              </div>

              <button
                type="button"
                disabled={isApplying}
                onClick={handleApplyImportedBundle}
                className="min-h-[48px] w-full sm:w-auto px-6 py-3 rounded-xl bg-primary hover:bg-primary-hover disabled:opacity-60 text-on-primary font-bold text-base inline-flex items-center justify-center gap-2 cursor-pointer"
              >
                {isApplying ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>সংরক্ষণ হচ্ছে...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-5 h-5" />
                    <span>ডেটা ফোনে সংরক্ষণ করুন</span>
                  </>
                )}
              </button>
            </div>
          )}
        </section>
      )}
    </div>
  );
};
