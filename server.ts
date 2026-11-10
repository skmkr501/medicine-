import express from 'express';
import { GoogleGenAI, Type } from '@google/genai';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

/**
 * Endpoint 1: Bengali Medicine Information
 * Explains: Uses, Common Side Effects, Administration rules & safety precautions
 */
app.post('/api/ai/medicine-info', async (req, res) => {
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
      model: 'gemini-3.8-flash',
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
    console.error('Error generating medicine info:', error);
    return res.status(500).json({
      error: 'ওষুধের তথ্য প্রদানে সাময়িক সমস্যা হয়েছে। অনুগ্রহ করে কিছুক্ষণ পর আবার চেষ্টা করুন।',
      details: error?.message || 'Unknown error',
    });
  }
});

/**
 * Endpoint 2: Prescription / Medicine Strip Photo OCR & Extraction
 * Uses Gemini 3.8 Flash multimodal vision to extract structured prescription details
 */
app.post('/api/ai/scan-prescription', async (req, res) => {
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
    console.error('Error scanning prescription:', error);
    return res.status(500).json({
      error: 'প্রেসক্রিপশন স্ক্যান করতে সমস্যা হয়েছে। অনুগ্রহ করে পরিষ্কার আলোতে আবার ছবি তুলে চেষ্টা করুন।',
      details: error?.message || 'Unknown error',
    });
  }
});

/**
 * Endpoint 3: Drug Interaction Warning Check (ধাপ ৩)
 * Analyzes potential drug-drug interactions between a new medicine and current active medicines.
 * Never gives definitive medical commands or advises changing doses. Always advises consulting doctor/pharmacist.
 */
app.post('/api/ai/drug-interaction', async (req, res) => {
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
    console.error('Error checking drug interactions:', error);
    return res.status(500).json({
      error: 'পারস্পরিক ক্রিয়া যাচাই করতে সমস্যা হয়েছে।',
      details: error?.message || 'Unknown error',
    });
  }
});

// Mount Vite or serve static assets
async function startServer() {
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
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
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`স্বাস্থ্যবন্ধু (Shasthobondhu) Full-Stack Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
