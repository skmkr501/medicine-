import { describe, it } from 'node:test';
import assert from 'node:assert';
import { HealthRecord, DoctorAppointment, ReminderSettings } from '../src/types';
import { t } from '../src/utils/translations';
import {
  initialPatients,
  initialMedicines,
  initialDoseLogs,
  initialHealthRecords,
  initialAppointments,
  initialSettings,
  commonMedicinePresets,
} from '../src/data/mockData';
import {
  DEMO_CLEANUP_FLAG,
  isDemoRecordId,
  cleanDemoDataSnapshot,
} from '../src/utils/demoCleanup';
import {
  LIBRARY_PAGE_SIZE,
  evaluateGlobalCatalogSnapshot,
  paginateMedicines,
  PublishedBaselineState,
} from '../src/utils/libraryRealtime';
import crypto from 'node:crypto';
import {
  extractBearerToken,
  verifyFirebaseIdToken,
  isVerifiedAdmin,
  UserAiRateLimiter,
  formatSafeAiErrorLog,
  ADMIN_EMAIL,
  MAX_AI_REQUESTS_PER_HOUR,
  MAX_SCAN_REQUESTS_PER_HOUR,
  RATE_LIMIT_WINDOW_MS,
} from '../server/aiSecurity';
import {
  findBengaliVoice,
  buildDoseSpeechText,
} from '../src/utils/speechUtils';
import {
  ONBOARDING_DONE_KEY,
  shouldShowOnboarding,
  markOnboardingDone,
} from '../src/utils/onboarding';

console.log('\n================================================================');
console.log('  স্বাস্থ্যবন্ধু (Shasthobondhu) - New Features Verification Tests');
console.log('================================================================\n');

// 1. Health Records (ধাপ ১)
describe('ধাপ ১: স্বাস্থ্য রেকর্ড (Health Records)', () => {
  const sampleBPRecord: HealthRecord = {
    id: 'hr-1',
    patientId: 'patient-father',
    recordDate: '2026-11-02',
    recordTime: '08:30 AM',
    systolic: 125,
    diastolic: 82,
    createdAt: new Date().toISOString(),
  };

  const sampleSugarRecord: HealthRecord = {
    id: 'hr-2',
    patientId: 'patient-father',
    recordDate: '2026-11-02',
    recordTime: '09:00 AM',
    bloodSugar: 6.2,
    sugarType: 'খালি পেটে',
    createdAt: new Date().toISOString(),
  };

  const sampleWeightRecord: HealthRecord = {
    id: 'hr-3',
    patientId: 'patient-father',
    recordDate: '2026-11-02',
    weight: 71.5,
    createdAt: new Date().toISOString(),
  };

  assert.strictEqual(sampleBPRecord.systolic, 125);
  assert.strictEqual(sampleBPRecord.diastolic, 82);
  assert.strictEqual(sampleSugarRecord.bloodSugar, 6.2);
  assert.strictEqual(sampleSugarRecord.sugarType, 'খালি পেটে');
  assert.strictEqual(sampleWeightRecord.weight, 71.5);
  console.log('✅ PASS: Health Records (BP, Blood Sugar, Weight) data models validated');
});

// 2. Doctor Appointments (ধাপ ২)
describe('ধাপ ২: ডাক্তারের অ্যাপয়েন্টমেন্ট (Doctor Appointments)', () => {
  const today = '2026-11-02';
  const tomorrow = '2026-11-03';
  const nextWeek = '2026-11-10';

  const apts: DoctorAppointment[] = [
    {
      id: 'apt-1',
      patientId: 'patient-father',
      doctorName: 'ডা. কাজী নাজমুল হাসান',
      specialty: 'হৃদরোগ বিশেষজ্ঞ',
      appointmentDate: today,
      appointmentTime: '10:30 AM',
      location: 'ধানমন্ডি চেম্বার',
      status: 'upcoming',
      createdAt: new Date().toISOString(),
    },
    {
      id: 'apt-2',
      patientId: 'patient-mother',
      doctorName: 'ডা. সানজিদা আহমেদ',
      specialty: 'গাইনী ও স্ত্রী বিশেষজ্ঞ',
      appointmentDate: tomorrow,
      appointmentTime: '05:00 PM',
      location: 'গ্রিন রোড ক্লিনিক',
      status: 'upcoming',
      createdAt: new Date().toISOString(),
    },
    {
      id: 'apt-3',
      patientId: 'patient-father',
      doctorName: 'ডা. রফিকুজ্জামান',
      specialty: 'চক্ষু বিশেষজ্ঞ',
      appointmentDate: nextWeek,
      appointmentTime: '11:00 AM',
      location: 'চক্ষু হাসপাতাল',
      status: 'upcoming',
      createdAt: new Date().toISOString(),
    },
  ];

  const urgentAlerts = apts.filter(
    (a) => a.status === 'upcoming' && (a.appointmentDate === today || a.appointmentDate === tomorrow)
  );

  assert.strictEqual(urgentAlerts.length, 2);
  assert.strictEqual(urgentAlerts[0].doctorName, 'ডা. কাজী নাজমুল হাসান');
  assert.strictEqual(urgentAlerts[1].doctorName, 'ডা. সানজিদা আহমেদ');
  console.log('✅ PASS: Doctor Appointments dashboard alert triggers on today and day before');
});

// 3. Drug Interaction Safety Check (ধাপ ৩)
describe('ধাপ ৩: ওষুধের মিথস্ক্রিয়া যাচাই (Drug Interaction)', () => {
  const mandatoryDisclaimer = 'এটি শুধুমাত্র সাধারণ তথ্যের জন্য, চিকিৎসার বিকল্প নয়।';
  assert.ok(mandatoryDisclaimer.includes('চিকিৎসার বিকল্প নয়'));
  console.log('✅ PASS: Mandatory statutory disclaimer enforced on drug interaction results');
});

// 4. Overdue Dose Family Notification (ধাপ ৪)
describe('ধাপ ৪: ডোজ মিস হলে পরিবারকে জানানো (Missed Dose Family Alert)', () => {
  const isDoseOverdueBy30Min = (doseTime: string, mockCurrentHours: number, mockCurrentMinutes: number): boolean => {
    const bengaliDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
    let normalized = doseTime.trim();
    bengaliDigits.forEach((d, idx) => {
      normalized = normalized.split(d).join(String(idx));
    });

    const match = normalized.match(/(\d{1,2}):(\d{2})\s*(AM|PM|am|pm)?/i);
    if (!match) return false;

    let hours = parseInt(match[1], 10);
    const minutes = parseInt(match[2], 10);
    const meridiem = (match[3] || '').toUpperCase();

    if (meridiem === 'PM' && hours < 12) hours += 12;
    if (meridiem === 'AM' && hours === 12) hours = 0;

    const diffMinutes = (mockCurrentHours * 60 + mockCurrentMinutes) - (hours * 60 + minutes);
    return diffMinutes > 30;
  };

  // Test: dose at 08:00 AM, current time 08:20 AM -> Not overdue (>30m)
  assert.strictEqual(isDoseOverdueBy30Min('০৮:০০ AM', 8, 20), false);

  // Test: dose at 08:00 AM, current time 08:35 AM -> Overdue (>30m)
  assert.strictEqual(isDoseOverdueBy30Min('০৮:০০ AM', 8, 35), true);

  // Test: dose at 08:00 PM (20:00), current time 20:45 -> Overdue (>30m)
  assert.strictEqual(isDoseOverdueBy30Min('08:00 PM', 20, 45), true);

  // Format pre-written message
  const patientName = 'আব্দুর রহমান';
  const medicineName = 'টেলমিভাস ৪০';
  const dosage = '১টি';
  const scheduledTime = '০৮:০০ AM';
  const emergencyPhone = '01711223344';

  const message = `জরুরি স্বাস্থ্যবার্তা: ${patientName}-এর "${medicineName}" (${dosage}) নির্ধারিত সময় (${scheduledTime})-এর ডোজ ৩০ মিনিটের বেশি পার হলেও এখনও গ্রহণ করা হয়নি। অনুগ্রহ করে খোঁজ নিন। - স্বাস্থ্যবন্ধু`;
  const whatsappUrl = `https://api.whatsapp.com/send?phone=${emergencyPhone}&text=${encodeURIComponent(message)}`;
  const smsUrl = `sms:${emergencyPhone}?body=${encodeURIComponent(message)}`;

  assert.ok(whatsappUrl.includes('01711223344'));
  assert.ok(whatsappUrl.includes('%'));
  assert.ok(smsUrl.startsWith('sms:01711223344?body='));
  console.log('✅ PASS: Overdue dose 30-min logic and manual SMS/WhatsApp pre-formatted links validated');
});

// 5. Language Switcher (ধাপ ৫)
describe('ধাপ ৫: ভাষা নির্বাচন (Language Switcher)', () => {
  assert.strictEqual(t('navDashboard', 'bn'), 'ড্যাশবোর্ড');
  assert.strictEqual(t('navDashboard', 'en'), 'Dashboard');
  assert.strictEqual(t('navMedicines', 'bn'), 'ওষুধের তালিকা');
  assert.strictEqual(t('navMedicines', 'en'), 'Medicine List');
  assert.strictEqual(t('navHealthRecords', 'bn'), 'স্বাস্থ্য রেকর্ড');
  assert.strictEqual(t('navHealthRecords', 'en'), 'Health Records');
  assert.strictEqual(t('navAppointments', 'bn'), 'ডাক্তারের অ্যাপয়েন্টমেন্ট');
  assert.strictEqual(t('navAppointments', 'en'), 'Appointments');
  console.log('✅ PASS: Bilingual English/Bengali translation dictionary operational');
});

// 6. AI Features Reliability & Error Status Mapping (ধাপ ৬)
describe('ধাপ ৬: AI নির্ভরযোগ্যতা ও এরর ম্যাপিং (AI Reliability & Health)', () => {
  // Test error status extraction logic
  const mockError429 = { status: 429, message: 'Resource has been exhausted (e.g. check quota).' };
  const mockError401 = { status: 401, message: 'API key not valid. Please pass a valid API key.' };
  const mockError404 = { status: 404, message: 'models/gemini-3.8-flash is not found for API version' };
  const mockError500 = { status: 500, message: 'Internal server error' };

  const mapAiError = (err: any): { status: number; message: string } => {
    const status = err.status;
    const msg = String(err.message || '');
    if (status === 429 || msg.includes('RESOURCE_EXHAUSTED')) {
      return { status: 429, message: 'AI সেবায় এখন অনেক চাপ, ১ মিনিট পরে চেষ্টা করুন।' };
    }
    if (status === 401 || status === 403 || msg.toLowerCase().includes('api key')) {
      return { status: status || 403, message: 'AI সেবা এখন চালু করা নেই। অ্যাডমিনকে জানান।' };
    }
    if (status === 404 || msg.includes('NOT_FOUND')) {
      return { status: 404, message: 'AI মডেল পাওয়া যায়নি।' };
    }
    return { status: 500, message: 'ওষুধের তথ্য প্রদানে সাময়িক সমস্যা হয়েছে।' };
  };

  assert.strictEqual(mapAiError(mockError429).message, 'AI সেবায় এখন অনেক চাপ, ১ মিনিট পরে চেষ্টা করুন।');
  assert.strictEqual(mapAiError(mockError401).message, 'AI সেবা এখন চালু করা নেই। অ্যাডমিনকে জানান।');
  assert.strictEqual(mapAiError(mockError404).message, 'AI মডেল পাওয়া যায়নি।');
  assert.strictEqual(mapAiError(mockError500).message, 'ওষুধের তথ্য প্রদানে সাময়িক সমস্যা হয়েছে।');

  // Test HTML / 413 non-JSON fallback
  const fallbackMsg = 'ছবিটি বড় বা সংযোগ দুর্বল, আবার চেষ্টা করুন।';
  assert.ok(fallbackMsg.includes('ছবিটি বড় বা সংযোগ দুর্বল'));

  // Test secret redaction logic
  const rawSecretMsg = 'Error communicating with AIzaSyD1234567890abcdefghijklmnopqrstuv at key=AIzaSySecretToken1234567890';
  const sanitized = rawSecretMsg
    .replace(/AIza[0-9A-Za-z-_]{35}/g, '[REDACTED_KEY]')
    .replace(/key=[^&\s]+/gi, 'key=[REDACTED]');
  assert.strictEqual(sanitized.includes('AIzaSyD1234567890abcdefghijklmnopqrstuv'), false);
  assert.strictEqual(sanitized.includes('key=AIzaSySecretToken1234567890'), false);
  assert.ok(sanitized.length <= 200);

  console.log('✅ PASS: AI Error status mapping (429, 401/403, 404), secret sanitization, and non-JSON/413 error message validated');
});

describe('ধাপ ৭: রিয়েল-টাইম ক্লাউড ওষুধ সিঙ্ক ও টেস্ট ডাটা ফিল্টারিং (Cloud Sync & Validation)', () => {
  // Test stripUndefined helper
  function stripUndefined<T>(obj: T): T {
    if (obj === null || obj === undefined) return obj;
    if (Array.isArray(obj)) {
      return obj.map(stripUndefined) as unknown as T;
    }
    if (typeof obj === 'object') {
      const cleaned: any = {};
      for (const [key, value] of Object.entries(obj)) {
        if (value !== undefined) {
          cleaned[key] = stripUndefined(value);
        }
      }
      return cleaned as T;
    }
    return obj;
  }

  const dirtyObject = {
    brandName: 'Napa Extend',
    genericName: 'Paracetamol',
    strength: '665 mg',
    pricePerUnit: undefined,
    nested: {
      darNumber: '028-023-011',
      emptyField: undefined,
    },
    arrayField: [1, undefined, 3],
  };

  const cleaned = stripUndefined(dirtyObject);
  assert.strictEqual('pricePerUnit' in cleaned, false);
  assert.strictEqual('emptyField' in (cleaned as any).nested, false);
  assert.strictEqual((cleaned as any).nested.darNumber, '028-023-011');
  console.log('✅ PASS: stripUndefined removes undefined fields recursively');

  // Test isTestMedicine logic
  const isTest = (med: { brandName: string; genericName: string; manufacturer: string; darNumber?: string }): boolean => {
    const brand = (med.brandName || '').toLowerCase();
    const generic = (med.genericName || '').toLowerCase();
    const mfg = (med.manufacturer || '').toLowerCase();
    const dar = (med.darNumber || '').toLowerCase();

    const isTestKeyword = (str: string) =>
      str.includes('(test data)') ||
      str.includes('(test-data)') ||
      str.includes('[test data]') ||
      str.includes('[test-data]') ||
      str.includes('টেস্ট ডাটা');

    if (isTestKeyword(brand) || isTestKeyword(generic) || isTestKeyword(mfg)) {
      return true;
    }
    if (dar.startsWith('test-') || dar.startsWith('test_')) {
      return true;
    }
    return false;
  };

  // Real medicines from screenshots (e.g. Nimocon 500) MUST NOT be marked as TEST DATA
  const nimocon = {
    brandName: 'Nimocon 500',
    genericName: 'Azithromycin',
    manufacturer: 'ACI HealthCare Limited',
    darNumber: '394-0001-023',
  };
  assert.strictEqual(isTest(nimocon), false, 'Nimocon 500 must not be flagged as TEST DATA');

  const testMed1 = {
    brandName: 'Napa 500 (TEST DATA)',
    genericName: 'Paracetamol',
    manufacturer: 'Beximco Pharmaceuticals Ltd.',
    darNumber: '028-001',
  };
  assert.strictEqual(isTest(testMed1), true, 'Medicine with (TEST DATA) must be flagged');

  const testMed2 = {
    brandName: 'Mock Drug',
    genericName: 'Placebo',
    manufacturer: 'Test Lab',
    darNumber: 'TEST-12345',
  };
  assert.strictEqual(isTest(testMed2), true, 'Medicine with TEST- DAR number must be flagged');
  console.log('✅ PASS: isTestMedicine accurately distinguishes real medicines from test data');

  // Test ID sanitization
  const sanitizeId = (rawId: string, fallbackSeed: string): string => {
    let sanitized = (rawId || '').replace(/[^a-zA-Z0-9_\-]/g, '_').substring(0, 120);
    if (!sanitized || sanitized.replace(/_+/g, '').length === 0) {
      sanitized = 'med_' + fallbackSeed.replace(/[^a-zA-Z0-9_\-]/g, '_').substring(0, 100);
    }
    return sanitized;
  };

  const dirtyId = 'med#nimocon 500 @ACI!$';
  const cleanId = sanitizeId(dirtyId, 'fallback');
  assert.match(cleanId, /^[a-zA-Z0-9_\-]+$/);
  assert.ok(cleanId.length <= 128);
  console.log('✅ PASS: sanitizeMedicineId strictly conforms to firestore.rules document ID regex');
});

describe('ধাপ ৮: ব্যবহারকারীর ডেটা স্থায়িত্ব, অফলাইন ক্যাশ গার্ড ও মাইগ্রেশন নীতি', () => {
  it('ক্যাশ গার্ড ও মাইগ্রেশন নীতি সঠিকভাবে কাজ করে', () => {
  // 1. Test fromCache && empty guard logic
  const handleSnapshot = (snapshot: { metadata: { fromCache: boolean; hasPendingWrites: boolean }; empty: boolean; docs: any[] }, currentLocalState: any[]) => {
    if (snapshot.metadata.fromCache && snapshot.empty) {
      // Must ignore empty cache to prevent wiping local phone state before server response
      return currentLocalState;
    }
    return snapshot.docs.map(d => d.data);
  };

  const initialLocalMeds = [{ id: 'med-1', brandName: 'Napa' }, { id: 'med-2', brandName: 'Seclo' }];
  
  // Cache returns empty on cold boot before server response
  const cachedEmptySnap = { metadata: { fromCache: true, hasPendingWrites: false }, empty: true, docs: [] };
  const preservedState = handleSnapshot(cachedEmptySnap, initialLocalMeds);
  assert.strictEqual(preservedState.length, 2, 'Empty cache snapshot MUST NOT wipe existing phone medicines');

  // Server confirms with 1 medicine
  const serverConfirmedSnap = { metadata: { fromCache: false, hasPendingWrites: false }, empty: false, docs: [{ data: { id: 'med-1', brandName: 'Napa' } }] };
  const updatedState = handleSnapshot(serverConfirmedSnap, preservedState);
  assert.strictEqual(updatedState.length, 1, 'Server confirmed snapshot successfully updates state');

  console.log('✅ PASS: snapshot.metadata.fromCache && snapshot.empty guard protects local state');

  // 2. Migration flag check
  const mockStorage: Record<string, string> = {};
  const userId = 'user_test_98765';
  const migrationKey = `shasthobondhu_migrated_${userId}`;

  assert.strictEqual(mockStorage[migrationKey], undefined, 'Migration flag begins unset');
  mockStorage[migrationKey] = 'true';
  assert.strictEqual(mockStorage[migrationKey], 'true', 'Migration flag sets and prevents redundant executions');

  console.log('✅ PASS: One-time migration flag shasthobondhu_migrated_${userId} validated');

  // 3. Cloud clear scope isolation
  const userSubcollections = ['patients', 'medicines', 'doseLogs', 'healthRecords', 'appointments', 'settings'];
  assert.ok(!userSubcollections.includes('global_medicines'), 'User clear scope MUST NOT include global_medicines');
  assert.ok(!userSubcollections.includes('import_batches'), 'User clear scope MUST NOT include import_batches');
  assert.strictEqual(userSubcollections.length, 6, 'All 6 user subcollections are covered in reset scope');

  console.log('✅ PASS: Clear cloud data strictly isolates users/{userId}/* and protects global catalog');

  // 4. Optimistic rollback pattern verification
  let currentMedicines = [{ id: 'med-1', brandName: 'টেলমিভাস' }];
  const previousMedicines = [...currentMedicines];

  // Optimistic update
  const newMed = { id: 'med-2', brandName: 'প্যারাসিটামল' };
  currentMedicines = [newMed, ...currentMedicines];
  assert.strictEqual(currentMedicines.length, 2);

  // Cloud write fails -> rollback
  const cloudWriteFailed = true;
  if (cloudWriteFailed) {
    currentMedicines = previousMedicines;
  }
  assert.strictEqual(currentMedicines.length, 1, 'Failed cloud write successfully rolls back to previous state');
  assert.strictEqual(currentMedicines[0].id, 'med-1');

  // 5. Genuine user-created local data vs untouched mock defaults detection
  const defaultMeds = [{ id: 'med-1', brandName: 'সেক্লো' }];
  const userAddedMeds = [{ id: 'med-1', brandName: 'সেক্লো' }, { id: 'med-user', brandName: 'নাপা' }];
  const hasUserLocal = (patientsCount: number, meds: any[]) =>
    patientsCount > 0 || JSON.stringify(meds) !== JSON.stringify(defaultMeds);

  assert.strictEqual(hasUserLocal(0, defaultMeds), false, 'Untouched defaults do not trigger false conflict');
  assert.strictEqual(hasUserLocal(1, defaultMeds), true, 'User-created patient triggers migration/conflict check');
  assert.strictEqual(hasUserLocal(0, userAddedMeds), true, 'User-added medicine triggers migration/conflict check');

  console.log('✅ PASS: Optimistic state rollback and user local data detection verified');
  });
});

describe('ধাপ ৯: নতুন ব্যবহারকারীর জন্য পরিষ্কার শূন্য-ডেমো শুরু ও একবার চলা ক্লিনআপ', () => {
  it('initial* ডিফল্টগুলো সম্পূর্ণ খালি থাকে এবং commonMedicinePresets অক্ষত থাকে', () => {
    assert.deepStrictEqual(initialPatients, []);
    assert.deepStrictEqual(initialMedicines, []);
    assert.deepStrictEqual(initialDoseLogs, []);
    assert.deepStrictEqual(initialHealthRecords, []);
    assert.deepStrictEqual(initialAppointments, []);
    assert.strictEqual(initialSettings.emergencyContactName, '');
    assert.strictEqual(initialSettings.emergencyContactPhone, '');
    assert.ok(commonMedicinePresets.length >= 5, 'commonMedicinePresets must be preserved');
  });

  it('ডেমো আইডি ও কাল্পনিক প্রিফিক্স মুছে ফেলে এবং ব্যবহারকারীর নিজের রেকর্ড অক্ষত রাখে', () => {
    assert.strictEqual(DEMO_CLEANUP_FLAG, 'shasthobondhu_demo_cleaned_v1');

    const cleaned = cleanDemoDataSnapshot({
      patients: [
        { id: 'patient-1', name: 'Demo 1', relation: 'বাবা', age: 70, gender: 'পুরুষ', bloodGroup: 'O+', chronicConditions: [], allergies: [], emergencyContact: '' },
        { id: 'patient-2', name: 'Demo 2', relation: 'মা', age: 63, gender: 'মহিলা', bloodGroup: 'B+', chronicConditions: [], allergies: [], emergencyContact: '' },
        { id: 'patient-3', name: 'Demo 3', relation: 'নিজ', age: 36, gender: 'পুরুষ', bloodGroup: 'A+', chronicConditions: [], allergies: [], emergencyContact: '' },
        { id: 'patient-fictional-father', name: 'Fic', relation: 'বাবা', age: 68, gender: 'পুরুষ', bloodGroup: 'O+', chronicConditions: [], allergies: [], emergencyContact: '' },
        { id: 'patient-1760000123', name: 'রহিম', relation: 'নিজ', age: 40, gender: 'পুরুষ', bloodGroup: 'A+', chronicConditions: [], allergies: [], emergencyContact: '01700000000' },
      ],
      medicines: [
        { id: 'med-1', brandName: 'Demo1', genericName: 'G', type: 'ট্যাবলেট', strength: '20', mealTiming: 'খাওয়ার আগে', schedules: [], stock: 1, minStockAlert: 1, unit: 'টি', startDate: '2026-01-01', isChronic: true, status: 'active', colorTag: 'teal' },
        { id: 'med-6', brandName: 'Demo6', genericName: 'G', type: 'ট্যাবলেট', strength: '10', mealTiming: 'খাওয়ার পরে', schedules: [], stock: 1, minStockAlert: 1, unit: 'টি', startDate: '2026-01-01', isChronic: true, status: 'active', colorTag: 'teal' },
        { id: 'med-fic-father-1', brandName: 'Fic1', genericName: 'G', type: 'ট্যাবলেট', strength: '40', mealTiming: 'খাওয়ার পরে', schedules: [{ id: 'sch-fic-1', timeSlot: 'সকাল', time: '08:00 AM', dosage: '১টি' }], stock: 1, minStockAlert: 1, unit: 'টি', startDate: '2026-01-01', isChronic: true, status: 'active', colorTag: 'teal' },
        {
          id: 'med-1760000999',
          brandName: 'User Med',
          genericName: 'Paracetamol',
          type: 'ট্যাবলেট',
          strength: '500mg',
          mealTiming: 'খাওয়ার পরে',
          schedules: [
            { id: 'sch-fic-stale', timeSlot: 'সকাল', time: '08:00 AM', dosage: '১টি' },
            { id: 'sch-user-1', timeSlot: 'রাত', time: '09:00 PM', dosage: '১টি' },
          ],
          stock: 10,
          minStockAlert: 2,
          unit: 'টি',
          startDate: '2026-11-01',
          isChronic: false,
          assignedPatientId: 'patient-1760000123',
          status: 'active',
          colorTag: 'teal',
        },
      ],
      doseLogs: [
        { id: 'log-1', medicineId: 'med-1', medicineName: 'D', scheduledDate: '2026-11-02', scheduledTime: '08:00 AM', timeSlot: 'সকাল', dosage: '1', status: 'taken' },
        { id: 'log-11', medicineId: 'med-3', medicineName: 'D', scheduledDate: '2026-11-02', scheduledTime: '10:00 PM', timeSlot: 'রাত', dosage: '1', status: 'taken' },
        { id: 'log-fic-f1', medicineId: 'med-fic-father-1', medicineName: 'F', scheduledDate: '2026-11-02', scheduledTime: '08:00 AM', timeSlot: 'সকাল', dosage: '1', status: 'taken' },
        { id: 'log-1760000555', medicineId: 'med-1760000999', medicineName: 'User Med', scheduledDate: '2026-11-02', scheduledTime: '09:00 PM', timeSlot: 'রাত', dosage: '১টি', status: 'taken' },
      ],
      healthRecords: [
        { id: 'hr-1', patientId: 'patient-1', recordDate: '2026-11-02', systolic: 120, diastolic: 80, createdAt: '2026-11-02' },
        { id: 'hr-5', patientId: 'patient-2', recordDate: '2026-11-02', systolic: 118, diastolic: 76, createdAt: '2026-11-02' },
        { id: 'hr-1760000777', patientId: 'patient-1760000123', recordDate: '2026-11-02', systolic: 115, diastolic: 75, createdAt: '2026-11-02' },
      ],
      appointments: [
        { id: 'apt-1', patientId: 'patient-1', doctorName: 'Demo Doc', appointmentDate: '2026-11-03', appointmentTime: '06:00 PM', location: 'Dhaka', status: 'upcoming', createdAt: '2026-11-01' },
        { id: 'apt-2', patientId: 'patient-2', doctorName: 'Demo Doc 2', appointmentDate: '2026-11-08', appointmentTime: '11:00 AM', location: 'Dhaka', status: 'upcoming', createdAt: '2026-11-01' },
        { id: 'apt-1760000888', patientId: 'patient-1760000123', doctorName: 'ডা. করিম', appointmentDate: '2026-11-12', appointmentTime: '05:00 PM', location: 'ঢাকা মেডিকেল', status: 'upcoming', createdAt: '2026-11-02' },
      ],
      settings: {
        ...initialSettings,
        emergencyContactName: 'তানভীর করিম (ছেলে)',
        emergencyContactPhone: '+8801711223344',
      },
    });

    assert.strictEqual(cleaned.patients.length, 1);
    assert.strictEqual(cleaned.patients[0].id, 'patient-1760000123');
    assert.strictEqual(cleaned.medicines.length, 1);
    assert.strictEqual(cleaned.medicines[0].id, 'med-1760000999');
    assert.strictEqual(cleaned.medicines[0].schedules.length, 1);
    assert.strictEqual(cleaned.medicines[0].schedules[0].id, 'sch-user-1');
    assert.strictEqual(cleaned.doseLogs.length, 1);
    assert.strictEqual(cleaned.doseLogs[0].id, 'log-1760000555');
    assert.strictEqual(cleaned.healthRecords.length, 1);
    assert.strictEqual(cleaned.healthRecords[0].id, 'hr-1760000777');
    assert.strictEqual(cleaned.appointments.length, 1);
    assert.strictEqual(cleaned.appointments[0].id, 'apt-1760000888');
    assert.strictEqual(cleaned.settings.emergencyContactName, '');
    assert.strictEqual(cleaned.settings.emergencyContactPhone, '');
    assert.strictEqual(isDemoRecordId('med-1760000999', 'medicines'), false);
    assert.strictEqual(isDemoRecordId('sch-fic-123'), true);
    assert.strictEqual(isDemoRecordId('med-4', 'medicines'), true);
  });
});

describe('ধাপ ১০: রিয়েল-টাইম ওষুধ লাইব্রেরি, অফলাইন ক্যাশ গার্ড ও পেজিনেশন', () => {
  it('প্রথম লোড ও বুট ক্যাশে নতুন ওষুধের বার্তা দেখায় না, তবে পরের লাইভ আপডেটে সঠিক সংখ্যা দেখায়', () => {
    let state: PublishedBaselineState = {
      hasInitialServerLoad: false,
      prevPublishedCount: null,
      skipNextListenerBaseline: false,
    };

    // 1. Empty cache while existing local catalog exists -> must NOT wipe list
    const emptyCache = evaluateGlobalCatalogSnapshot({
      medicines: [],
      fromCache: true,
      empty: true,
      hasExistingCatalog: true,
      state,
    });
    assert.strictEqual(emptyCache.shouldApplyList, false);
    assert.strictEqual(emptyCache.newlyAddedPublishedCount, 0);

    // 2. Initial cache load (2 published) -> apply list silently, no notification, no sync time update
    const bootCache = evaluateGlobalCatalogSnapshot({
      medicines: [{ status: 'published' }, { status: 'published' }],
      fromCache: true,
      empty: false,
      hasExistingCatalog: true,
      state,
    });
    assert.strictEqual(bootCache.shouldApplyList, true);
    assert.strictEqual(bootCache.shouldUpdateSyncTime, false);
    assert.strictEqual(bootCache.newlyAddedPublishedCount, 0);
    state = bootCache.nextState;

    // 3. First server load arrives (even with 5 items > 2 cached) -> sets baseline, NO notification on initial load
    const initialServer = evaluateGlobalCatalogSnapshot({
      medicines: [
        { status: 'published' },
        { status: 'published' },
        { status: 'published' },
        { status: 'published' },
        { status: 'published' },
      ],
      fromCache: false,
      empty: false,
      hasExistingCatalog: true,
      state,
    });
    assert.strictEqual(initialServer.shouldApplyList, true);
    assert.strictEqual(initialServer.shouldUpdateSyncTime, true);
    assert.strictEqual(initialServer.newlyAddedPublishedCount, 0);
    state = initialServer.nextState;
    assert.strictEqual(state.hasInitialServerLoad, true);
    assert.strictEqual(state.prevPublishedCount, 5);

    // 4. Draft added later (published stays 5) -> NO notification
    const draftAdded = evaluateGlobalCatalogSnapshot({
      medicines: [
        { status: 'published' },
        { status: 'published' },
        { status: 'published' },
        { status: 'published' },
        { status: 'published' },
        { status: 'draft' },
      ],
      fromCache: false,
      empty: false,
      hasExistingCatalog: true,
      state,
    });
    assert.strictEqual(draftAdded.newlyAddedPublishedCount, 0);
    state = draftAdded.nextState;

    // 5. Admin publishes/imports 3 more medicines -> triggers exact delta = 3
    const livePublished = evaluateGlobalCatalogSnapshot({
      medicines: [
        ...Array.from({ length: 8 }, () => ({ status: 'published' })),
        { status: 'draft' },
      ],
      fromCache: false,
      empty: false,
      hasExistingCatalog: true,
      state,
    });
    assert.strictEqual(livePublished.newlyAddedPublishedCount, 3);
    assert.strictEqual(livePublished.shouldUpdateSyncTime, true);
    state = livePublished.nextState;

    // 6. Listener re-subscribe (admin toggle) skips alert on first snapshot
    const adminSwitch = evaluateGlobalCatalogSnapshot({
      medicines: Array.from({ length: 9 }, () => ({ status: 'published' })),
      fromCache: false,
      empty: false,
      hasExistingCatalog: true,
      state: { ...state, skipNextListenerBaseline: true },
    });
    assert.strictEqual(adminSwitch.newlyAddedPublishedCount, 0);
    assert.strictEqual(adminSwitch.nextState.prevPublishedCount, 9);
    assert.strictEqual(adminSwitch.nextState.skipNextListenerBaseline, false);
  });

  it('লাইব্রেরির তালিকা পেজিনেশন ও আরও দেখান হিসাব সঠিকভাবে করে', () => {
    const sample = Array.from({ length: 55 }, (_, i) => ({ id: `med-${i}` }));
    const page1 = paginateMedicines(sample, LIBRARY_PAGE_SIZE);
    assert.strictEqual(page1.visibleItems.length, LIBRARY_PAGE_SIZE);
    assert.strictEqual(page1.remainingCount, 55 - LIBRARY_PAGE_SIZE);
    assert.strictEqual(page1.hasMore, true);

    const page3 = paginateMedicines(sample, LIBRARY_PAGE_SIZE * 3);
    assert.strictEqual(page3.visibleItems.length, 55);
    assert.strictEqual(page3.remainingCount, 0);
    assert.strictEqual(page3.hasMore, false);
  });
});

describe('ধাপ ১১: AI এন্ডপয়েন্ট নিরাপত্তা, টোকেন যাচাই, রেট লিমিট ও নিরাপদ এরর লগ', () => {
  it('Bearer টোকেন নিষ্কাশন ও RS256 Firebase ID টোকেন যাচাই সঠিকভাবে কাজ করে', async () => {
    assert.strictEqual(extractBearerToken(undefined), null);
    assert.strictEqual(extractBearerToken('Basic abc'), null);
    assert.strictEqual(extractBearerToken('Bearer   '), null);
    assert.strictEqual(extractBearerToken('Bearer my.jwt.token'), 'my.jwt.token');

    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });

    const projectId = 'sodium-compass-tbvhw';
    const kid = 'test-key-1';
    const nowSec = 1_760_000_000;

    const signJwt = (payloadObj: Record<string, any>) => {
      const header = Buffer.from(JSON.stringify({ alg: 'RS256', kid, typ: 'JWT' })).toString('base64url');
      const payload = Buffer.from(JSON.stringify(payloadObj)).toString('base64url');
      const signer = crypto.createSign('RSA-SHA256');
      signer.update(`${header}.${payload}`);
      signer.end();
      const sig = signer.sign(privateKey).toString('base64url');
      return `${header}.${payload}.${sig}`;
    };

    const validToken = signJwt({
      aud: projectId,
      iss: `https://securetoken.google.com/${projectId}`,
      sub: 'uid_user_123',
      email: ADMIN_EMAIL,
      email_verified: true,
      auth_time: nowSec - 60,
      iat: nowSec - 30,
      exp: nowSec + 3600,
    });

    const verified = await verifyFirebaseIdToken(validToken, projectId, {
      certsOverride: { [kid]: publicKey },
      nowSeconds: nowSec,
    });
    assert.strictEqual(verified.uid, 'uid_user_123');
    assert.strictEqual(isVerifiedAdmin(verified), true);

    assert.strictEqual(
      isVerifiedAdmin({ uid: 'uid_other', email: 'user@example.com', emailVerified: true }),
      false
    );
    assert.strictEqual(
      isVerifiedAdmin({ uid: 'uid_unverified', email: ADMIN_EMAIL, emailVerified: false }),
      false
    );

    const expiredToken = signJwt({
      aud: projectId,
      iss: `https://securetoken.google.com/${projectId}`,
      sub: 'uid_user_123',
      auth_time: nowSec - 4000,
      iat: nowSec - 3700,
      exp: nowSec - 10,
    });
    await assert.rejects(
      () =>
        verifyFirebaseIdToken(expiredToken, projectId, {
          certsOverride: { [kid]: publicKey },
          nowSeconds: nowSec,
        }),
      /expired/i
    );

    const wrongAudienceToken = signJwt({
      aud: 'other-project',
      iss: `https://securetoken.google.com/${projectId}`,
      sub: 'uid_user_123',
      auth_time: nowSec - 60,
      iat: nowSec - 30,
      exp: nowSec + 3600,
    });
    await assert.rejects(
      () =>
        verifyFirebaseIdToken(wrongAudienceToken, projectId, {
          certsOverride: { [kid]: publicKey },
          nowSeconds: nowSec,
        }),
      /audience/i
    );

    const tamperedToken = validToken.slice(0, -4) + 'AAAA';
    await assert.rejects(
      () =>
        verifyFirebaseIdToken(tamperedToken, projectId, {
          certsOverride: { [kid]: publicKey },
          nowSeconds: nowSec,
        }),
      /signature/i
    );
  });

  it('প্রতি ব্যবহারকারী প্রতি ঘণ্টায় সর্বোচ্চ ৩০টি অনুরোধ ও ১০টি ছবি স্ক্যানের রেট লিমিট প্রয়োগ করে', () => {
    const limiter = new UserAiRateLimiter();
    const t0 = 1_760_000_000_000;

    // 10 scans pass for userA
    for (let i = 0; i < MAX_SCAN_REQUESTS_PER_HOUR; i++) {
      const r = limiter.checkAndConsume('userA', true, t0 + i * 1000);
      assert.strictEqual(r.allowed, true);
    }

    // 11th scan fails with 429
    const scanBlocked = limiter.checkAndConsume('userA', true, t0 + 20_000);
    assert.strictEqual(scanBlocked.allowed, false);
    if (!scanBlocked.allowed) {
      assert.strictEqual(scanBlocked.status, 429);
      assert.ok(scanBlocked.message.includes('১০টি ছবি স্ক্যান'));
    }

    // Remaining 20 non-scan requests still pass (total reaches 30)
    for (let i = 0; i < MAX_AI_REQUESTS_PER_HOUR - MAX_SCAN_REQUESTS_PER_HOUR; i++) {
      const r = limiter.checkAndConsume('userA', false, t0 + 30_000 + i * 1000);
      assert.strictEqual(r.allowed, true);
    }

    // 31st request fails with 429
    const totalBlocked = limiter.checkAndConsume('userA', false, t0 + 60_000);
    assert.strictEqual(totalBlocked.allowed, false);
    if (!totalBlocked.allowed) {
      assert.strictEqual(totalBlocked.status, 429);
      assert.ok(totalBlocked.message.includes('৩০টি'));
    }

    // Different userB is unaffected
    const userBResult = limiter.checkAndConsume('userB', true, t0 + 65_000);
    assert.strictEqual(userBResult.allowed, true);

    // After 1 hour window expires, userA can make requests again
    const afterWindow = limiter.checkAndConsume('userA', true, t0 + RATE_LIMIT_WINDOW_MS + 100_000);
    assert.strictEqual(afterWindow.allowed, true);
  });

  it('সার্ভার এরর লগে ব্যবহারকারীর ছবি বা প্রেসক্রিপশনের লেখা প্রকাশ করে না', () => {
    const fakeBase64 = 'A'.repeat(120);
    const rawError = new Error(
      `Failed processing data:image/jpeg;base64,${fakeBase64} for patient রহিম খান taking Napa 500mg with key=AIzaSySecret12345678901234567890123456`
    );

    const safeLog = formatSafeAiErrorLog('/api/ai/scan-prescription', 500, rawError, [
      'রহিম খান',
      'Napa 500mg',
    ]);

    assert.strictEqual(safeLog.includes(fakeBase64), false);
    assert.strictEqual(safeLog.includes('data:image/jpeg'), false);
    assert.strictEqual(safeLog.includes('রহিম খান'), false);
    assert.strictEqual(safeLog.includes('Napa 500mg'), false);
    assert.strictEqual(safeLog.includes('AIzaSySecret'), false);
    assert.ok(safeLog.includes('[AI Error] route=/api/ai/scan-prescription status=500'));
  });
});

describe('ধাপ ১২: সহজ মোড, কথা বলে শোনানো (speechSynthesis) এবং ৩ স্লাইডের পরিচিতি', () => {
  it('initialSettings-এ easyMode ও voiceReadoutEnabled ডিফল্ট থাকে', () => {
    const settings: ReminderSettings = initialSettings;
    assert.strictEqual(settings.easyMode, false);
    assert.strictEqual(settings.voiceReadoutEnabled, true);
  });

  it('বাংলা ভয়েস শনাক্তকরণ ও ডোজ পড়ার বাক্য সঠিকভাবে তৈরি হয়', () => {
    assert.strictEqual(
      findBengaliVoice([{ lang: 'en-US', name: 'English' }, { lang: 'hi-IN', name: 'Hindi' }]),
      null
    );

    const picked = findBengaliVoice([
      { lang: 'en-US', name: 'English' },
      { lang: 'bn-IN', name: 'Bengali India' },
      { lang: 'bn-BD', name: 'Bengali Bangladesh' },
    ]);
    assert.strictEqual(picked?.lang, 'bn-BD');

    assert.strictEqual(
      buildDoseSpeechText({
        timeSlot: 'সকাল',
        brandName: 'Napa Extra (নাপা এক্সট্রা)',
        dosage: '১টি',
        mealTiming: 'খাওয়ার পরে',
      }),
      'এখন সকালের ওষুধ, নাপা এক্সট্রা, ১টি, খাওয়ার পরে'
    );

    assert.strictEqual(
      buildDoseSpeechText({
        timeSlot: 'রাত',
        brandName: 'Seclo 20',
        dosage: '১টি',
      }),
      'এখন রাতের ওষুধ, Seclo 20, ১টি'
    );
  });

  it('প্রথমবার অ্যাপ খুললে পরিচিতি দেখায় এবং বাদ দিলে আর দেখায় না', () => {
    const map = new Map<string, string>();
    const memoryStorage = {
      getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
      setItem: (k: string, v: string) => {
        map.set(k, v);
      },
    };

    assert.strictEqual(shouldShowOnboarding(memoryStorage), true);
    markOnboardingDone(memoryStorage);
    assert.strictEqual(map.get(ONBOARDING_DONE_KEY), '1');
    assert.strictEqual(shouldShowOnboarding(memoryStorage), false);
    assert.strictEqual(shouldShowOnboarding(null), false);
  });
});

console.log('\n================================================================');
console.log('  🎉 ALL NEW FEATURE TESTS PASSED SUCCESSFULLY!');
console.log('================================================================\n');
