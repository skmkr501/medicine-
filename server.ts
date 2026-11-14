import express from 'express';
import { GoogleGenAI, Type } from '@google/genai';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import {
  extractBearerToken,
  verifyFirebaseIdToken,
  isVerifiedAdmin,
  UserAiRateLimiter,
  formatSafeAiErrorLog,
  UNAUTH_ERROR_MSG,
  FORBIDDEN_ADMIN_MSG,
  type VerifiedFirebaseUser,
} from './server/aiSecurity.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function loadFirebaseProjectId(): string {
  if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_PROJECT_ID.trim()) {
    return process.env.FIREBASE_PROJECT_ID.trim();
  }
  try {
    const raw = fs.readFileSync(path.resolve(__dirname, 'firebase-applet-config.json'), 'utf8');
    const parsed = JSON.parse(raw);
    if (typeof parsed?.projectId === 'string' && parsed.projectId.trim()) {
      return parsed.projectId.trim();
    }
  } catch (err: any) {
    console.warn('Could not read firebase-applet-config.json:', err?.message || 'unknown');
  }
  return '';
}

const FIREBASE_PROJECT_ID = loadFirebaseProjectId();
const aiRateLimiter = new UserAiRateLimiter();

interface AuthenticatedRequest extends express.Request {
  verifiedUser?: VerifiedFirebaseUser;
}

async function requireFirebaseAuth(
  req: AuthenticatedRequest,
  res: express.Response,
  next: express.NextFunction
) {
  const token = extractBearerToken(req.headers.authorization);
  if (!token || !FIREBASE_PROJECT_ID) {
    return res.status(401).json({
      error: UNAUTH_ERROR_MSG,
      errorStatus: 401,
    });
  }

  try {
    const verifiedUser = await verifyFirebaseIdToken(token, FIREBASE_PROJECT_ID);
    req.verifiedUser = verifiedUser;
    return next();
  } catch {
    return res.status(401).json({
      error: UNAUTH_ERROR_MSG,
      errorStatus: 401,
    });
  }
}

async function requireAdminAuth(
  req: AuthenticatedRequest,
  res: express.Response,
  next: express.NextFunction
) {
  const token = extractBearerToken(req.headers.authorization);
  if (!token || !FIREBASE_PROJECT_ID) {
    return res.status(401).json({
      error: UNAUTH_ERROR_MSG,
      errorStatus: 401,
    });
  }

  try {
    const verifiedUser = await verifyFirebaseIdToken(token, FIREBASE_PROJECT_ID);
    if (!isVerifiedAdmin(verifiedUser)) {
      return res.status(403).json({
        error: FORBIDDEN_ADMIN_MSG,
        errorStatus: 403,
      });
    }
    req.verifiedUser = verifiedUser;
    return next();
  } catch {
    return res.status(401).json({
      error: UNAUTH_ERROR_MSG,
      errorStatus: 401,
    });
  }
}

function rateLimitAi(isScan: boolean) {
  return (req: AuthenticatedRequest, res: express.Response, next: express.NextFunction) => {
    const uid = req.verifiedUser?.uid;
    if (!uid) {
      return res.status(401).json({
        error: UNAUTH_ERROR_MSG,
        errorStatus: 401,
      });
    }

    const rateResult = aiRateLimiter.checkAndConsume(uid, isScan);
    if (!rateResult.allowed) {
      res.setHeader('Retry-After', String(rateResult.retryAfterSeconds));
      return res.status(429).json({
        error: rateResult.message,
        errorStatus: 429,
      });
    }

    return next();
  };
}

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

// Server-side initialization of GoogleGenAI
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

const MANDATORY_DISCLAIMER = 'এটি সাধারণ তথ্য, ডাক্তারের পরামর্শের বিকল্প নয়।';
const GEMINI_MODEL = 'gemini-3.8-flash';

/**
 * Extracts numeric HTTP/gRPC status code from GoogleGenAI errors
 */
function extractErrorStatus(error: any): number | null {
  if (!error) return null;
  if (typeof error.status === 'number') return error.status;
  if (typeof error.statusCode === 'number') return error.statusCode;
  if (typeof error.code === 'number') return error.code;
  if (typeof error.response?.status === 'number') return error.response.status;
  if (typeof error.error?.code === 'number') return error.error.code;
  if (typeof error.error?.status === 'number') return error.error.status;

  const msg = String(error.message || error || '');
  if (msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED')) return 429;
  if (
    msg.includes('401') ||
    msg.includes('UNAUTHENTICATED') ||
    msg.toLowerCase().includes('api key') ||
    msg.toLowerCase().includes('api_key')
  ) {
    return 401;
  }
  if (msg.includes('403') || msg.includes('PERMISSION_DENIED')) return 403;
  if (msg.includes('404') || msg.includes('NOT_FOUND')) return 404;

  return null;
}

/**
 * Strips secrets, API keys, or long stacktraces from error messages, max 200 characters
 */
function sanitizeErrorMessage(rawMsg: string): string {
  if (!rawMsg) return '';
  let sanitized = String(rawMsg)
    .replace(/AIza[0-9A-Za-z-_]{35}/g, '[REDACTED_KEY]')
    .replace(/key=[^&\s]+/gi, 'key=[REDACTED]')
    .replace(/Bearer\s+[a-zA-Z0-9._-]+/gi, 'Bearer [REDACTED]')
    .replace(/\s+/g, ' ')
    .trim();

  if (sanitized.length > 200) {
    sanitized = sanitized.slice(0, 197) + '...';
  }
  return sanitized;
}

/**
 * Maps error status to localized Bengali error message:
 * - 429 / RESOURCE_EXHAUSTED -> "AI সেবায় এখন অনেক চাপ, ১ মিনিট পরে চেষ্টা করুন।"
 * - 401/403 / API key error -> "AI সেবা এখন চালু করা নেই। অ্যাডমিনকে জানান।"
 * - 404 -> "AI মডেল পাওয়া যায়নি।"
 * - Otherwise fallback message
 */
function getAiErrorMessage(
  error: any,
  fallbackMessage: string
): { message: string; status: number } {
  const status = extractErrorStatus(error);
  const msg = String(error?.message || '');

  if (status === 429 || msg.includes('RESOURCE_EXHAUSTED')) {
    return {
      status: 429,
      message: 'AI সেবায় এখন অনেক চাপ, ১ মিনিট পরে চেষ্টা করুন।',
    };
  }

  if (
    status === 401 ||
    status === 403 ||
    msg.includes('UNAUTHENTICATED') ||
    msg.includes('PERMISSION_DENIED') ||
    msg.toLowerCase().includes('api key') ||
    msg.toLowerCase().includes('api_key')
  ) {
    return {
      status: status === 401 || status === 403 ? status : 403,
      message: 'AI সেবা এখন চালু করা নেই। অ্যাডমিনকে জানান।',
    };
  }

  if (status === 404 || msg.includes('NOT_FOUND')) {
    return {
      status: 404,
      message: 'AI মডেল পাওয়া যায়নি।',
    };
  }

  return {
    status: status || 500,
    message: fallbackMessage,
  };
}

// 1-minute caching for GET /api/ai/health probe
interface HealthCheckCache {
  data: {
    keyPresent: boolean;
    model: string;
    ok: boolean;
    errorStatus: number | null;
    errorMessage: string;
  };
  timestamp: number;
}
let cachedAiHealth: HealthCheckCache | null = null;
const HEALTH_CACHE_TTL_MS = 60 * 1000;

/**
 * Health check endpoint for AI service (Admin Token Required)
 * Checks API key presence, performs cached 1-minute probe, returns sanitized status.
 */
app.get('/api/ai/health', requireAdminAuth, async (_req, res) => {
  const now = Date.now();
  if (cachedAiHealth && now - cachedAiHealth.timestamp < HEALTH_CACHE_TTL_MS) {
    return res.json(cachedAiHealth.data);
  }

  const keyPresent = Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim());

  if (!keyPresent) {
    const healthResult = {
      keyPresent: false,
      model: GEMINI_MODEL,
      ok: false,
      errorStatus: 401,
      errorMessage: sanitizeErrorMessage('GEMINI_API_KEY is missing from environment variables.'),
    };
    cachedAiHealth = { data: healthResult, timestamp: now };
    return res.json(healthResult);
  }

  try {
    const probe = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: 'ok',
    });

    const isOk = Boolean(probe && (probe.text || probe.candidates?.length));
    const healthResult = {
      keyPresent: true,
      model: GEMINI_MODEL,
      ok: isOk,
      errorStatus: null,
      errorMessage: isOk ? '' : 'No content generated in health probe.',
    };

    cachedAiHealth = { data: healthResult, timestamp: now };
    return res.json(healthResult);
  } catch (error: any) {
    console.error(formatSafeAiErrorLog('/api/ai/health', extractErrorStatus(error), error));
    const status = extractErrorStatus(error);
    const sanitizedMsg = sanitizeErrorMessage(error?.message || 'AI service probe failed');

    const healthResult = {
      keyPresent: true,
      model: GEMINI_MODEL,
      ok: false,
      errorStatus: status || 500,
      errorMessage: sanitizedMsg,
    };

    cachedAiHealth = { data: healthResult, timestamp: now };
    return res.json(healthResult);
  }
});

/**
 * Endpoint 1: Bengali Medicine Information
 * Explains: Uses, Common Side Effects, Administration rules & safety precautions
 */
app.post('/api/ai/medicine-info', requireFirebaseAuth, rateLimitAi(false), async (req, res) => {
  try {
    const { medicineName } = req.body;
    if (!medicineName || typeof medicineName !== 'string' || !medicineName.trim()) {
      return res.status(400).json({ error: 'ওষুধের নাম প্রদান করা আবশ্যক।' });
    }

    const prompt = `তুমি একজন দায়িত্বশীল, নিরপেক্ষ ও নির্ভরযোগ্য স্বাস্থ্য তথ্য সহকারী।
বাংলাদেশ প্রেক্ষাপটে "${medicineName.trim()}" ওষুধটি সম্পর্কে সাধারণ মানুষের সহজে বোঝার উপযোগী প্রাঞ্জল বাংলায় তথ্য দাও।

নিম্নলিখিত ফরম্যাটে উত্তর সাজাও:
১. ওষুধের পরিচিতি ও জেনেরিক নাম (যদি জানা থাকে)
২. কী কাজে লাগে (প্রধান ব্যবহার ও উপকারিতা)
৩. সাধারণ পার্শ্বপ্রতিক্রিয়া (Common Side Effects)
৪. সাধারণ খাওয়ার নিয়ম ও সতর্কতা (General administration guidance & precautions)

কঠোর নিয়মাবলী:
- কখনো রোগীকে ডোজ পরিবর্তন, শুরু বা বন্ধ করার কোনো ব্যক্তিগত পরামর্শ দেবে না।
- সর্বদা তথ্যের শেষে স্পষ্টভাবে লেখো:
"${MANDATORY_DISCLAIMER}"`;

    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: prompt,
      config: {
        systemInstruction: 'You are a compassionate, medically neutral health educator answering in clear, gentle Bengali (বাংলা). Never provide definitive personal diagnostic or prescription changes. Always include the statutory disclaimer.',
      },
    });

    const infoText = response.text || 'তথ্য তৈরি করা সম্ভব হয়নি। অনুগ্রহ করে পুনরায় চেষ্টা করুন।';

    return res.json({
      success: true,
      medicineName: medicineName.trim(),
      info: infoText,
      disclaimer: MANDATORY_DISCLAIMER,
    });
  } catch (error: any) {
    const safeInputs = typeof req.body?.medicineName === 'string' ? [req.body.medicineName] : [];
    console.error(formatSafeAiErrorLog('/api/ai/medicine-info', extractErrorStatus(error), error, safeInputs));
    const errDetails = getAiErrorMessage(
      error,
      'ওষুধের তথ্য প্রদানে সাময়িক সমস্যা হয়েছে। অনুগ্রহ করে কিছুক্ষণ পর আবার চেষ্টা করুন।'
    );
    return res.status(errDetails.status).json({
      error: errDetails.message,
      errorStatus: errDetails.status,
    });
  }
});

/**
 * Endpoint 2: Prescription / Medicine Strip Photo OCR & Extraction
 * Uses Gemini 3.8 Flash multimodal vision to extract structured prescription details
 */
app.post('/api/ai/scan-prescription', requireFirebaseAuth, rateLimitAi(true), async (req, res) => {
  try {
    const { imageBase64, mimeType = 'image/jpeg' } = req.body;
    if (!imageBase64 || typeof imageBase64 !== 'string') {
      return res.status(400).json({ error: 'প্রেসক্রিপশন বা ওষুধের পাতার ছবি প্রয়োজন।' });
    }

    // Clean base64 string if it contains data URI prefix
    const cleanBase64 = imageBase64.replace(/^data:image\/[a-z]+;base64,/, '');

    const prompt = `এই প্রেসক্রিপশন বা ওষুধের পাতার ছবিটি মনোযোগ দিয়ে লক্ষ্য করো এবং ওষুধের নাম ও তথ্য শনাক্ত করো।
যদি একাধিক ওষুধ থাকে, তবে প্রধান ওষুধটি অথবা প্রথম স্পষ্ট ওষুধটির তথ্য নিষ্কাশন করো।

নিম্নলিখিত ফিল্ডগুলো বাংলায় স্ট্রাকচার্ড JSON হিসেবে রিটার্ন করো:
- brandName: ওষুধের নাম (বাংলা বা ইংরেজি, যেমন "Napa Extra" বা "নাপা এক্সট্রা")
- genericName: জেনেরিক নাম (যেমন "Paracetamol 500mg + Caffeine 65mg")
- strength: পাওয়ার বা মাত্রা (যেমন "500 mg", "20 mg", "5 mg/5ml")
- type: ওষুধের ধরন ('ট্যাবলেট', 'ক্যাপসুল', 'সিরাপ', 'ইনসুলিন/ইনজেকশন', 'চোখের ড্রপ', 'ইনহেলার', 'মলম/জেল' এর মধ্যে একটি)
- mealTiming: খাবারের সময় ('খাওয়ার আগে', 'খাওয়ার পরে', 'খালি পেটে', 'ভরা পেটে', 'ঘুমানোর আগে' এর মধ্যে একটি)
- dosage: প্রতি বারের ডোজ (যেমন "১টি", "১ চামচ")
- schedules: সময়সূচি তালিকা (যেমন সকাল, দুপুর, রাত - যেগুলোতে নির্দেশ করা আছে)
  প্রতিটি আইটেমে: timeSlot ('সকাল', 'দুপুর', 'সন্ধ্যা', 'রাত'), time (যেমন "০৮:০০ AM"), dosage (যেমন "১টি")
- purpose: কী জন্য নির্দেশিত (যেমন "জ্বর ও ব্যথানাশক", "গ্যাস্ট্রিক")
- instructions: বিশেষ খাওয়ার নিয়ম বা সতর্কতা (যদি ছবিতে থাকে)
- confidenceNote: ছবি থেকে প্রাপ্ত তথ্যের স্বচ্ছতা সম্পর্কে সংক্ষিপ্ত বাংলা নোট।

কঠোর নিয়ম: কোনো মনগড়া ডোজ বা ডোজ পরিবর্তনের পরামর্শ দেবে না। শুধু ছবিতে দৃশ্যমান তথ্য এক্সট্র্যাক্ট করবে।`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: [
        {
          inlineData: {
            mimeType,
            data: cleanBase64,
          },
        },
        {
          text: prompt,
        },
      ],
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            brandName: { type: Type.STRING },
            genericName: { type: Type.STRING },
            strength: { type: Type.STRING },
            type: { type: Type.STRING },
            mealTiming: { type: Type.STRING },
            dosage: { type: Type.STRING },
            schedules: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  timeSlot: { type: Type.STRING },
                  time: { type: Type.STRING },
                  dosage: { type: Type.STRING },
                },
              },
            },
            purpose: { type: Type.STRING },
            instructions: { type: Type.STRING },
            confidenceNote: { type: Type.STRING },
          },
          required: ['brandName'],
        },
      },
    });

    const parsedJson = JSON.parse(response.text || '{}');

    return res.json({
      success: true,
      data: parsedJson,
      disclaimer: MANDATORY_DISCLAIMER,
    });
  } catch (error: any) {
    // Never log user prescription images or extracted text
    console.error(formatSafeAiErrorLog('/api/ai/scan-prescription', extractErrorStatus(error), error));
    const errDetails = getAiErrorMessage(
      error,
      'প্রেসক্রিপশন স্ক্যান করতে সমস্যা হয়েছে। অনুগ্রহ করে পরিষ্কার আলোতে আবার ছবি তুলে চেষ্টা করুন।'
    );
    return res.status(errDetails.status).json({
      error: errDetails.message,
      errorStatus: errDetails.status,
    });
  }
});

/**
 * Endpoint 3: Drug Interaction Warning Check (ধাপ ৩)
 * Analyzes potential drug-drug interactions between a new medicine and current active medicines.
 * Never gives definitive medical commands or advises changing doses. Always advises consulting doctor/pharmacist.
 */
app.post('/api/ai/drug-interaction', requireFirebaseAuth, rateLimitAi(false), async (req, res) => {
  try {
    const { newMedicine, currentMedicines = [], patientContext } = req.body;
    if (!newMedicine || typeof newMedicine !== 'string') {
      return res.status(400).json({ error: 'নতুন ওষুধের নাম প্রয়োজন।' });
    }

    if (!Array.isArray(currentMedicines) || currentMedicines.length === 0) {
      return res.json({
        success: true,
        hasInteraction: false,
        severity: 'none',
        summary: 'রোগীর বর্তমানে অন্য কোনো সক্রিয় ওষুধ নেই। পারস্পরিক ক্রিয়ার কোনো ঝুঁকি পাওয়া যায়নি।',
        details: [],
        recommendation: 'নতুন ওষুধটি ডাক্তারের প্রেসক্রিপশন অনুযায়ী সেবন করুন।',
        disclaimer: 'এটি সম্ভাব্য পারস্পরিক মিথস্ক্রিয়া তথ্য, ডাক্তারের পরামর্শের বিকল্প নয়। কোনো অবস্থাতেই নিজে থেকে ওষুধ বন্ধ বা ডোজ পরিবর্তন করবেন না।',
      });
    }

    const currentListStr = currentMedicines.join(', ');
    const prompt = `তুমি একজন নিরপেক্ষ ক্লিনিকাল ফার্মাকোলজি রেফারেন্স সিস্টেম।
রোগী বর্তমানে নিচের ওষুধগুলো নিয়মিত সেবন করছেন:
[${currentListStr}]

এখন নতুন একটি ওষুধ যুক্ত করা হচ্ছে:
"${newMedicine}"
${patientContext ? `রোগীর স্বাস্থ্য প্রসঙ্গ: ${patientContext}` : ''}

ক্লিনিকাল ডেটাবেজের ভিত্তিতে বিশ্লেষণ করো এই নতুন ওষুধটির সাথে বর্তমানে চলমান কোনো ওষুধের পরিচিত ড্রাগ-ড্রাগ ইন্টারঅ্যাকশন (Drug-Drug Interaction) বা পারস্পরিক মিথস্ক্রিয়া আছে কি না।

কঠোর নিয়ম:
১. নিশ্চিত রায় দেবে না। সম্ভাব্য ঝুঁকির তথ্য নিরপেক্ষভাবে জানাবে।
২. সবসময় পরামর্শ দেবে: "ডাক্তার বা ফার্মাসিস্টের সাথে কথা বলুন"।
৩. কখনো কোনো ওষুধ বন্ধ করতে বা ডোজ পরিবর্তনের নির্দেশ দেবে না।
৪. সম্পূর্ণ উত্তর সহজ বাংলায় দেবে।

JSON ফরম্যাটে উত্তর দাও:
- hasInteraction: boolean (পারস্পরিক প্রতিক্রিয়া থাকলে true)
- severity: 'none' | 'mild' | 'moderate' | 'severe'
- summary: বাংলায় সংক্ষিপ্ত ও স্পষ্ট সারাংশ (সর্বোচ্চ ২ বাক্য)
- details: বিস্তারিত পয়েন্টসমূহ (যেমন কোন দুটি ওষুধের মধ্যে কী ধরনের ক্রিয়া হতে পারে)
- recommendation: ডাক্তার বা ফার্মাসিস্টের সাথে পরামর্শের নিরপেক্ষ সুপারিশ
- disclaimer: "এটি সম্ভাব্য পারস্পরিক মিথস্ক্রিয়া তথ্য, ডাক্তারের পরামর্শের বিকল্প নয়। কোনো অবস্থাতেই নিজে থেকে ওষুধ বন্ধ বা ডোজ পরিবর্তন করবেন না।"`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            hasInteraction: { type: Type.BOOLEAN },
            severity: { type: Type.STRING },
            summary: { type: Type.STRING },
            details: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            recommendation: { type: Type.STRING },
            disclaimer: { type: Type.STRING },
          },
          required: ['hasInteraction', 'severity', 'summary', 'recommendation', 'disclaimer'],
        },
      },
    });

    const parsedJson = JSON.parse(response.text || '{}');

    return res.json({
      success: true,
      hasInteraction: Boolean(parsedJson.hasInteraction),
      severity: parsedJson.severity || 'none',
      summary: parsedJson.summary || 'কোনো উল্লেখযোগ্য পারস্পরিক ক্রিয়া পাওয়া যায়নি।',
      details: Array.isArray(parsedJson.details) ? parsedJson.details : [],
      recommendation: parsedJson.recommendation || 'ডাক্তার বা ফার্মাসিস্টের সাথে কথা বলুন।',
      disclaimer: 'এটি সম্ভাব্য পারস্পরিক মিথস্ক্রিয়া তথ্য, ডাক্তারের পরামর্শের বিকল্প নয়। কোনো অবস্থাতেই নিজে থেকে ওষুধ বন্ধ বা ডোজ পরিবর্তন করবেন না।',
    });
  } catch (error: any) {
    const sensitiveSnippets: string[] = [];
    if (typeof req.body?.newMedicine === 'string') sensitiveSnippets.push(req.body.newMedicine);
    if (typeof req.body?.patientContext === 'string') sensitiveSnippets.push(req.body.patientContext);
    if (Array.isArray(req.body?.currentMedicines)) {
      for (const m of req.body.currentMedicines) {
        if (typeof m === 'string') sensitiveSnippets.push(m);
      }
    }
    console.error(
      formatSafeAiErrorLog('/api/ai/drug-interaction', extractErrorStatus(error), error, sensitiveSnippets)
    );
    const errDetails = getAiErrorMessage(
      error,
      'পারস্পরিক ক্রিয়া যাচাই করতে সমস্যা হয়েছে।'
    );
    return res.status(errDetails.status).json({
      error: errDetails.message,
      errorStatus: errDetails.status,
    });
  }
});

function injectNoIndexRobotsMeta(html: string): string {
  const robotsMeta = '<meta name="robots" content="noindex, nofollow" />';
  if (/name=["']robots["']/i.test(html)) {
    return html.replace(/<meta[^>]*name=["']robots["'][^>]*>/i, robotsMeta);
  }
  return html.replace(/<head([^>]*)>/i, `<head$1>\n    ${robotsMeta}`);
}

function setPrivateReportHeaders(res: express.Response): void {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
}

// Mount Vite or serve static assets
async function startServer() {
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    const prodIndexPath = path.resolve(__dirname, 'dist', 'index.html');
    app.get(['/r', '/r/*'], (_req, res) => {
      setPrivateReportHeaders(res);
      try {
        const html = fs.readFileSync(prodIndexPath, 'utf8');
        return res.status(200).type('text/html').send(injectNoIndexRobotsMeta(html));
      } catch {
        return res.sendFile(prodIndexPath);
      }
    });
    app.get('*', (_req, res) => {
      res.sendFile(prodIndexPath);
    });
  } else {
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR !== 'true',
      },
      appType: 'spa',
    });

    app.get(['/r', '/r/*'], async (req, res, next) => {
      setPrivateReportHeaders(res);
      try {
        const devIndexPath = path.resolve(__dirname, 'index.html');
        const rawHtml = fs.readFileSync(devIndexPath, 'utf8');
        const transformed = await vite.transformIndexHtml(req.originalUrl, rawHtml);
        return res.status(200).type('text/html').send(injectNoIndexRobotsMeta(transformed));
      } catch (err) {
        return next(err);
      }
    });

    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`স্বাস্থ্যবন্ধু (Shasthobondhu) Full-Stack Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
