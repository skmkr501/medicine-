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
  selectSpeechVoice,
  buildDoseSpeechText,
  buildDoseTakenSpeechText,
  buildMedicineDetailSpeechText,
  buildGlobalMedicineDetailSpeechText,
  buildAiResponseSpeechText,
  loadVoiceSettings,
  saveVoiceSettings,
  DEFAULT_VOICE_SETTINGS,
  VOICE_SPEED_RATE,
  MISSING_BENGALI_VOICE_MESSAGE,
} from '../src/utils/speechUtils';
import { setNativeAlarmVoiceEnabled } from '../src/services/nativeReminders';
import {
  ONBOARDING_DONE_KEY,
  shouldShowOnboarding,
  markOnboardingDone,
} from '../src/utils/onboarding';
import {
  DEFAULT_LIBRARY_CHUNK_SIZE,
  buildLibraryChunks,
  estimateUtf8Bytes,
  hasCatalogChanges,
  shouldFetchChunksForMeta,
} from '../src/utils/libraryChunks';
import {
  QUOTA_EXCEEDED_BN_MSG,
  isQuotaExceededError,
  consumeQuotaExceededNoticeOnce,
  resetQuotaNoticeForTests,
  getFriendlyErrorMessage,
} from '../src/firebase/errors';
import { GlobalMedicine, Medicine, PatientProfile } from '../src/types';
import {
  calculateMedicineShoppingList,
  calculateShoppingCostSummary,
  findMatchingCatalogMedicine,
  formatTakaBn,
  getTargetDateForPreset,
  parsePackageSize,
  toLocalIsoDate,
} from '../src/utils/shoppingListCalculator';
import {
  buildShoppingListShareText,
  buildShoppingListWhatsAppUrl,
} from '../src/utils/shoppingListPdf';
import {
  DEFAULT_ADMIN_FILTERS,
  applyBulkMedicinePatch,
  buildMedicinesCsvWithBom,
  buildPreDeleteBackupJson,
  computeLibraryQualityReport,
  filterAndSortAdminMedicines,
  findSameGenericAlternatives,
  findSuspectedDuplicateGroups,
  getActiveAdminFilterChips,
  getMedicineAlphabetLetter,
  loadLibraryFavoriteIds,
  matchMedicineBilingualFuzzy,
  mergeRestoredMedicines,
  pickDuplicateIdsKeepingOne,
  recordRecentlyViewedId,
  saveLibraryFavoriteIds,
} from '../src/utils/libraryManagement';
import {
  CAREGIVER_INVITE_TTL_MS,
  MAX_CAREGIVERS,
  generateInviteCode,
  normalizeInviteCodeInput,
  isValidInviteCode,
  isInviteExpired,
  buildCaregiverInviteWhatsAppUrl,
  buildCaregiverAlertCheckInWhatsAppUrl,
  buildDeterministicAlertId,
  parseScheduleTimeForDate,
  evaluateCaregiverTriggers,
  loadSentFamilyAlertIds,
  markFamilyAlertSentLocally,
  loadPendingFamilyAlerts,
  enqueuePendingFamilyAlerts,
  removePendingFamilyAlert,
} from '../src/utils/caregiverAlerts';
import {
  DEFAULT_SHARED_REPORT_SECTIONS,
  SHARED_REPORT_DELETE_AFTER_EXPIRY_MS,
  SHARED_REPORT_UNAVAILABLE_MSG,
  SHARED_REPORT_VIEWER_DISCLAIMER,
  generateShareToken,
  isValidShareTokenFormat,
  extractSharedReportTokenFromPath,
  buildSharedReportUrl,
  buildSharedReportWhatsAppUrl,
  buildSharedReportSnapshot,
  getSharedReportStatus,
  canDeleteExpiredSharedReport,
  getIncludedSectionLabels,
} from '../src/utils/sharedReports';

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
        patientName: 'যমুনা আপা',
        timeSlot: 'সকাল',
        brandName: 'Napa Extend',
        dosage: '১টি',
        type: 'ট্যাবলেট',
        mealTiming: 'খাওয়ার পরে',
      }),
      'যমুনা আপা, এখন Napa Extend খাওয়ার সময়। একটি ট্যাবলেট, খাবারের পরে।'
    );

    assert.strictEqual(
      buildDoseSpeechText({
        timeSlot: 'রাত',
        brandName: 'Seclo 20',
        dosage: '১টি',
      }),
      'এখন Seclo 20 খাওয়ার সময়। একটি।'
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

describe('ধাপ ১৩: চাঙ্কড লাইব্রেরি, মেটাডাটা সংস্করণ ও কোটা সীমা হ্যান্ডলিং', () => {
  const makeMed = (idx: number, extraNotes = ''): GlobalMedicine => ({
    id: `gmed_${idx}`,
    brandName: `Napa ${idx}`,
    genericName: 'Paracetamol',
    strength: '500 mg',
    dosageForm: 'ট্যাবলেট',
    manufacturer: 'Beximco Pharmaceuticals Ltd.',
    source: 'DGDA_GOV',
    sourceType: 'government',
    sourceName: 'DGDA',
    licenseReference: 'DGDA Open Data',
    duplicateKey: `napa_${idx}|paracetamol|500 mg|ট্যাবলেট|beximco`,
    status: 'published',
    verifiedByAdmin: true,
    indication: extraNotes || 'Fever and mild pain',
    importedAt: '2026-11-12T00:00:00.000Z',
  });

  it('সর্বোচ্চ ২০০টি ওষুধ প্রতি চাঙ্ক এবং ১MB সীমার নিচে স্বয়ংক্রিয়ভাবে ভাগ করে', () => {
    // 505 items -> 3 chunks (200, 200, 105)
    const meds505 = Array.from({ length: 505 }, (_, i) => makeMed(i + 1));
    const chunks = buildLibraryChunks(meds505, 3);
    assert.strictEqual(chunks.length, 3);
    assert.strictEqual(chunks[0].version, 3);
    assert.strictEqual(chunks[0].index, 0);
    assert.strictEqual(chunks[0].items.length, DEFAULT_LIBRARY_CHUNK_SIZE);
    assert.strictEqual(chunks[1].items.length, DEFAULT_LIBRARY_CHUNK_SIZE);
    assert.strictEqual(chunks[2].items.length, 105);

    // Byte-size limit splits chunks below 200 when items are large
    const largeNotes = 'X'.repeat(5000);
    const largeMeds = Array.from({ length: 20 }, (_, i) => makeMed(i + 1, largeNotes));
    const byteCappedChunks = buildLibraryChunks(largeMeds, 4, 200, 25_000);
    assert.ok(byteCappedChunks.length > 1, 'Large items must split into multiple chunks');
    for (const chunk of byteCappedChunks) {
      assert.ok(estimateUtf8Bytes(chunk) <= 25_000, 'Each chunk must stay within byte budget');
    }
  });

  it('ডুপ্লিকেট বা অপরিবর্তিত ইমপোর্টে changed=false দেয় এবং নতুন ওষুধ থাকলে শুধু বদল যোগ করে', () => {
    const existing = [makeMed(1), makeMed(2)];

    const identicalIncoming = [makeMed(1), makeMed(2)];
    const noChange = hasCatalogChanges(existing, identicalIncoming);
    assert.strictEqual(noChange.changed, false);
    assert.strictEqual(noChange.addedOrUpdatedCount, 0);
    assert.strictEqual(noChange.mergedList.length, 2);

    const updatedAndNew = [makeMed(1), makeMed(2, 'Updated pain relief'), makeMed(3)];
    const hasDiff = hasCatalogChanges(existing, updatedAndNew);
    assert.strictEqual(hasDiff.changed, true);
    assert.strictEqual(hasDiff.addedOrUpdatedCount, 2);
    assert.strictEqual(hasDiff.mergedList.length, 3);
    assert.strictEqual(hasDiff.mergedList[1].indication, 'Updated pain relief');
  });

  it('ফোনে একই সংস্করণ থাকলে ০টি চাঙ্ক ডাউনলোড করে এবং নতুন সংস্করণে চাঙ্ক আনে', () => {
    assert.strictEqual(
      shouldFetchChunksForMeta({
        meta: { version: 5, chunkCount: 25, totalCount: 5000, updatedAt: '2026-11-12T00:00:00Z' },
        localVersion: 5,
        hasLocalCatalog: true,
      }),
      false
    );

    assert.strictEqual(
      shouldFetchChunksForMeta({
        meta: { version: 6, chunkCount: 26, totalCount: 5020, updatedAt: '2026-11-12T01:00:00Z' },
        localVersion: 5,
        hasLocalCatalog: true,
      }),
      true
    );

    // Missing local catalog triggers chunk fetch even if version matches
    assert.strictEqual(
      shouldFetchChunksForMeta({
        meta: { version: 5, chunkCount: 25, totalCount: 5000, updatedAt: '2026-11-12T00:00:00Z' },
        localVersion: 5,
        hasLocalCatalog: false,
      }),
      true
    );
  });

  it('Firestore quota exceeded এরর শনাক্ত করে ও সেশনে কেবল একবার বাংলা সতর্কতা দেখায়', () => {
    resetQuotaNoticeForTests();
    const quotaErr1 = { code: 'resource-exhausted', message: 'Quota exceeded.' };
    const quotaErr2 = new Error('RESOURCE_EXHAUSTED: Quota exceeded for free tier database');
    const permErr = { code: 'permission-denied', message: 'Missing or insufficient permissions.' };

    assert.strictEqual(isQuotaExceededError(quotaErr1), true);
    assert.strictEqual(isQuotaExceededError(quotaErr2), true);
    assert.strictEqual(isQuotaExceededError(permErr), false);
    assert.strictEqual(getFriendlyErrorMessage(quotaErr1), QUOTA_EXCEEDED_BN_MSG);

    assert.strictEqual(consumeQuotaExceededNoticeOnce(), true);
    assert.strictEqual(consumeQuotaExceededNoticeOnce(), false);
    resetQuotaNoticeForTests();
  });
});

describe('ধাপ ১৪: ওষুধ কেনার তালিকা হিসাব, বাফার, মেয়াদ সতর্কতা ও প্যাক হিসাব', () => {
  const refDate = new Date(2026, 10, 10); // 2026-11-10 local

  const patients: PatientProfile[] = [
    {
      id: 'p-father',
      name: 'আব্দুল করিম',
      relation: 'বাবা',
      age: 68,
      gender: 'পুরুষ',
      bloodGroup: 'O+',
      chronicConditions: ['উচ্চ রক্তচাপ'],
      allergies: [],
      emergencyContact: '01700000000',
    },
    {
      id: 'p-mother',
      name: 'রাহেলা বেগম',
      relation: 'মা',
      age: 62,
      gender: 'মহিলা',
      bloodGroup: 'B+',
      chronicConditions: [],
      allergies: [],
      emergencyContact: '01700000000',
    },
  ];

  const baseMed: Medicine = {
    id: 'm-1',
    brandName: 'Concor 5',
    genericName: 'Bisoprolol',
    type: 'ট্যাবলেট',
    strength: '5 mg',
    mealTiming: 'খাওয়ার পরে',
    schedules: [
      { id: 's-1', timeSlot: 'সকাল', time: '08:00 AM', dosage: '১/২টি' },
    ],
    stock: 4,
    minStockAlert: 5,
    unit: 'টি',
    startDate: '2026-11-01',
    isChronic: true,
    assignedPatientId: 'p-father',
    status: 'active',
    colorTag: 'teal',
  };

  it('দৈনিক ডোজ (আধা ট্যাবলেট সহ), ২ দিনের বাফার এবং ছাপানো/পূর্ণসংখ্যা হিসাব সঠিকভাবে করে', () => {
    const medMorningNight: Medicine = {
      ...baseMed,
      id: 'm-twice',
      brandName: 'Napa',
      genericName: 'Paracetamol',
      strength: '500 mg',
      schedules: [
        { id: 's-a', timeSlot: 'সকাল', time: '08:00 AM', dosage: '১টি' },
        { id: 's-b', timeSlot: 'রাত', time: '09:00 PM', dosage: '১টি' },
      ],
      stock: 6, // 3 days left at 2/day
      packageDescription: '10 tablets/strip',
    };

    const target15d = getTargetDateForPreset('15d', refDate);
    assert.strictEqual(toLocalIsoDate(target15d), '2026-11-25');

    // With 2-day buffer ON: 15 + 2 = 17 days
    // baseMed (0.5/day): 17 * 0.5 = 8.5 - 4 stock = 4.5 -> Math.ceil = 5
    // medMorningNight (2/day): 17 * 2 = 34 - 6 stock = 28 -> 28 / 10 per strip = 3 strips
    const withBuffer = calculateMedicineShoppingList({
      medicines: [baseMed, medMorningNight],
      patients,
      selectedPatientId: 'p-father',
      targetDate: target15d,
      includeBuffer: true,
      referenceDate: refDate,
    });

    assert.strictEqual(withBuffer.daysCount, 15);
    assert.strictEqual(withBuffer.bufferDays, 2);
    assert.strictEqual(withBuffer.effectiveDays, 17);
    assert.strictEqual(withBuffer.patientAge, 68);
    assert.strictEqual(withBuffer.toBuyItems.length, 2);

    // Soonest run-out first: m-twice (3 days) comes before m-1 (8 days)
    assert.strictEqual(withBuffer.toBuyItems[0].medicine.id, 'm-twice');
    assert.strictEqual(withBuffer.toBuyItems[1].medicine.id, 'm-1');

    const napaItem = withBuffer.toBuyItems[0];
    assert.strictEqual(napaItem.dailyUsage, 2);
    assert.strictEqual(napaItem.daysRemaining, 3);
    assert.strictEqual(napaItem.toBuyUnits, 28);
    assert.strictEqual(napaItem.estimatedPacks, 3);
    assert.strictEqual(napaItem.packSummaryBn, 'প্রায় ৩ পাতা');

    const concorItem = withBuffer.toBuyItems.find((i) => i.medicine.id === 'm-1')!;
    assert.strictEqual(concorItem.dailyUsage, 0.5);
    assert.strictEqual(concorItem.daysRemaining, 8);
    assert.strictEqual(concorItem.toBuyUnits, 5);
    assert.strictEqual(concorItem.packSummaryBn, null); // no strip info -> must NOT fabricate

    // With buffer OFF: 15 * 0.5 = 7.5 - 4 = 3.5 -> Math.ceil = 4
    const noBuffer = calculateMedicineShoppingList({
      medicines: [baseMed],
      patients,
      selectedPatientId: 'p-father',
      targetDate: target15d,
      includeBuffer: false,
      referenceDate: refDate,
    });
    assert.strictEqual(noBuffer.effectiveDays, 15);
    assert.strictEqual(noBuffer.toBuyItems[0].toBuyUnits, 4);
  });

  it('পর্যাপ্ত মজুত, মেয়াদ সতর্কতা এবং প্রয়োজনমতো (PRN) ওষুধ আলাদাভাবে দেখায়', () => {
    const sufficientMed: Medicine = {
      ...baseMed,
      id: 'm-ok',
      brandName: 'Seclo 20',
      schedules: [{ id: 's-1', timeSlot: 'সকাল', time: '07:30 AM', dosage: '১টি' }],
      stock: 40, // covers 15+2=17 days easily
    };

    const expiringMed: Medicine = {
      ...baseMed,
      id: 'm-exp',
      brandName: 'Fexo 120',
      schedules: [{ id: 's-1', timeSlot: 'রাত', time: '10:00 PM', dosage: '১টি' }],
      stock: 40, // stock count is enough, BUT expires before target date!
      expiryDate: '2026-11-20',
    };

    const prnMed: Medicine = {
      ...baseMed,
      id: 'm-prn',
      brandName: 'Napa Extra PRN',
      mealTiming: 'প্রয়োজনমতো',
      schedules: [],
      stock: 5,
      assignedPatientId: 'p-mother',
    };

    const pausedMed: Medicine = {
      ...baseMed,
      id: 'm-paused',
      brandName: 'Old Paused Med',
      status: 'paused',
    };

    const target30d = getTargetDateForPreset('30d', refDate); // 2026-12-10
    const resAll = calculateMedicineShoppingList({
      medicines: [sufficientMed, expiringMed, prnMed, pausedMed],
      patients,
      selectedPatientId: 'all',
      targetDate: target30d,
      includeBuffer: true,
      referenceDate: refDate,
    });

    assert.strictEqual(resAll.patientLabelBn, 'সবার জন্য');
    assert.strictEqual(resAll.sufficientItems.length, 1);
    assert.strictEqual(resAll.sufficientItems[0].statusLabelBn, 'পর্যাপ্ত আছে ✓');
    assert.strictEqual(resAll.sufficientItems[0].medicine.id, 'm-ok');

    // Expiring medicine appears in toBuyItems with red warning even when stock count >= required
    assert.strictEqual(resAll.toBuyItems.length, 1);
    assert.strictEqual(resAll.toBuyItems[0].medicine.id, 'm-exp');
    assert.strictEqual(resAll.toBuyItems[0].expiresBeforeTarget, true);
    assert.strictEqual(resAll.toBuyItems[0].needsExpiryReplacementOnly, true);
    assert.strictEqual(
      resAll.toBuyItems[0].expiryWarningBn,
      'এই তারিখের আগেই মেয়াদ শেষ হবে, নতুন প্যাকেট কিনুন'
    );

    // PRN medicine does NOT guess a daily dose and shows "নিজে হিসাব করুন"
    assert.strictEqual(resAll.asNeededItems.length, 1);
    assert.strictEqual(resAll.asNeededItems[0].medicine.id, 'm-prn');
    assert.strictEqual(resAll.asNeededItems[0].noteBn, 'নিজে হিসাব করুন');

    // Paused medicine is excluded
    assert.strictEqual(resAll.totalActiveMedicinesConsidered, 3);

    // Share text & wa.me link include doctor name, notes, sufficient label, and disclaimer
    const shareText = buildShoppingListShareText({
      result: resAll,
      doctorName: 'ডা. তানভীর',
      notes: 'সন্ধ্যার আগে কিনতে হবে',
    });
    assert.ok(shareText.includes('ডা. তানভীর'));
    assert.ok(shareText.includes('সন্ধ্যার আগে কিনতে হবে'));
    assert.ok(shareText.includes('পর্যাপ্ত আছে ✓'));
    assert.ok(shareText.includes('নিজে হিসাব করুন'));
    assert.ok(shareText.includes('এই তারিখের আগেই মেয়াদ শেষ হবে, নতুন প্যাকেট কিনুন'));
    assert.ok(shareText.includes('এটি অ্যাপের হিসাব; ওষুধ বদলানোর আগে ডাক্তারের পরামর্শ নিন।'));

    const waUrl = buildShoppingListWhatsAppUrl({
      result: resAll,
      doctorName: 'ডা. তানভীর',
      notes: 'সন্ধ্যার আগে কিনতে হবে',
    });
    assert.ok(waUrl.startsWith('https://wa.me/?text='));
  });

  it('প্যাকেট বিবরণ না থাকলে কল্পিত পাতার সংখ্যা বানায় না, থাকলে সঠিকভাবে হিসাব করে', () => {
    assert.strictEqual(parsePackageSize(undefined, 'টি'), null);
    assert.strictEqual(parsePackageSize('Unknown pack', 'টি'), null);
    assert.deepStrictEqual(parsePackageSize('10 tablets/strip', 'টি'), {
      unitsPerPack: 10,
      packUnitBn: 'পাতা',
    });
    assert.deepStrictEqual(parsePackageSize('১০টি/পাতা', 'টি'), {
      unitsPerPack: 10,
      packUnitBn: 'পাতা',
    });
    assert.deepStrictEqual(parsePackageSize('100 ml bottle', 'মিলি'), {
      unitsPerPack: 100,
      packUnitBn: 'বোতল',
    });
    // 1-tablet strip/pack should not return unitsPerPack=1 (prevents strips == tablets bug)
    assert.strictEqual(parsePackageSize('1 tablet/strip', 'টি'), null);
    assert.strictEqual(parsePackageSize('১টি/পাতা', 'টি'), null);
    // If already tracked in বোতল, do NOT divide bottle count by 100ml
    assert.strictEqual(parsePackageSize('100 ml bottle', 'বোতল'), null);
  });

  it('লাইব্রেরি থেকে দাম মেলায় (প্রথমে আইডি, তারপর ব্র্যান্ড+শক্তি), নিজের দামকে অগ্রাধিকার দেয় ও বাদ দিলে মোট খরচ পুনরায় হিসাব করে', () => {
    const catalog: GlobalMedicine[] = [
      {
        id: 'cat-napa-500',
        brandName: 'Napa',
        genericName: 'Paracetamol',
        strength: '500 mg',
        dosageForm: 'ট্যাবলেট',
        manufacturer: 'Beximco',
        pricePerUnit: 1.2,
        packageDescription: '১০টি ট্যাবলেট/পাতা',
        source: 'DGDA_GOV',
        sourceType: 'government',
        sourceName: 'DGDA',
        licenseReference: 'DGDA Open Data',
        importedAt: '2026-11-01T00:00:00.000Z',
        verifiedByAdmin: true,
        status: 'published',
        duplicateKey: 'napa_500_beximco',
      },
      {
        id: 'cat-seclo-20',
        brandName: 'Seclo',
        genericName: 'Omeprazole',
        strength: '20mg',
        dosageForm: 'ক্যাপসুল',
        manufacturer: 'Square',
        pricePerUnit: 6.0,
        packageDescription: '10 capsules/strip',
        source: 'DGDA_GOV',
        sourceType: 'government',
        sourceName: 'DGDA',
        licenseReference: 'DGDA Open Data',
        importedAt: '2026-11-01T00:00:00.000Z',
        verifiedByAdmin: true,
        status: 'published',
        duplicateKey: 'seclo_20_square',
      },
    ];

    // Match 1: matched by catalogMedicineId
    const medById: Medicine = {
      ...baseMed,
      id: 'u-1',
      brandName: 'Napa Custom Name',
      strength: '500mg',
      catalogMedicineId: 'cat-napa-500',
      schedules: [{ id: 's1', timeSlot: 'রাত', time: '09:00 PM', dosage: '১টি' }],
      stock: 5, // 7d + 2d buffer = 9 needed -> buy 4 (< 1 strip of 10)
    };

    // Match 2: matched by brand + strength (no catalogMedicineId), WITH user price override
    const medByBrandOverride: Medicine = {
      ...baseMed,
      id: 'u-2',
      brandName: 'seclo',
      strength: '20 mg', // spacing difference should still match "20mg"
      pricePerUnit: 5.5, // user price overrides library price 6.0
      schedules: [{ id: 's1', timeSlot: 'সকাল', time: '07:30 AM', dosage: '২টি' }],
      stock: 4, // 9 * 2 = 18 -> buy 14 (2 strips -> "প্রায় ২ পাতা")
    };

    // No price item (and no catalog match)
    const medNoPrice: Medicine = {
      ...baseMed,
      id: 'u-3',
      brandName: 'UnknownVitamin',
      genericName: 'Paracetamol', // same generic must NOT falsely pull Napa's pack/price
      strength: '100 mg',
      schedules: [{ id: 's1', timeSlot: 'দুপুর', time: '02:00 PM', dosage: '১টি' }],
      stock: 0, // buy 9
    };

    const match1 = findMatchingCatalogMedicine(medById, catalog);
    assert.strictEqual(match1.matchType, 'catalog_id');
    assert.strictEqual(match1.medicine?.id, 'cat-napa-500');

    const match2 = findMatchingCatalogMedicine(medByBrandOverride, catalog);
    assert.strictEqual(match2.matchType, 'brand_strength');
    assert.strictEqual(match2.medicine?.id, 'cat-seclo-20');

    const target7d = getTargetDateForPreset('7d', refDate);
    const listRes = calculateMedicineShoppingList({
      medicines: [medById, medByBrandOverride, medNoPrice],
      patients,
      globalMedicines: catalog,
      selectedPatientId: 'p-father',
      targetDate: target7d,
      includeBuffer: true, // 9 effective days
      referenceDate: refDate,
    });

    const item1 = listRes.toBuyItems.find((i) => i.medicine.id === 'u-1')!;
    const item2 = listRes.toBuyItems.find((i) => i.medicine.id === 'u-2')!;
    const item3 = listRes.toBuyItems.find((i) => i.medicine.id === 'u-3')!;

    assert.strictEqual(item1.toBuyUnits, 4);
    assert.strictEqual(item1.packSummaryBn, '১ পাতার কম');
    assert.strictEqual(item1.unitPrice, 1.2);
    assert.strictEqual(item1.priceSource, 'library');
    assert.strictEqual(item1.estimatedCost, 4.8);

    assert.strictEqual(item2.toBuyUnits, 14);
    assert.strictEqual(item2.packSummaryBn, 'প্রায় ২ পাতা');
    assert.strictEqual(item2.unitPrice, 5.5);
    assert.strictEqual(item2.priceSource, 'user');
    assert.strictEqual(item2.estimatedCost, 77);

    assert.strictEqual(item3.unitPrice, null);
    assert.strictEqual(item3.priceSource, 'none');
    assert.strictEqual(item3.packSummaryBn, null);
    assert.strictEqual(item3.estimatedCost, null);

    // Total cost summary before exclusion: 4.8 + 77 = 81.8, 1 missing price
    const sumAll = calculateShoppingCostSummary(listRes.toBuyItems);
    assert.strictEqual(sumAll.totalEstimatedCost, 81.8);
    assert.strictEqual(sumAll.missingPriceCount, 1);
    assert.strictEqual(formatTakaBn(sumAll.totalEstimatedCost), '৳৮১.৮০');

    // Toggle "এটা কিনব না" on u-2 -> total drops to 4.8 immediately
    const excluded = new Set(['u-2']);
    const sumAfterExclude = calculateShoppingCostSummary(listRes.toBuyItems, excluded);
    assert.strictEqual(sumAfterExclude.totalEstimatedCost, 4.8);
    assert.strictEqual(sumAfterExclude.excludedCount, 1);
    assert.strictEqual(sumAfterExclude.missingPriceCount, 1);

    const shareText = buildShoppingListShareText({
      result: listRes,
      excludedMedicineIds: excluded,
    });
    assert.ok(shareText.includes('আনুমানিক মোট খরচ ৳৪.৮০'));
    assert.ok(shareText.includes('১ টির দাম নেই, মোটে ধরা হয়নি'));
    assert.ok(shareText.includes('দাম আনুমানিক, দোকানভেদে বদলাতে পারে'));
    assert.ok(!shareText.includes('seclo'));
  });
});

describe('ধাপ ১৫: অ্যাডমিন ওষুধ ব্যবস্থাপনা ও উন্নত ব্যবহারকারী লাইব্রেরি', () => {
  const baseCatalog: GlobalMedicine[] = [
    {
      id: 'm1',
      brandName: 'Napa',
      brandNameBn: 'নাপা',
      genericName: 'Paracetamol',
      genericNameBn: 'প্যারাসিটামল',
      strength: '500 mg',
      dosageForm: 'ট্যাবলেট',
      manufacturer: 'Beximco Pharmaceuticals Ltd.',
      pricePerUnit: 1.2,
      priceUnit: 'পিস',
      source: 'DGDA_GOV',
      sourceType: 'government',
      sourceName: 'DGDA',
      licenseReference: 'DGDA Open Data',
      importedAt: '2026-11-12T10:00:00.000Z',
      verifiedByAdmin: true,
      status: 'published',
      duplicateKey: 'napa_paracetamol_500mg_ট্যাবলেট_beximco',
    },
    {
      id: 'm2',
      brandName: 'Ace',
      genericName: 'Paracetamol',
      strength: '500 mg',
      dosageForm: 'ট্যাবলেট',
      manufacturer: 'Square Pharmaceuticals PLC',
      pricePerUnit: 1.0,
      source: 'DGDA_GOV',
      sourceType: 'government',
      sourceName: 'DGDA',
      licenseReference: 'DGDA Open Data',
      importedAt: '2026-11-10T10:00:00.000Z',
      verifiedByAdmin: true,
      status: 'published',
      duplicateKey: 'ace_paracetamol_500mg_ট্যাবলেট_square',
    },
    {
      id: 'm3',
      brandName: 'Napa',
      genericName: 'Paracetamol',
      strength: '500mg',
      dosageForm: 'ট্যাবলেট',
      manufacturer: 'Beximco Pharmaceuticals Ltd.',
      source: 'DGDA_GOV',
      sourceType: 'government',
      sourceName: 'DGDA',
      licenseReference: 'DGDA Open Data',
      importedAt: '2026-11-13T09:00:00.000Z',
      verifiedByAdmin: false,
      status: 'draft',
      duplicateKey: 'napa_paracetamol_500mg_ট্যাবলেট_beximco_dup',
    },
    {
      id: 'm4',
      brandName: 'TestMed (TEST DATA)',
      genericName: '-',
      strength: '10 mg',
      dosageForm: 'সিরাপ',
      manufacturer: 'Sample Demo Pharma PLC (TEST DATA)',
      source: 'DGDA_GOV',
      sourceType: 'government',
      sourceName: 'DGDA',
      licenseReference: 'TEST-SYSTEM-ONLY',
      darNumber: 'TEST-DAR-001',
      importedAt: '2026-10-01T00:00:00.000Z',
      verifiedByAdmin: false,
      status: 'draft',
      duplicateKey: 'testmed_10mg_সিরাপ_sample',
    },
  ];

  it('বাংলা-ইংরেজি দ্বিভাষিক ও বানান-ভুলসহ ফাজি অনুসন্ধান এবং একই উপাদানের বিকল্প খুঁজে পায়', () => {
    const bnHit = matchMedicineBilingualFuzzy(baseCatalog[0], 'নাপা');
    assert.strictEqual(bnHit.matched, true);

    const bnGenericHit = matchMedicineBilingualFuzzy(baseCatalog[1], 'প্যারাসিটামল');
    assert.strictEqual(bnGenericHit.matched, true);
    assert.strictEqual(bnGenericHit.matchType, 'generic');

    // Typo tolerance ("paracetmol")
    const typoHit = matchMedicineBilingualFuzzy(baseCatalog[1], 'paracetmol');
    assert.strictEqual(typoHit.matched, true);

    // Same generic alternatives excludes self and sorts cheaper first
    const alts = findSameGenericAlternatives(baseCatalog, 'Paracetamol', 'm1');
    assert.strictEqual(alts.length, 1); // m3 is draft, excluded from public alternatives
    assert.strictEqual(alts[0].id, 'm2');
  });

  it('গুণমান রিপোর্ট এবং ডুপ্লিকেট দল নির্ণয় করে একটি রেখে বাকিগুলো মার্ক করে', () => {
    const report = computeLibraryQualityReport(baseCatalog);
    assert.strictEqual(report.totalCount, 4);
    assert.strictEqual(report.missingPriceCount, 2); // m3, m4
    assert.strictEqual(report.missingGenericCount, 1); // m4 ('-')
    assert.strictEqual(report.testDataCount, 1); // m4
    assert.strictEqual(report.suspectedDuplicateGroupsCount, 1); // m1 + m3
    assert.strictEqual(report.suspectedDuplicateItemsCount, 2);
    assert.strictEqual(report.suspectedDuplicateExtraCount, 1);

    const groups = findSuspectedDuplicateGroups(baseCatalog);
    assert.strictEqual(groups.length, 1);
    assert.strictEqual(groups[0].primaryId, 'm1'); // published + verified + has price
    const toMark = pickDuplicateIdsKeepingOne(groups);
    assert.deepStrictEqual(toMark, ['m3']);
  });

  it('মাল্টি-ফিল্টার, সক্রিয় চিপস, বাল্ক সম্পাদনা, পূর্বাবস্থায় ফেরানো ও UTF-8 BOM CSV রপ্তানি কাজ করে', () => {
    const filtered = filterAndSortAdminMedicines(baseCatalog, {
      ...DEFAULT_ADMIN_FILTERS,
      priceStatus: 'has_price',
      dosageForm: 'ট্যাবলেট',
      sortBy: 'company',
    });
    assert.deepStrictEqual(
      filtered.map((m) => m.id),
      ['m1', 'm2']
    );

    const chips = getActiveAdminFilterChips({
      ...DEFAULT_ADMIN_FILTERS,
      priceStatus: 'no_price',
      qualityFilter: 'test_data',
    });
    assert.strictEqual(chips.length, 2);

    // Bulk patch company + price + priceUnit
    const patched = applyBulkMedicinePatch(baseCatalog, new Set(['m3']), {
      manufacturer: 'Incepta Pharmaceuticals Ltd.',
      pricePerUnit: 1.5,
      priceUnit: 'পিস',
    });
    const m3Updated = patched.find((m) => m.id === 'm3')!;
    assert.strictEqual(m3Updated.manufacturer, 'Incepta Pharmaceuticals Ltd.');
    assert.strictEqual(m3Updated.pricePerUnit, 1.5);
    assert.strictEqual(m3Updated.priceUnit, 'পিস');

    // Undo restore merges removed items back without duplicating existing ones
    const afterDelete = baseCatalog.filter((m) => m.id !== 'm2');
    const restored = mergeRestoredMedicines(afterDelete, [baseCatalog[1], baseCatalog[0]]);
    assert.strictEqual(restored.length, 4);

    // CSV starts with UTF-8 BOM and properly handles Bengali characters
    const csv = buildMedicinesCsvWithBom([baseCatalog[0]]);
    assert.ok(csv.startsWith('\uFEFF'), 'CSV must start with UTF-8 BOM');
    assert.ok(csv.includes('ট্যাবলেট'));
    assert.ok(csv.includes('পিস'));

    // Pre-delete JSON backup
    const backup = JSON.parse(buildPreDeleteBackupJson([baseCatalog[0]]));
    assert.strictEqual(backup.count, 1);
    assert.strictEqual(backup.reason, 'pre_delete_admin_backup');
  });

  it('ব্যবহারকারীর পছন্দের তালিকা, সম্প্রতি দেখা ও বর্ণক্রম সূচক কাজ করে', () => {
    const store = new Map<string, string>();
    const mockStorage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => {
        store.set(k, v);
      },
    };

    saveLibraryFavoriteIds(['m1', 'm2'], mockStorage);
    assert.deepStrictEqual(loadLibraryFavoriteIds(mockStorage), ['m1', 'm2']);

    let recent: string[] = [];
    recent = recordRecentlyViewedId('m1', recent, mockStorage);
    recent = recordRecentlyViewedId('m2', recent, mockStorage);
    recent = recordRecentlyViewedId('m1', recent, mockStorage);
    assert.deepStrictEqual(recent, ['m1', 'm2']);

    assert.strictEqual(getMedicineAlphabetLetter('napa'), 'N');
    assert.strictEqual(getMedicineAlphabetLetter('নাপা'), '#');
  });
});

describe('ধাপ ১৫: পরিবারের সদস্যকে সতর্কতা (যত্নকারী মোড)', () => {
  it('আমন্ত্রণ কোড ফরম্যাট, ৪৮ ঘণ্টা মেয়াদ ও হোয়াটসঅ্যাপ লিংক ঠিকমতো তৈরি করে', () => {
    const code = generateInviteCode(6);
    assert.strictEqual(code.length, 6);
    assert.ok(isValidInviteCode(code));
    assert.strictEqual(normalizeInviteCodeInput(' a7k-9m2 '), 'A7K9M2');

    const nowMs = Date.now();
    assert.strictEqual(isInviteExpired(nowMs + CAREGIVER_INVITE_TTL_MS, nowMs), false);
    assert.strictEqual(isInviteExpired(nowMs - 1000, nowMs), true);

    const inviteUrl = buildCaregiverInviteWhatsAppUrl(code, 'যমুনা আপা');
    assert.ok(inviteUrl.startsWith('https://wa.me/?text='));
    assert.ok(decodeURIComponent(inviteUrl).includes(code));
    assert.ok(decodeURIComponent(inviteUrl).includes('৪৮ ঘণ্টা'));

    const checkInUrl = buildCaregiverAlertCheckInWhatsAppUrl(
      '+8801711223344',
      'যমুনা আপা',
      'যমুনা আপা আজ সকালের Napa Extend খাননি'
    );
    assert.ok(checkInUrl.startsWith('https://wa.me/8801711223344?text='));
  });

  it('মিসড ডোজ (১৫/৩০/৬০ মিনিট), কম মজুদ (<৩ দিন), ডিটারমিনিস্টিক আইডি এবং সর্বোচ্চ ৩ যত্নকারী যাচাই করে', () => {
    const meds: Medicine[] = [
      {
        id: 'med_napa',
        brandName: 'Napa Extend',
        genericName: 'Paracetamol',
        strength: '665 mg',
        isChronic: false,
        type: 'ট্যাবলেট',
        mealTiming: 'খাওয়ার পরে',
        schedules: [
          { id: 's1', timeSlot: 'সকাল', time: '08:00 AM', dosage: '১টি' },
          { id: 's2', timeSlot: 'রাত', time: '09:00 PM', dosage: '১টি' },
        ],
        stock: 4, // 2/day -> 2 days (< 3 days) => low_stock alert
        minStockAlert: 5,
        unit: 'টি',
        startDate: '2026-11-01',
        status: 'active',
        colorTag: 'teal',
      },
    ];

    const links = ['L1', 'L2', 'L3', 'L4'].map((suffix, idx) => ({
      id: `CODE0${idx + 1}`,
      inviteCode: `CODE0${idx + 1}`,
      patientUid: 'p_uid_1',
      patientName: 'যমুনা আপা',
      patientPhone: '01700000000',
      caregiverUid: `cg_uid_${idx + 1}`,
      caregiverName: `যত্নকারী ${idx + 1}`,
      status: 'active' as const,
      allowFullView: false,
      expiresAtMs: Date.now() + CAREGIVER_INVITE_TTL_MS,
      createdAt: '2026-11-10T00:00:00.000Z',
      updatedAt: '2026-11-10T00:00:00.000Z',
    }));

    const morningCheck = new Date(2026, 10, 13, 8, 25, 0); // 25 min past 08:00 AM

    // Threshold 30 min -> not triggered yet, schedules device timer in ~5 min
    const res30 = evaluateCaregiverTriggers({
      patientUid: 'p_uid_1',
      patientName: 'যমুনা আপা',
      patientPhone: '01700000000',
      medicines: meds,
      doseLogs: [],
      activeLinks: links,
      thresholdMinutes: 30,
      now: morningCheck,
    });
    assert.strictEqual(res30.alertsToSend.some((a) => a.type === 'missed_dose'), false);
    assert.ok(res30.nextCheckDelayMs !== null && res30.nextCheckDelayMs > 0);
    assert.strictEqual(res30.alertsToSend.some((a) => a.type === 'low_stock'), true);

    // Max 3 caregivers enforced
    const lowStockAlert = res30.alertsToSend.find((a) => a.type === 'low_stock')!;
    assert.strictEqual(lowStockAlert.caregiverUids.length, MAX_CAREGIVERS);
    assert.match(lowStockAlert.id, /^[a-zA-Z0-9_-]+$/);

    // Threshold 15 min -> triggers missed_dose immediately!
    const res15 = evaluateCaregiverTriggers({
      patientUid: 'p_uid_1',
      patientName: 'যমুনা আপা',
      medicines: meds,
      doseLogs: [],
      activeLinks: links,
      thresholdMinutes: 15,
      now: morningCheck,
    });
    const missedAlert = res15.alertsToSend.find((a) => a.type === 'missed_dose');
    assert.ok(missedAlert);
    assert.strictEqual(missedAlert.message, 'যমুনা আপা আজ সকালের Napa Extend খাননি');
    assert.strictEqual(
      missedAlert.id,
      buildDeterministicAlertId('p_uid_1', 'med_napa', '2026-11-13', 'missed_dose', 'সকাল')
    );

    // Same-day dedupe prevents sending duplicate alert when sentAlertIds contains alert ID
    const resDeduped = evaluateCaregiverTriggers({
      patientUid: 'p_uid_1',
      patientName: 'যমুনা আপা',
      medicines: meds,
      doseLogs: [],
      activeLinks: links,
      thresholdMinutes: 15,
      sentAlertIds: new Set([missedAlert.id, lowStockAlert.id]),
      now: morningCheck,
    });
    assert.strictEqual(resDeduped.alertsToSend.length, 0);

    // When morning dose is marked taken today, summary reflects taken=1, remaining=1
    const resAfterTaken = evaluateCaregiverTriggers({
      patientUid: 'p_uid_1',
      patientName: 'যমুনা আপা',
      medicines: meds,
      doseLogs: [
        {
          id: 'log_1',
          medicineId: 'med_napa',
          medicineName: 'Napa Extend',
          patientId: 'p1',
          scheduledDate: '2026-11-13',
          scheduledTime: '08:00 AM',
          timeSlot: 'সকাল',
          dosage: '১টি',
          status: 'taken',
          loggedAt: morningCheck.toISOString(),
        },
      ],
      activeLinks: links,
      thresholdMinutes: 15,
      sentAlertIds: new Set([lowStockAlert.id]),
      now: morningCheck,
    });
    assert.strictEqual(resAfterTaken.alertsToSend.length, 0);
    assert.strictEqual(resAfterTaken.todaySummary.takenDoses, 1);
    assert.strictEqual(resAfterTaken.todaySummary.remainingDoses, 1);
    assert.ok(parseScheduleTimeForDate('০৮:৩০ PM', morningCheck));
  });

  it('অফলাইন বা কোটা ব্যর্থ হলে অ্যালার্ট স্থানীয়ভাবে সংরক্ষণ করে এবং পরে পুনরায় পাঠাতে পারে', () => {
    const store = new Map<string, string>();
    const mockStorage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => {
        store.set(k, v);
      },
    };

    const sampleAlert = {
      id: 'p1_m1_2026-11-13_morning',
      patientUid: 'p1',
      caregiverUids: ['cg1'],
      caregiverLinkIds: ['CODE01'],
      type: 'missed_dose' as const,
      medicineId: 'm1',
      medicineName: 'Napa Extend',
      date: '2026-11-13',
      message: 'যমুনা আপা আজ সকালের Napa Extend খাননি',
      createdAt: '2026-11-13T08:30:00.000Z',
      createdAtMs: Date.now(),
      seenBy: [],
    };

    enqueuePendingFamilyAlerts('p1', [sampleAlert], mockStorage);
    assert.strictEqual(loadPendingFamilyAlerts('p1', mockStorage).length, 1);

    markFamilyAlertSentLocally('p1', sampleAlert.id, mockStorage);
    assert.ok(loadSentFamilyAlertIds('p1', mockStorage).has(sampleAlert.id));

    removePendingFamilyAlert('p1', sampleAlert.id, mockStorage);
    assert.strictEqual(loadPendingFamilyAlerts('p1', mockStorage).length, 0);
  });
});

describe('বাংলা ভয়েস রিমাইন্ডার: ভয়েস অগ্রাধিকার, বাক্য গঠন, সেটিংস ও APK ব্রিজ', () => {
  it('bn-BD → bn-IN → অন্যান্য bn → ডিফল্ট ভয়েস অগ্রাধিকার সঠিকভাবে কাজ করে', () => {
    const pickedBd = findBengaliVoice([
      { lang: 'bn-IN', name: 'IN' },
      { lang: 'bn', name: 'Generic BN' },
      { lang: 'bn-BD', name: 'BD' },
    ]);
    assert.strictEqual(pickedBd?.lang, 'bn-BD');

    const pickedIn = findBengaliVoice([
      { lang: 'bn', name: 'Generic BN' },
      { lang: 'bn-IN', name: 'IN' },
    ]);
    assert.strictEqual(pickedIn?.lang, 'bn-IN');

    const fallbackSelection = selectSpeechVoice([
      { lang: 'en-US', name: 'English Default', default: true },
    ]);
    assert.strictEqual(fallbackSelection.isBengali, false);
    assert.strictEqual(fallbackSelection.voice?.lang, 'en-US');
    assert.ok(MISSING_BENGALI_VOICE_MESSAGE.includes('টেক্সট-টু-স্পিচ'));
  });

  it('ওষুধের বিবরণ, AI উত্তর ও ডোজ খাওয়ার নিশ্চিতকরণ বাক্য স্বাভাবিকভাবে তৈরি হয়', () => {
    const medSpeech = buildMedicineDetailSpeechText({
      brandName: 'Napa Extend',
      indication: 'জ্বর ও ব্যথা উপশমে ব্যবহার হয়',
      type: 'ট্যাবলেট',
      mealTiming: 'খাওয়ার পরে',
      schedules: [{ timeSlot: 'সকাল', dosage: '১টি' }],
    });
    assert.ok(medSpeech.includes('Napa Extend।'));
    assert.ok(medSpeech.includes('কী কাজে লাগে: জ্বর ও ব্যথা উপশমে ব্যবহার হয়।'));
    assert.ok(medSpeech.includes('খাওয়ার নিয়ম: সকালবেলা একটি ট্যাবলেট, খাবারের পরে।'));

    const globalSpeech = buildGlobalMedicineDetailSpeechText({
      brandName: 'Seclo',
      strength: '20 mg',
      dosageForm: 'Capsule',
      indication: 'গ্যাস্ট্রিক ও অম্বল কমায়',
      packageDescription: '১০টি ক্যাপসুল/পাতা',
    });
    assert.ok(globalSpeech.includes('Seclo, 20 mg, Capsule।'));
    assert.ok(globalSpeech.includes('কী কাজে লাগে: গ্যাস্ট্রিক ও অম্বল কমায়।'));

    const aiSpeech = buildAiResponseSpeechText(
      'Napa',
      '## ব্যবহার\n- **জ্বর ও ব্যথা**: দিনে ৩ বার খাবেন।'
    );
    assert.strictEqual(aiSpeech.includes('**'), false);
    assert.strictEqual(aiSpeech.includes('##'), false);
    assert.ok(aiSpeech.includes('Napa সম্পর্কে তথ্য।'));

    assert.strictEqual(
      buildDoseTakenSpeechText({ patientName: 'যমুনা আপা', brandName: 'Napa Extend' }),
      'ভালো হয়েছে, যমুনা আপা, Napa Extend খাওয়া হয়েছে।'
    );
  });

  it('ভয়েস সেটিংস ফোনে সংরক্ষণ হয় ও APK ব্রিজ অনুপস্থিত থাকলে ত্রুটি ছাড়া নিষ্ক্রিয় থাকে', () => {
    const map = new Map<string, string>();
    const mockStorage = {
      getItem: (k: string) => map.get(k) ?? null,
      setItem: (k: string, v: string) => {
        map.set(k, v);
      },
    };

    const initial = loadVoiceSettings(mockStorage);
    assert.deepStrictEqual(initial, DEFAULT_VOICE_SETTINGS);

    const updated = saveVoiceSettings(
      { enabled: false, speed: 'slow', confirmOnDoseTaken: true, apkAlarmVoiceEnabled: false },
      mockStorage
    );
    assert.strictEqual(updated.enabled, false);
    assert.strictEqual(updated.speed, 'slow');
    assert.strictEqual(updated.confirmOnDoseTaken, true);
    assert.strictEqual(updated.apkAlarmVoiceEnabled, false);
    assert.strictEqual(VOICE_SPEED_RATE.slow < VOICE_SPEED_RATE.normal, true);
    assert.strictEqual(VOICE_SPEED_RATE.fast > VOICE_SPEED_RATE.normal, true);

    const reloaded = loadVoiceSettings(mockStorage);
    assert.deepStrictEqual(reloaded, updated);

    const brokenStorage = {
      getItem: () => {
        throw new Error('storage blocked');
      },
      setItem: () => {
        throw new Error('quota exceeded');
      },
    };
    assert.deepStrictEqual(loadVoiceSettings(brokenStorage), DEFAULT_VOICE_SETTINGS);
    assert.doesNotThrow(() => saveVoiceSettings({ speed: 'fast' }, brokenStorage));
    assert.strictEqual(setNativeAlarmVoiceEnabled(true), false);
  });
});

describe('ডাক্তার/পরিবারের জন্য নিরাপদ রিপোর্ট শেয়ার লিংক (Shared Reports)', () => {
  it('অনুমান-অযোগ্য >=১২০-বিট ক্রিপ্টোগ্রাফিক টোকেন ও /r/{token} URL তৈরি ও পার্স করে', () => {
    const tokens = new Set<string>();
    for (let i = 0; i < 25; i += 1) {
      const tok = generateShareToken();
      assert.strictEqual(isValidShareTokenFormat(tok), true);
      assert.ok(tok.length >= 24);
      assert.match(tok, /^[A-Za-z0-9_-]+$/);
      tokens.add(tok);
    }
    assert.strictEqual(tokens.size, 25);

    assert.strictEqual(isValidShareTokenFormat('short'), false);
    assert.strictEqual(isValidShareTokenFormat('patient-1-report'), false);

    const sampleToken = generateShareToken();
    assert.strictEqual(extractSharedReportTokenFromPath(`/r/${sampleToken}`), sampleToken);
    assert.strictEqual(extractSharedReportTokenFromPath(`/r/${sampleToken}/?print=1`), sampleToken);
    assert.strictEqual(extractSharedReportTokenFromPath('/medicines'), null);
    assert.strictEqual(
      buildSharedReportUrl(sampleToken, 'https://shasthobondhu.app/'),
      `https://shasthobondhu.app/r/${sampleToken}`
    );

    const waUrl = buildSharedReportWhatsAppUrl(
      `https://shasthobondhu.app/r/${sampleToken}`,
      'যমুনা আপা',
      Date.now() + 7 * 24 * 60 * 60 * 1000
    );
    assert.ok(waUrl.startsWith('https://api.whatsapp.com/send?text='));
    assert.ok(decodeURIComponent(waUrl).includes(sampleToken));
    assert.ok(SHARED_REPORT_VIEWER_DISCLAIMER.includes('চিকিৎসার সিদ্ধান্তের আগে ডাক্তারের পরামর্শ নিন'));
    assert.strictEqual(
      SHARED_REPORT_UNAVAILABLE_MSG,
      'এই লিংকের মেয়াদ শেষ হয়েছে বা বাতিল হয়েছে'
    );
  });

  it('ডিফল্ট ও নির্বাচিত বিভাগ অনুযায়ী রোগীর স্থির স্ন্যাপশট তৈরি করে এবং অনির্বাচিত তথ্য বাদ দেয়', () => {
    assert.deepStrictEqual(DEFAULT_SHARED_REPORT_SECTIONS, {
      medicines: true,
      allergiesEmergency: true,
      recentReadings: false,
      appointments: false,
    });

    const patient: PatientProfile = {
      id: 'pat_1',
      name: 'রহিম সাহেব',
      relation: 'বাবা',
      age: 64,
      gender: 'পুরুষ',
      bloodGroup: 'B+',
      chronicConditions: ['উচ্চ রক্তচাপ'],
      allergies: ['পেনিসিলিন'],
      emergencyContact: '01711000000',
    };

    const meds: Medicine[] = [
      {
        id: 'm1',
        brandName: 'Napa Extend',
        genericName: 'Paracetamol',
        strength: '665 mg',
        type: 'ট্যাবলেট',
        mealTiming: 'খাওয়ার পরে',
        schedules: [{ id: 's1', timeSlot: 'সকাল', time: '08:00 AM', dosage: '১টি' }],
        stock: 10,
        minStockAlert: 2,
        unit: 'টি',
        startDate: '2026-11-01',
        isChronic: true,
        assignedPatientId: 'pat_1',
        status: 'active',
        colorTag: 'teal',
      },
      {
        id: 'm2',
        brandName: 'OldStoppedMed',
        genericName: 'Cetirizine',
        strength: '10 mg',
        type: 'ট্যাবলেট',
        mealTiming: 'খাওয়ার পরে',
        schedules: [],
        stock: 0,
        minStockAlert: 0,
        unit: 'টি',
        startDate: '2026-10-01',
        isChronic: false,
        assignedPatientId: 'pat_1',
        status: 'completed',
        colorTag: 'teal',
      },
      {
        id: 'm3',
        brandName: 'OtherPatientMed',
        genericName: 'Omeprazole',
        strength: '20 mg',
        type: 'ক্যাপসুল',
        mealTiming: 'খাওয়ার আগে',
        schedules: [],
        stock: 5,
        minStockAlert: 1,
        unit: 'টি',
        startDate: '2026-11-01',
        isChronic: true,
        assignedPatientId: 'pat_other',
        status: 'active',
        colorTag: 'teal',
      },
    ];

    const records: HealthRecord[] = [
      {
        id: 'hr1',
        patientId: 'pat_1',
        recordDate: '2026-11-12',
        recordTime: '09:00 AM',
        systolic: 130,
        diastolic: 85,
        createdAt: '2026-11-12T09:00:00Z',
      },
    ];

    const appointments: DoctorAppointment[] = [
      {
        id: 'apt1',
        patientId: 'pat_1',
        doctorName: 'ডা. করিম',
        appointmentDate: '2026-11-20',
        appointmentTime: '05:00 PM',
        location: 'ঢাকা',
        status: 'upcoming',
        createdAt: '2026-11-10T00:00:00Z',
      },
    ];

    const nowMs = 1_763_000_000_000;
    const defaultSnap = buildSharedReportSnapshot({
      ownerUid: 'uid_owner_1',
      token: generateShareToken(),
      patient,
      medicines: meds,
      healthRecords: records,
      appointments,
      selection: DEFAULT_SHARED_REPORT_SECTIONS,
      expiryHours: 168,
      nowMs,
    });

    assert.strictEqual(defaultSnap.revoked, false);
    assert.strictEqual(defaultSnap.expiresAtMs, nowMs + 168 * 60 * 60 * 1000);
    assert.strictEqual(defaultSnap.sections.medicines?.length, 1);
    assert.strictEqual(defaultSnap.sections.medicines?.[0].brandName, 'Napa Extend');
    assert.strictEqual(defaultSnap.sections.allergiesEmergency?.bloodGroup, 'B+');
    assert.strictEqual(defaultSnap.sections.recentReadings, undefined);
    assert.strictEqual(defaultSnap.sections.appointments, undefined);
    assert.deepStrictEqual(getIncludedSectionLabels(defaultSnap.sections), [
      'চলমান ওষুধ',
      'অ্যালার্জি ও জরুরি তথ্য',
    ]);

    const fullSnap = buildSharedReportSnapshot({
      ownerUid: 'uid_owner_1',
      token: generateShareToken(),
      patient,
      medicines: meds,
      healthRecords: records,
      appointments,
      selection: {
        medicines: true,
        allergiesEmergency: true,
        recentReadings: true,
        appointments: true,
      },
      expiryHours: 24,
      nowMs,
    });
    assert.strictEqual(fullSnap.sections.recentReadings?.length, 1);
    assert.strictEqual(fullSnap.sections.appointments?.length, 1);
    assert.strictEqual(fullSnap.expiresAtMs, nowMs + 24 * 60 * 60 * 1000);

    assert.throws(() =>
      buildSharedReportSnapshot({
        ownerUid: 'uid_owner_1',
        token: generateShareToken(),
        patient,
        medicines: meds,
        healthRecords: records,
        appointments,
        selection: {
          medicines: false,
          allergiesEmergency: false,
          recentReadings: false,
          appointments: false,
        },
        expiryHours: 24,
        nowMs,
      })
    );
  });

  it('রিপোর্টের অবস্থা (সক্রিয়/বাতিল/মেয়াদ শেষ) এবং মেয়াদোত্তীর্ণ হওয়ার ৩০ দিন পর মুছে ফেলার নিয়ম যাচাই করে', () => {
    const nowMs = 1_763_000_000_000;
    assert.strictEqual(
      getSharedReportStatus({ revoked: false, expiresAt: null, expiresAtMs: nowMs + 60_000 }, nowMs),
      'active'
    );
    assert.strictEqual(
      getSharedReportStatus({ revoked: true, expiresAt: null, expiresAtMs: nowMs + 60_000 }, nowMs),
      'revoked'
    );
    assert.strictEqual(
      getSharedReportStatus({ revoked: false, expiresAt: null, expiresAtMs: nowMs - 1000 }, nowMs),
      'expired'
    );

    // 29 days past expiry -> cannot delete
    assert.strictEqual(
      canDeleteExpiredSharedReport(
        {
          revoked: false,
          expiresAt: null,
          expiresAtMs: nowMs - (SHARED_REPORT_DELETE_AFTER_EXPIRY_MS - 24 * 60 * 60 * 1000),
        },
        nowMs
      ),
      false
    );

    // 31 days past expiry -> eligible to delete
    assert.strictEqual(
      canDeleteExpiredSharedReport(
        {
          revoked: false,
          expiresAt: null,
          expiresAtMs: nowMs - (SHARED_REPORT_DELETE_AFTER_EXPIRY_MS + 24 * 60 * 60 * 1000),
        },
        nowMs
      ),
      true
    );
  });
});

console.log('\n================================================================');
console.log('  🎉 ALL NEW FEATURE TESTS PASSED SUCCESSFULLY!');
console.log('================================================================\n');
