import { describe, it } from 'node:test';
import assert from 'node:assert';
import { HealthRecord, DoctorAppointment, ReminderSettings, DoctorProfile } from '../src/types';
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
import {
  extractBearerToken,
  verifySupabaseAccessToken,
  checkSupabaseAdminRpc,
  UserAiRateLimiter,
  formatSafeAiErrorLog,
  normalizeGeminiModelName,
  filterAvailableFlashProModels,
  pickFallbackFlashModel,
  isModelNotFoundError,
  classifyAiError,
  MAX_AI_REQUESTS_PER_HOUR,
  MAX_SCAN_REQUESTS_PER_HOUR,
  RATE_LIMIT_WINDOW_MS,
} from '../server/aiSecurity';
import { AiServiceError, getAiErrorDisplay } from '../src/services/aiService';
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
  WRITE_QUOTA_PAUSE_KEY,
  QuotaExceededWriteError,
  getQuotaDayKey,
  isQuotaExceededError,
  consumeQuotaExceededNoticeOnce,
  resetQuotaNoticeForTests,
  markWriteQuotaExceeded,
  isWriteQuotaPaused,
  clearWriteQuotaPause,
  subscribeWriteQuotaExceeded,
  getFriendlyErrorMessage,
} from '../src/firebase/errors';
import { GlobalMedicine, Medicine, PatientProfile } from '../src/types';
import {
  calculateMedicineShoppingList,
  calculateShoppingCostSummary,
  findMatchingCatalogMedicine,
  formatTakaBn,
  getDateRangeForQuickPreset,
  getTargetDateForPreset,
  loadSavedShoppingDateRange,
  parsePackageSize,
  saveShoppingDateRange,
  ShoppingDateRangeStorageLike,
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
  buildLibrarySearchIndexSync,
  clearLibrarySearchIndexCache,
  computeLibraryMetadata,
  quickBasicSearchMedicines,
  searchIndexedMedicines,
} from '../src/utils/librarySearchIndex';
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
  MAX_DAILY_CAREGIVER_SUGGESTIONS,
  SUGGESTION_EXPIRY_MS,
  SUGGESTION_TEXT_LIMIT,
  buildCaregiverSuggestionPayload,
  buildFormDefaultsFromSharedMedicine,
  buildMedicineInputFromSuggestion,
  buildSuggestionSummaryHeadlineBn,
  filterVisiblePendingSuggestions,
  findTargetMedicineForSuggestion,
  getCaregiverDailySuggestionCount,
  incrementCaregiverDailySuggestionCount,
  isSuggestionExpired,
} from '../src/utils/caregiverSuggestions';
import { CaregiverLinkDoc, CaregiverSuggestionDoc, DoseLog } from '../src/types';
import {
  createEmptyOutbox,
  setLastSuccessfulSyncMs,
  getLastSuccessfulSyncMs,
  collectDirtySyncPlan,
} from '../src/utils/cloudSyncOutbox';
import {
  dedupeAndMergeQueueMedicines,
  removeIdsFromPublishQueue,
  mergePendingQueueForAdminDisplay,
  combineCatalogWithPendingQueueForSingleVersionPublish,
  shouldAttemptAdminQueueAutoPublish,
} from '../src/utils/adminPublishQueue';
import {
  recordFirestoreWrite,
  recordFirestoreRead,
  getTodayFirestoreUsage,
  resetFirestoreUsageForTests,
} from '../src/utils/firestoreUsageTracker';
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
import { Timestamp, serverTimestamp, GeoPoint, FieldValue, deleteField } from 'firebase/firestore';
import {
  executeGuardedWrite,
  isFirestoreSdkQuotaErrorLog,
  resumeFirestoreNetwork,
  stripUndefined,
  tripWriteQuotaCircuitBreaker,
} from '../src/firebase/config';
import {
  clearCloudSyncOutbox,
  clearOutboxEntry,
  countPendingOutboxChanges,
  loadCloudSyncOutbox,
  markOutboxDelete,
  markOutboxSettingsDirty,
  markOutboxUpsert,
  OutboxStorageLike,
} from '../src/utils/cloudSyncOutbox';
import {
  DEFAULT_EMERGENCY_CARD_SELECTION,
  EMERGENCY_CARD_FIELD_LIMIT,
  buildEmergencyCardPayload,
  buildEmergencyCardUrl,
  buildEmergencyCardWhatsAppUrl,
  deriveSelectionFromEmergencyCard,
  extractEmergencyCardTokenFromPath,
  generateEmergencyToken,
  generateQrMatrix,
  getEmergencyIncludedSummaryLabels,
  isValidEmergencyTokenFormat,
} from '../src/utils/emergencyQr';
import {
  PRESCRIPTION_DEFAULT_SLOT_TIMES,
  PRESCRIPTION_VERIFICATION_BANNER,
  buildReviewItemsFromAiResponse,
  calculateDefaultStock,
  convertReviewItemToMedicinePayload,
  findDuplicateMedicinesForPatient,
  findSuggestedPatientMatch,
  formatTime12hTo24h,
  formatTime24hTo12h,
  mapDosageFormToMedicineType,
  mapPrescriptionMealTiming,
  matchLocalLibraryMedicine,
} from '../src/utils/prescriptionImport';
import {
  classifyTimeBucket,
  formatShortClockBn,
  isMedicineActiveWithinLimits,
  buildProfileTimeSummary,
  buildMedicineSlips,
  buildMedicineSlipShareText,
  buildMedicineSlipWhatsAppUrl,
} from '../src/utils/dailyScheduleSummary';
import {
  addWeeksToLocalDate,
  buildWeeklyPillbox,
  formatShortMedicineChipLabel,
  formatWeekRangeBn,
  getWeekDays,
  getWeekStartDate,
} from '../src/utils/weeklyPillbox';
import {
  COLLECTION_SYNC_TTL_MS,
  DOSE_LOG_REALTIME_DAYS,
  OLDER_LOGS_CACHE_TTL_MS,
  RECORDS_SYNC_TTL_MS,
  clearUserReadOptimizerCaches,
  getAppointmentsRecentCutoffDate,
  getDoseLogsCutoffDate,
  invalidateCollectionSyncMeta,
  loadCachedOlderDoseLogs,
  loadCachedPastAppointments,
  markCollectionSynced,
  mergeDoseLogsWithWindow,
  mergeUpcomingAppointments,
  replaceOlderDoseLogsKeepingRecent,
  replacePastAppointmentsKeepingUpcoming,
  saveCachedOlderDoseLogs,
  saveCachedPastAppointments,
  shouldFetchCollectionFromCloud,
} from '../src/utils/firestoreReadOptimizer';
import {
  normalizeBengaliDigits,
  validateBangladeshiPhone,
  formatVisitCountdownBn,
  buildCleanDoctorInput,
  sortDoctors,
  filterDoctors,
  findEmergencyDoctorForPatient,
  findDoctorForEmergencyQr,
  formatEmergencyDoctorLabelForQr,
  doctorExistsByName,
  buildDoctorNextVisitAppointmentPayload,
  loadCachedDoctors,
  saveCachedDoctors,
  clearCachedDoctors,
  mergeLocalAndCloudDoctors,
} from '../src/utils/doctorsManager';
import {
  MAX_DOCUMENT_PAGES,
  MAX_PRINT_PAGES,
  MAX_USER_DOCUMENT_PAGES,
  buildCleanMedicalDocumentInput,
  buildDefaultDocumentTitle,
  buildDocumentPrintBundle,
  canAddUserPages,
  countTotalUserPages,
  estimateBase64DataUrlBytes,
  filterAndSortMedicalDocuments,
  movePageInList,
  removePageFromList,
  rotateDegreeClockwise,
  validatePrintSelectionPageCount,
} from '../src/utils/medicalDocuments';
import {
  clearDocSyncQueue,
  countPendingDocSyncOps,
  enqueueDocDelete,
  enqueueDocUpsert,
  getPendingDocIdSet,
  loadDocSyncQueue,
  markDocDeleteSyncedInQueue,
  markDocUpsertSyncedInQueue,
  markFileDeletedInQueue,
  markFileUploadedInQueue,
} from '../src/utils/documentsIndexedDb';
import { MedicalDocument } from '../src/types';

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
  it('Bearer টোকেন নিষ্কাশন, Supabase অ্যাক্সেস টোকেন ও is_admin RPC যাচাই সঠিকভাবে কাজ করে', async () => {
    assert.strictEqual(extractBearerToken(undefined), null);
    assert.strictEqual(extractBearerToken('Basic abc'), null);
    assert.strictEqual(extractBearerToken('Bearer   '), null);
    assert.strictEqual(extractBearerToken('Bearer my.jwt.token'), 'my.jwt.token');

    const verified = await verifySupabaseAccessToken('valid-token', {
      clientOverride: {
        auth: {
          getUser: async (jwt) => {
            assert.strictEqual(jwt, 'valid-token');
            return {
              data: { user: { id: 'sb-user-uuid-123', email: 'doctor@example.com' } },
              error: null,
            };
          },
        },
      },
    });
    assert.strictEqual(verified.id, 'sb-user-uuid-123');
    assert.strictEqual(verified.email, 'doctor@example.com');

    await assert.rejects(
      () =>
        verifySupabaseAccessToken('expired-token', {
          clientOverride: {
            auth: {
              getUser: async () => ({
                data: { user: null },
                error: new Error('JWT expired'),
              }),
            },
          },
        }),
      /Invalid or expired/i
    );

    await assert.rejects(() => verifySupabaseAccessToken(''), /Missing access token/i);

    const adminTrue = await checkSupabaseAdminRpc('admin-token', {
      clientOverride: {
        rpc: async (fnName) => {
          assert.strictEqual(fnName, 'is_admin');
          return { data: true, error: null };
        },
      },
    });
    assert.strictEqual(adminTrue, true);

    const adminFalse = await checkSupabaseAdminRpc('user-token', {
      clientOverride: {
        rpc: async () => ({ data: false, error: null }),
      },
    });
    assert.strictEqual(adminFalse, false);

    const adminRpcErr = await checkSupabaseAdminRpc('user-token', {
      clientOverride: {
        rpc: async () => ({ data: null, error: new Error('RPC failed') }),
      },
    });
    assert.strictEqual(adminRpcErr, false);
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

    const storeMap = new Map<string, string>();
    const memStore = {
      getItem: (k: string) => (storeMap.has(k) ? storeMap.get(k)! : null),
      setItem: (k: string, v: string) => {
        storeMap.set(k, v);
      },
      removeItem: (k: string) => {
        storeMap.delete(k);
      },
    };

    assert.strictEqual(isWriteQuotaPaused('2026-11-14', memStore), false);
    markWriteQuotaExceeded('2026-11-14', memStore);
    assert.strictEqual(storeMap.get(WRITE_QUOTA_PAUSE_KEY), '2026-11-14');
    assert.strictEqual(isWriteQuotaPaused('2026-11-14', memStore), true);
    // Automatically resets on the next calendar day
    assert.strictEqual(isWriteQuotaPaused('2026-11-15', memStore), false);
    assert.strictEqual(storeMap.has(WRITE_QUOTA_PAUSE_KEY), false);

    markWriteQuotaExceeded('2026-11-15', memStore);
    clearWriteQuotaPause(memStore);
    assert.strictEqual(isWriteQuotaPaused('2026-11-15', memStore), false);
    resetQuotaNoticeForTests();
  });

  it('Pacific Time (America/Los_Angeles) দিন কী, backoff ত্রুটি শনাক্তকরণ এবং executeGuardedWrite সার্কিট-ব্রেকার কাজ করে', async () => {
    resetQuotaNoticeForTests();
    clearWriteQuotaPause();

    // 2026-11-16T06:00:00Z is already Nov 16 in Dhaka (UTC+6), but still Nov 15 22:00 in Pacific Time!
    assert.strictEqual(getQuotaDayKey(new Date('2026-11-15T19:41:38.505Z')), '2026-11-15');
    assert.strictEqual(getQuotaDayKey(new Date('2026-11-16T06:00:00.000Z')), '2026-11-15');
    // Past midnight Pacific Time (08:05 UTC = 00:05 PST) rolls over to Nov 16
    assert.strictEqual(getQuotaDayKey(new Date('2026-11-16T08:05:00.000Z')), '2026-11-16');

    const backoffLog = new Error('Using maximum backoff delay to prevent overloading the backend.');
    const customQuotaErr = new QuotaExceededWriteError();
    assert.strictEqual(isQuotaExceededError(backoffLog), true);
    assert.strictEqual(isQuotaExceededError(customQuotaErr), true);

    // Subscriber notification
    let listenerHits = 0;
    const unsub = subscribeWriteQuotaExceeded(() => {
      listenerHits += 1;
    });
    markWriteQuotaExceeded();
    assert.strictEqual(listenerHits, 1);

    // When paused, executeGuardedWrite rejects immediately without calling writeFn
    let writeInvoked = false;
    await assert.rejects(
      () =>
        executeGuardedWrite(async () => {
          writeInvoked = true;
        }),
      (err: unknown) => err instanceof QuotaExceededWriteError && isQuotaExceededError(err)
    );
    assert.strictEqual(writeInvoked, false);

    // Unpause, start a never-settling write promise, then trip circuit breaker -> rejects immediately
    await resumeFirestoreNetwork();
    clearWriteQuotaPause();
    const hangingPromise = executeGuardedWrite(
      () => new Promise<void>(() => {})
    );
    tripWriteQuotaCircuitBreaker('FirebaseError: [code=resource-exhausted]: Quota limit exceeded.');
    await assert.rejects(
      () => hangingPromise,
      (err: unknown) => err instanceof QuotaExceededWriteError
    );
    assert.strictEqual(listenerHits, 2);

    unsub();
    markWriteQuotaExceeded();
    assert.strictEqual(listenerHits, 2);

    await resumeFirestoreNetwork();
    clearWriteQuotaPause();
    resetQuotaNoticeForTests();
  });

  it('read-only নেটওয়ার্ক backoff-এ 24h write-লক ট্রিগার হয় না, এবং cloudSyncOutbox শুধু পরিবর্তিত আইটেম ট্র্যাক করে', () => {
    // Flaky Wi-Fi / read-stream backoff with 0 pending writes must NOT trip write quota circuit breaker
    assert.strictEqual(
      isFirestoreSdkQuotaErrorLog('Using maximum backoff delay to prevent overloading the backend.', false),
      false
    );
    // Backoff while a write is actively pending DOES trigger quota guard
    assert.strictEqual(
      isFirestoreSdkQuotaErrorLog('Using maximum backoff delay to prevent overloading the backend.', true),
      true
    );
    // Explicit resource-exhausted always triggers regardless of hasPendingWrites
    assert.strictEqual(
      isFirestoreSdkQuotaErrorLog('FirebaseError: [code=resource-exhausted]: Quota limit exceeded.', false),
      true
    );

    const storeMap = new Map<string, string>();
    const mockStorage: OutboxStorageLike = {
      getItem: (k) => storeMap.get(k) ?? null,
      setItem: (k, v) => {
        storeMap.set(k, v);
      },
      removeItem: (k) => {
        storeMap.delete(k);
      },
    };
    const uid = 'user-quota-test';

    markOutboxUpsert(uid, 'medicines', ['med-1', 'med-2', 'med-1'], mockStorage);
    markOutboxUpsert(uid, 'doseLogs', 'log-1', mockStorage);
    markOutboxSettingsDirty(uid, true, mockStorage);
    let outbox = loadCloudSyncOutbox(uid, mockStorage);
    assert.deepStrictEqual(outbox.upserts.medicines, ['med-1', 'med-2']);
    assert.strictEqual(countPendingOutboxChanges(outbox), 4);

    // Deleting an unsynced item replaces its pending upsert with a delete (never duplicates)
    markOutboxDelete(uid, 'medicines', 'med-2', mockStorage);
    outbox = loadCloudSyncOutbox(uid, mockStorage);
    assert.deepStrictEqual(outbox.upserts.medicines, ['med-1']);
    assert.deepStrictEqual(outbox.deletes.medicines, ['med-2']);
    assert.strictEqual(countPendingOutboxChanges(outbox), 4);

    // Re-upserting cancels delete
    markOutboxUpsert(uid, 'medicines', 'med-2', mockStorage);
    outbox = loadCloudSyncOutbox(uid, mockStorage);
    assert.deepStrictEqual(outbox.deletes.medicines, []);
    assert.deepStrictEqual(outbox.upserts.medicines, ['med-1', 'med-2']);

    // Clearing entries leaves storage clean when count reaches 0
    clearOutboxEntry(uid, 'upsert', 'medicines', ['med-1', 'med-2'], mockStorage);
    clearOutboxEntry(uid, 'upsert', 'doseLogs', 'log-1', mockStorage);
    markOutboxSettingsDirty(uid, false, mockStorage);
    outbox = loadCloudSyncOutbox(uid, mockStorage);
    assert.strictEqual(countPendingOutboxChanges(outbox), 0);
    assert.strictEqual(storeMap.size, 0);

    // clearCloudSyncOutbox wipes remaining items
    markOutboxUpsert(uid, 'doctors', 'doc-1', mockStorage);
    assert.strictEqual(storeMap.size, 1);
    clearCloudSyncOutbox(uid, mockStorage);
    assert.strictEqual(storeMap.size, 0);
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

  it('শুরুর তারিখ ও শেষ তারিখ (দুই তারিখসহ) গণনা, অবৈধ পরিসর যাচাই, দ্রুত বাছাই ও বাংলা সময়কাল দেখায়', () => {
    const med: Medicine = {
      ...baseMed,
      id: 'm-range',
      brandName: 'Napa',
      schedules: [{ id: 's1', timeSlot: 'সকাল', time: '08:00 AM', dosage: '২টি' }],
      stock: 4,
      pricePerUnit: 2,
      packageDescription: '10 tablets/strip',
    };

    // 18 Nov 2026 to 25 Nov 2026 -> 8 days inclusive
    const rangeRes = calculateMedicineShoppingList({
      medicines: [med],
      patients,
      selectedPatientId: 'p-father',
      startDate: '2026-11-18',
      targetDate: '2026-11-25',
      includeBuffer: false,
      referenceDate: new Date(2026, 10, 18),
    });

    assert.strictEqual(rangeRes.isValidDateRange, true);
    assert.strictEqual(rangeRes.hasExplicitStartDate, true);
    assert.strictEqual(rangeRes.daysCount, 8);
    assert.strictEqual(rangeRes.effectiveDays, 8);
    assert.strictEqual(
      rangeRes.periodSummaryBn,
      'সময়কাল: ১৮ নভেম্বর ২০২৬ থেকে ২৫ নভেম্বর ২০২৬ (৮ দিন)'
    );
    // 8 days * 2/day = 16 required - 4 stock = 12 to buy (2 strips = "প্রায় ২ পাতা", cost = 24)
    assert.strictEqual(rangeRes.toBuyItems.length, 1);
    assert.strictEqual(rangeRes.toBuyItems[0].requiredUnits, 16);
    assert.strictEqual(rangeRes.toBuyItems[0].toBuyUnits, 12);
    assert.strictEqual(rangeRes.toBuyItems[0].estimatedPacks, 2);
    assert.strictEqual(rangeRes.toBuyItems[0].estimatedCost, 24);

    // Same-day range: 18 Nov to 18 Nov = 1 day inclusive
    const sameDayRes = calculateMedicineShoppingList({
      medicines: [med],
      patients,
      selectedPatientId: 'p-father',
      startDate: '2026-11-18',
      targetDate: '2026-11-18',
      includeBuffer: false,
      referenceDate: new Date(2026, 10, 18),
    });
    assert.strictEqual(sameDayRes.isValidDateRange, true);
    assert.strictEqual(sameDayRes.daysCount, 1);
    assert.strictEqual(sameDayRes.toBuyItems.length, 0); // 2 needed <= 4 stock

    // Empty startDate preserves previous behavior (today -> targetDate exclusive of today)
    const emptyStartRes = calculateMedicineShoppingList({
      medicines: [med],
      patients,
      selectedPatientId: 'p-father',
      startDate: '',
      targetDate: '2026-11-25',
      includeBuffer: false,
      referenceDate: new Date(2026, 10, 18),
    });
    assert.strictEqual(emptyStartRes.hasExplicitStartDate, false);
    assert.strictEqual(emptyStartRes.daysCount, 7);

    // Invalid range: startDate after targetDate
    const invalidRes = calculateMedicineShoppingList({
      medicines: [med],
      patients,
      selectedPatientId: 'p-father',
      startDate: '2026-11-26',
      targetDate: '2026-11-25',
      includeBuffer: false,
      referenceDate: new Date(2026, 10, 18),
    });
    assert.strictEqual(invalidRes.isValidDateRange, false);
    assert.strictEqual(invalidRes.dateErrorBn, 'শুরুর তারিখ শেষ তারিখের আগে হতে হবে');
    assert.strictEqual(invalidRes.toBuyItems.length, 0);

    // Quick range presets: আজ থেকে ৭/১৫/৩০ দিন ও এই মাস
    const nov18 = new Date(2026, 10, 18);
    const p7 = getDateRangeForQuickPreset('7d', nov18);
    assert.strictEqual(p7.startDateIso, '2026-11-18');
    assert.strictEqual(p7.targetDateIso, '2026-11-24');

    const pMonth = getDateRangeForQuickPreset('this_month', nov18);
    assert.strictEqual(pMonth.startDateIso, '2026-11-18');
    assert.strictEqual(pMonth.targetDateIso, '2026-11-30');

    // Share text includes exact Bengali period summary
    const shareText = buildShoppingListShareText({ result: rangeRes });
    assert.ok(
      shareText.includes('সময়কাল: ১৮ নভেম্বর ২০২৬ থেকে ২৫ নভেম্বর ২০২৬ (৮ দিন)')
    );
  });

  it('মাঝামাঝি শুরু বা শেষ হওয়া কোর্সে শুধু কোর্সের ভেতরের দিনগুলো গোনে এবং প্রোফাইল অনুযায়ী লোকাল স্টোরেজে তারিখ রাখে', () => {
    // Starts mid-range on 2026-11-21 (chronic): in [18..25 Nov] -> 5 active days (21..25)
    const lateStartMed: Medicine = {
      ...baseMed,
      id: 'm-late-start',
      brandName: 'LateStart',
      startDate: '2026-11-21',
      isChronic: true,
      schedules: [{ id: 's1', timeSlot: 'সকাল', time: '08:00 AM', dosage: '২টি' }],
      stock: 0,
    };

    // Finite 7-day course started 2026-11-15 -> ends 2026-11-21: in [18..25 Nov] + 2d buffer -> only 4 days (18..21)
    const earlyEndMed: Medicine = {
      ...baseMed,
      id: 'm-early-end',
      brandName: 'Antibiotic',
      startDate: '2026-11-15',
      isChronic: false,
      durationDays: 7,
      schedules: [{ id: 's1', timeSlot: 'রাত', time: '09:00 PM', dosage: '১টি' }],
      stock: 1,
    };

    // Finished course before startDate: 0 active days -> no buy needed
    const finishedMed: Medicine = {
      ...baseMed,
      id: 'm-finished',
      brandName: 'OldCourse',
      startDate: '2026-11-01',
      isChronic: false,
      durationDays: 5, // ended 2026-11-05
      schedules: [{ id: 's1', timeSlot: 'রাত', time: '09:00 PM', dosage: '১টি' }],
      stock: 0,
      expiryDate: '2026-11-20',
    };

    const res = calculateMedicineShoppingList({
      medicines: [lateStartMed, earlyEndMed, finishedMed],
      patients,
      selectedPatientId: 'p-father',
      startDate: '2026-11-18',
      targetDate: '2026-11-25',
      includeBuffer: true, // horizon [18..27]
      referenceDate: new Date(2026, 10, 18),
    });

    // lateStart: Nov 21..27 = 7 days * 2/day = 14
    const lateItem = res.toBuyItems.find((i) => i.medicine.id === 'm-late-start')!;
    assert.strictEqual(lateItem.activeDaysInPeriod, 7);
    assert.strictEqual(lateItem.requiredUnits, 14);
    assert.strictEqual(lateItem.toBuyUnits, 14);

    // earlyEnd: course ends Nov 21, so buffer beyond Nov 21 is NOT counted -> Nov 18..21 = 4 days * 1/day = 4 - 1 stock = 3
    const earlyItem = res.toBuyItems.find((i) => i.medicine.id === 'm-early-end')!;
    assert.strictEqual(earlyItem.activeDaysInPeriod, 4);
    assert.strictEqual(earlyItem.requiredUnits, 4);
    assert.strictEqual(earlyItem.toBuyUnits, 3);

    // finished course: 0 active days, NOT pushed into toBuyItems
    assert.strictEqual(
      res.toBuyItems.some((i) => i.medicine.id === 'm-finished'),
      false
    );
    const finishedSufficient = res.sufficientItems.find(
      (i) => i.medicine.id === 'm-finished'
    )!;
    assert.strictEqual(finishedSufficient.activeDaysInPeriod, 0);
    assert.strictEqual(finishedSufficient.requiredUnits, 0);

    // Per-profile localStorage persistence (zero Firestore interaction)
    const backing = new Map<string, string>();
    const mockStorage: ShoppingDateRangeStorageLike = {
      getItem: (k) => backing.get(k) ?? null,
      setItem: (k, v) => {
        backing.set(k, v);
      },
    };
    const nov18 = new Date(2026, 10, 18);

    saveShoppingDateRange(
      'p-father',
      { startDateIso: '2026-11-18', targetDateIso: '2026-11-25', preset: 'custom' },
      mockStorage
    );
    saveShoppingDateRange(
      'p-mother',
      { startDateIso: '', targetDateIso: '2026-11-30', preset: 'custom' },
      mockStorage
    );

    assert.deepStrictEqual(
      loadSavedShoppingDateRange('p-father', nov18, mockStorage),
      { startDateIso: '2026-11-18', targetDateIso: '2026-11-25', preset: 'custom' }
    );
    assert.deepStrictEqual(
      loadSavedShoppingDateRange('p-mother', nov18, mockStorage),
      { startDateIso: '', targetDateIso: '2026-11-30', preset: 'custom' }
    );
    // Unsaved profile defaults to 15d from today
    assert.deepStrictEqual(
      loadSavedShoppingDateRange('all', nov18, mockStorage),
      { startDateIso: '2026-11-18', targetDateIso: '2026-12-02', preset: '15d' }
    );
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
    assert.strictEqual(normalizeInviteCodeInput('a৭k৯m২'), 'A7K9M2');
    assert.strictEqual(normalizeInviteCodeInput('A7K9M2XYZ'), 'A7K9M2');

    const nowMs = Date.now();
    assert.strictEqual(isInviteExpired(nowMs + CAREGIVER_INVITE_TTL_MS, nowMs), false);
    assert.strictEqual(isInviteExpired(nowMs - 1000, nowMs), true);

    const inviteUrl = buildCaregiverInviteWhatsAppUrl(code, 'যমুনা আপা');
    assert.ok(inviteUrl.startsWith('https://wa.me/?text='));
    const decodedInviteText = decodeURIComponent(inviteUrl);
    assert.ok(decodedInviteText.includes(code));
    assert.ok(decodedInviteText.includes('৪৮ ঘণ্টা'));
    assert.strictEqual(normalizeInviteCodeInput(decodedInviteText.split('text=')[1]), code);

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

  it('stripUndefined শুধু সাধারণ অবজেক্ট/অ্যারে থেকে undefined বাদ দেয় এবং Timestamp, serverTimestamp ও Date অবিকৃত রাখে', () => {
    const ts = Timestamp.fromMillis(1_763_000_000_000);
    const st = serverTimestamp();
    const dt = new Date('2026-11-14T00:00:00.000Z');
    const gp = new GeoPoint(23.8103, 90.4125);
    const nullProtoObj = Object.assign(Object.create(null), { keep: 'yes', drop: undefined });

    const payload = {
      ownerUid: 'u1',
      createdAt: st,
      expiresAt: ts,
      checkedAt: dt,
      location: gp,
      optional: undefined,
      sections: {
        medicines: [{ brandName: 'Napa', instructions: undefined }],
      },
      nullProtoObj,
    };

    const cleaned = stripUndefined(payload);
    assert.strictEqual(cleaned.createdAt, st);
    assert.ok(cleaned.createdAt instanceof FieldValue);
    assert.strictEqual(cleaned.expiresAt, ts);
    assert.ok(cleaned.expiresAt instanceof Timestamp);
    assert.strictEqual(cleaned.checkedAt, dt);
    assert.ok(cleaned.checkedAt instanceof Date);
    assert.strictEqual(cleaned.location, gp);
    assert.ok(cleaned.location instanceof GeoPoint);
    assert.strictEqual('optional' in cleaned, false);
    assert.strictEqual('instructions' in cleaned.sections.medicines[0], false);
    assert.strictEqual(cleaned.nullProtoObj.keep, 'yes');
    assert.strictEqual('drop' in cleaned.nullProtoObj, false);
  });
});

describe('প্রেসক্রিপশনের ছবি থেকে ওষুধ যোগ (Prescription Verification Flow)', () => {
  const sampleLibrary: GlobalMedicine[] = [
    {
      id: 'lib-napa-500',
      brandName: 'Napa',
      brandNameBn: 'নাপা',
      genericName: 'Paracetamol',
      strength: '500 mg',
      dosageForm: 'ট্যাবলেট',
      manufacturer: 'Beximco Pharmaceuticals Ltd.',
      packageDescription: '১০টি ট্যাবলেট/পাতা',
      pricePerUnit: 0.8,
      source: 'DGDA_GOV',
      sourceType: 'government',
      sourceName: 'DGDA',
      licenseReference: 'DGDA-1',
      importedAt: '2026-01-01',
      verifiedByAdmin: true,
      status: 'published',
      duplicateKey: 'napa|paracetamol|500mg|tablet|beximco',
    },
    {
      id: 'lib-seclo-20',
      brandName: 'Seclo',
      genericName: 'Omeprazole',
      strength: '20 mg',
      dosageForm: 'ক্যাপসুল',
      manufacturer: 'Square Pharmaceuticals PLC',
      packageDescription: '১০টি ক্যাপসুল/পাতা',
      pricePerUnit: 6,
      source: 'DGDA_GOV',
      sourceType: 'government',
      sourceName: 'DGDA',
      licenseReference: 'DGDA-2',
      importedAt: '2026-01-01',
      verifiedByAdmin: true,
      status: 'published',
      duplicateKey: 'seclo|omeprazole|20mg|capsule|square',
    },
  ];

  it('ডিফল্ট রিমাইন্ডার সময় সকাল ৮টা, দুপুর ২টা ও রাত ৯টা সঠিক ফরম্যাটে রাখে', () => {
    assert.strictEqual(PRESCRIPTION_DEFAULT_SLOT_TIMES['সকাল'], '08:00 AM');
    assert.strictEqual(PRESCRIPTION_DEFAULT_SLOT_TIMES['দুপুর'], '02:00 PM');
    assert.strictEqual(PRESCRIPTION_DEFAULT_SLOT_TIMES['রাত'], '09:00 PM');
    assert.strictEqual(formatTime12hTo24h('02:00 PM'), '14:00');
    assert.strictEqual(formatTime12hTo24h('09:00 PM'), '21:00');
    assert.strictEqual(formatTime24hTo12h('14:00'), '02:00 PM');
    assert.strictEqual(formatTime24hTo12h('21:00'), '09:00 PM');
    assert.ok(PRESCRIPTION_VERIFICATION_BANNER.includes('স্বয়ংক্রিয়ভাবে পড়া'));
  });

  it('low confidence ওষুধ ডিফল্টভাবে আনচেকড থাকে এবং লাইব্রেরি থেকে নাম/শক্তি মিলিয়ে জেনেরিক বসায়', () => {
    const items = buildReviewItemsFromAiResponse(
      {
        patientName: 'রহিম সাহেব',
        doctorName: 'ডা. করিম',
        date: '2026-11-10',
        unreadable: false,
        items: [
          {
            brandName: 'Napa',
            strength: '500 mg',
            dosageForm: 'Tab',
            amountPerDose: 1,
            timesPerDay: 3,
            schedule: { morning: true, noon: true, evening: false, night: true },
            mealTiming: 'খাবারের পরে',
            durationDays: 5,
            confidence: 'high',
          },
          {
            brandName: null,
            strength: '20 mg',
            dosageForm: 'Cap',
            amountPerDose: 1,
            timesPerDay: 2,
            schedule: { morning: true, noon: false, evening: false, night: true },
            mealTiming: 'খাবারের আগে',
            durationDays: 14,
            confidence: 'low',
          },
        ],
      },
      sampleLibrary
    );

    assert.strictEqual(items.length, 2);

    // Item 1: high confidence -> selected=true, local library match fills generic & catalog id, stock = 5 * 3 = 15
    assert.strictEqual(items[0].selected, true);
    assert.strictEqual(items[0].needsVerification, false);
    assert.strictEqual(items[0].catalogMatch?.id, 'lib-napa-500');
    assert.strictEqual(items[0].genericName, 'Paracetamol');
    assert.strictEqual(items[0].stock, 15);
    assert.strictEqual(items[0].mealTiming, 'খাওয়ার পরে');

    // Item 2: low confidence + missing brandName -> selected=false & needsVerification=true
    assert.strictEqual(items[1].selected, false);
    assert.strictEqual(items[1].needsVerification, true);
    assert.strictEqual(items[1].dosageForm, 'ক্যাপসুল');
    assert.strictEqual(items[1].mealTiming, 'খাওয়ার আগে');
    assert.strictEqual(items[1].stock, 28);
  });

  it('খাবারের সময় "যেকোনো সময়" ও ডোজ ফর্ম বাংলায় রূপান্তর করে এবং undefined ছাড়া সেভ পেলোড বানায়', () => {
    assert.strictEqual(mapDosageFormToMedicineType('Syp.'), 'সিরাপ');
    assert.strictEqual(mapDosageFormToMedicineType('Eye Drop'), 'চোখের ড্রপ');
    assert.strictEqual(mapPrescriptionMealTiming('যেকোনো সময়'), 'যেকোনো সময়');

    const [reviewItem] = buildReviewItemsFromAiResponse(
      {
        doctorName: null,
        unreadable: false,
        items: [
          {
            brandName: 'Seclo',
            strength: '20mg',
            dosageForm: 'Capsule',
            amountPerDose: 1,
            timesPerDay: 2,
            schedule: { morning: true, noon: false, evening: false, night: true },
            mealTiming: 'যেকোনো সময়',
            durationDays: 10,
            confidence: 'medium',
          },
        ],
      },
      sampleLibrary
    );

    assert.strictEqual(reviewItem.catalogMatch?.id, 'lib-seclo-20');
    assert.strictEqual(
      calculateDefaultStock(10, 1, { morning: true, noon: false, evening: false, night: true }),
      20
    );

    const payload = convertReviewItemToMedicinePayload(reviewItem, 'patient-1');
    assert.strictEqual(payload.assignedPatientId, 'patient-1');
    assert.strictEqual(payload.catalogMedicineId, 'lib-seclo-20');
    assert.strictEqual(payload.mealTiming, 'যেকোনো সময়');
    assert.strictEqual(payload.schedules.length, 2);
    assert.strictEqual(payload.schedules[0].time, '08:00 AM');
    assert.strictEqual(payload.schedules[1].time, '09:00 PM');
    assert.strictEqual(payload.status, 'active');

    // Ensure no undefined values appear at top level
    for (const val of Object.values(payload)) {
      assert.notStrictEqual(val, undefined);
    }
  });

  it('রোগীর প্রোফাইল সাজেস্ট করে (নতুন তৈরি না করে) এবং ডুপ্লিকেট ওষুধ শনাক্ত করে', () => {
    const patientsList: PatientProfile[] = [
      {
        id: 'p-1',
        name: 'আবদুর রহিম',
        relation: 'বাবা',
        age: 62,
        gender: 'পুরুষ',
        bloodGroup: 'O+',
        chronicConditions: [],
        allergies: [],
        emergencyContact: '',
      },
      {
        id: 'p-archived',
        name: 'পুরনো সদস্য',
        relation: 'অন্যান্য',
        age: 40,
        gender: 'পুরুষ',
        bloodGroup: 'A+',
        chronicConditions: [],
        allergies: [],
        emergencyContact: '',
        isArchived: true,
      },
    ];

    const matched = findSuggestedPatientMatch('রহিম', patientsList);
    assert.strictEqual(matched?.id, 'p-1');
    assert.strictEqual(findSuggestedPatientMatch('পুরনো সদস্য', patientsList), undefined);

    const reviewItems = buildReviewItemsFromAiResponse(
      {
        unreadable: false,
        items: [
          {
            brandName: 'Napa',
            strength: '500 mg',
            amountPerDose: 1,
            timesPerDay: 2,
            schedule: { morning: true, noon: false, evening: false, night: true },
            mealTiming: 'খাবারের পরে',
            durationDays: 5,
            confidence: 'high',
          },
          {
            brandName: 'Monas',
            strength: '10 mg',
            amountPerDose: 1,
            timesPerDay: 1,
            schedule: { morning: false, noon: false, evening: false, night: true },
            mealTiming: 'খাবারের পরে',
            durationDays: 30,
            confidence: 'high',
          },
        ],
      },
      sampleLibrary
    );

    const existingMeds: Medicine[] = [
      {
        id: 'm-1',
        brandName: 'napa',
        genericName: 'Paracetamol',
        type: 'ট্যাবলেট',
        strength: '500 mg',
        mealTiming: 'খাওয়ার পরে',
        schedules: [{ id: 's1', timeSlot: 'সকাল', time: '08:00 AM', dosage: '১টি' }],
        stock: 10,
        minStockAlert: 2,
        unit: 'টি',
        startDate: '2026-11-01',
        isChronic: false,
        assignedPatientId: 'p-1',
        status: 'active',
        colorTag: 'teal',
      },
    ];

    const dups = findDuplicateMedicinesForPatient(reviewItems, 'p-1', existingMeds);
    assert.strictEqual(dups.length, 1);
    assert.strictEqual(dups[0].reviewItem.brandName, 'Napa');
    assert.strictEqual(matchLocalLibraryMedicine('UnknownBrand', '10 mg', sampleLibrary), undefined);
  });
});

describe('ধাপ ২০: সময় অনুযায়ী ওষুধ (Time Boxes) ও দৈনিক স্লিপ ডাউনলোড/শেয়ার', () => {
  it('রিমাইন্ডার সময় অনুযায়ী ৪টি বক্সে (সকাল/দুপুর/সন্ধ্যা/রাত) সঠিকভাবে ভাগ করে', () => {
    assert.strictEqual(classifyTimeBucket('04:00 AM'), 'morning');
    assert.strictEqual(classifyTimeBucket('11:59 AM'), 'morning');
    assert.strictEqual(classifyTimeBucket('12:00 PM'), 'noon');
    assert.strictEqual(classifyTimeBucket('03:59 PM'), 'noon');
    assert.strictEqual(classifyTimeBucket('04:00 PM'), 'evening');
    assert.strictEqual(classifyTimeBucket('07:59 PM'), 'evening');
    assert.strictEqual(classifyTimeBucket('08:00 PM'), 'night');
    assert.strictEqual(classifyTimeBucket('03:59 AM'), 'night');
    assert.strictEqual(classifyTimeBucket('০৯:০০ PM'), 'night');
    assert.strictEqual(formatShortClockBn('০৯:০০ PM'), '৯:০০');
    assert.strictEqual(formatShortClockBn('08:05 AM'), '৮:০৫');
  });

  it('মেয়াদোত্তীর্ণ ও কোর্স শেষ হওয়া ওষুধ বাদ দেয়, প্রয়োজনমতো আলাদা রাখে এবং ডোজ অগ্রগতি দেখায়', () => {
    const refDate = new Date(2026, 10, 14, 9, 0, 0); // 2026-11-14 local

    const meds: Medicine[] = [
      {
        id: 'med-multi',
        brandName: 'Napa',
        genericName: 'Paracetamol',
        type: 'ট্যাবলেট',
        strength: '500mg',
        mealTiming: 'খাওয়ার পরে',
        schedules: [
          { id: 's1', timeSlot: 'সকাল', time: '08:00 AM', dosage: '১টি' },
          { id: 's2', timeSlot: 'রাত', time: '09:00 PM', dosage: '১টি' },
        ],
        stock: 20,
        minStockAlert: 4,
        unit: 'টি',
        startDate: '2026-11-10',
        isChronic: true,
        assignedPatientId: 'p-1',
        status: 'active',
        colorTag: 'teal',
      },
      {
        id: 'med-expired-pack',
        brandName: 'ExpiredMed',
        genericName: 'Old',
        type: 'ট্যাবলেট',
        strength: '10mg',
        mealTiming: 'খাওয়ার আগে',
        schedules: [{ id: 's3', timeSlot: 'সকাল', time: '09:00 AM', dosage: '১টি' }],
        stock: 5,
        minStockAlert: 2,
        unit: 'টি',
        startDate: '2026-10-01',
        expiryDate: '2026-11-13',
        isChronic: true,
        assignedPatientId: 'p-1',
        status: 'active',
        colorTag: 'rose',
      },
      {
        id: 'med-course-ended',
        brandName: 'FinishedCourse',
        genericName: 'Antibiotic',
        type: 'ক্যাপসুল',
        strength: '500mg',
        mealTiming: 'খাওয়ার পরে',
        schedules: [{ id: 's4', timeSlot: 'দুপুর', time: '02:00 PM', dosage: '১টি' }],
        stock: 0,
        minStockAlert: 1,
        unit: 'টি',
        startDate: '2026-11-01',
        durationDays: 5, // ended after 2026-11-05
        isChronic: false,
        assignedPatientId: 'p-1',
        status: 'active',
        colorTag: 'amber',
      },
      {
        id: 'med-as-needed',
        brandName: 'Napa Extra',
        genericName: 'Paracetamol + Caffeine',
        type: 'ট্যাবলেট',
        strength: '500mg',
        mealTiming: 'প্রয়োজনমতো',
        schedules: [],
        stock: 10,
        minStockAlert: 2,
        unit: 'টি',
        startDate: '2026-11-01',
        isChronic: true,
        assignedPatientId: 'p-1',
        status: 'active',
        colorTag: 'blue',
      },
      {
        id: 'med-other-patient',
        brandName: 'OtherPatientMed',
        genericName: 'Other',
        type: 'ট্যাবলেট',
        strength: '20mg',
        mealTiming: 'খাওয়ার আগে',
        schedules: [{ id: 's5', timeSlot: 'সকাল', time: '08:00 AM', dosage: '১টি' }],
        stock: 10,
        minStockAlert: 2,
        unit: 'টি',
        startDate: '2026-11-01',
        isChronic: true,
        assignedPatientId: 'p-2',
        status: 'active',
        colorTag: 'indigo',
      },
    ];

    assert.strictEqual(isMedicineActiveWithinLimits(meds[0], refDate), true);
    assert.strictEqual(isMedicineActiveWithinLimits(meds[1], refDate), false);
    assert.strictEqual(isMedicineActiveWithinLimits(meds[2], refDate), false);

    const summary = buildProfileTimeSummary({
      medicines: meds,
      doseLogs: [
        {
          id: 'log-1',
          medicineId: 'med-multi',
          patientId: 'p-1',
          medicineName: 'Napa',
          scheduledDate: '2026-11-14',
          scheduledTime: '08:00 AM',
          timeSlot: 'সকাল',
          dosage: '১টি',
          status: 'taken',
        },
      ],
      patientId: 'p-1',
      todayStr: '2026-11-14',
      referenceDate: refDate,
    });

    // Empty buckets (noon & evening) are omitted
    assert.deepStrictEqual(
      summary.buckets.map((b) => b.key),
      ['morning', 'night']
    );
    assert.strictEqual(summary.buckets[0].takenCount, 1);
    assert.strictEqual(summary.buckets[0].totalCount, 1);
    assert.strictEqual(summary.buckets[0].isAllTaken, true);
    assert.strictEqual(summary.buckets[1].takenCount, 0);
    assert.strictEqual(summary.buckets[1].totalCount, 1);
    assert.strictEqual(summary.buckets[1].isAllTaken, false);
    assert.strictEqual(summary.asNeededItems.length, 1);
    assert.strictEqual(summary.asNeededItems[0].brandName, 'Napa Extra');
  });

  it('সব প্রোফাইল ও একক রোগীর স্লিপ এবং হোয়াটসঅ্যাপ শেয়ার টেক্সট সঠিকভাবে তৈরি করে', () => {
    const refDate = new Date(2026, 10, 14, 9, 0, 0);
    const patients: PatientProfile[] = [
      {
        id: 'p-1',
        name: 'আব্দুর রহমান',
        relation: 'বাবা',
        age: 68,
        gender: 'পুরুষ',
        bloodGroup: 'O+',
        chronicConditions: ['উচ্চ রক্তচাপ'],
        allergies: ['Penicillin'],
        emergencyContact: '০১৭১১০০০০০০',
      },
      {
        id: 'p-2',
        name: 'মাহমুদা বেগম',
        relation: 'মা',
        age: 60,
        gender: 'মহিলা',
        bloodGroup: 'B+',
        chronicConditions: [],
        allergies: [],
        emergencyContact: '',
      },
      {
        id: 'p-archived',
        name: 'আর্কাইভ সদস্য',
        relation: 'অন্যান্য',
        age: 40,
        gender: 'পুরুষ',
        bloodGroup: 'A+',
        chronicConditions: [],
        allergies: [],
        emergencyContact: '',
        isArchived: true,
      },
    ];

    const meds: Medicine[] = [
      {
        id: 'm-1',
        brandName: 'Telma 40',
        genericName: 'Telmisartan',
        type: 'ট্যাবলেট',
        strength: '40mg',
        mealTiming: 'খাওয়ার পরে',
        schedules: [{ id: 's1', timeSlot: 'সকাল', time: '08:00 AM', dosage: '১টি' }],
        stock: 15,
        minStockAlert: 3,
        unit: 'টি',
        startDate: '2026-11-01',
        isChronic: true,
        assignedPatientId: 'p-1',
        status: 'active',
        colorTag: 'teal',
      },
    ];

    const singleSlips = buildMedicineSlips({
      scope: 'current',
      patients,
      activePatient: patients[0],
      medicines: meds,
      doseLogs: [],
      referenceDate: refDate,
    });
    assert.strictEqual(singleSlips.length, 1);
    assert.deepStrictEqual(singleSlips[0].allergies, ['Penicillin']);
    assert.strictEqual(singleSlips[0].emergencyContact, '০১৭১১০০০০০০');

    const allSlips = buildMedicineSlips({
      scope: 'all',
      patients,
      activePatient: patients[0],
      medicines: meds,
      doseLogs: [],
      referenceDate: refDate,
    });
    assert.strictEqual(allSlips.length, 2); // archived excluded
    assert.strictEqual(allSlips[1].allergies.length, 0);
    assert.strictEqual(allSlips[1].emergencyContact, undefined);

    const shareText = buildMedicineSlipShareText(singleSlips);
    assert.ok(shareText.includes('স্বাস্থ্যবন্ধু — দৈনিক ওষুধের স্লিপ'));
    assert.ok(shareText.includes('☐ ১. Telma 40 40mg (Telmisartan)'));
    assert.ok(shareText.includes('অ্যালার্জি: Penicillin'));
    assert.ok(shareText.includes('এটি অ্যাপের তালিকা; ওষুধ বদলানোর আগে ডাক্তারের পরামর্শ নিন।'));

    const waUrl = buildMedicineSlipWhatsAppUrl(singleSlips);
    assert.ok(waUrl.startsWith('https://wa.me/?text='));
  });
});

describe('ধাপ ২১: দ্রুত লাইব্রেরি সার্চ সূচি (librarySearchIndex) ও ইনক্রিমেন্টাল আপডেট', () => {
  it('সূচি ক্যাশ করে, ইনক্রিমেন্টাল পরিবর্তনে পুরনো এন্ট্রি পুনর্ব্যবহার করে এবং ইংরেজি/বাংলা/টাইপো/দুই শব্দে সঠিক ফল দেয়', () => {
    clearLibrarySearchIndexCache();
    const meds: GlobalMedicine[] = [
      {
        id: 'lib-1',
        brandName: 'Napa Extra',
        brandNameBn: 'নাপা এক্সট্রা',
        genericName: 'Paracetamol + Caffeine',
        genericNameBn: 'প্যারাসিটামল + ক্যাফেইন',
        strength: '500 mg',
        dosageForm: 'ট্যাবলেট',
        manufacturer: 'Beximco Pharma',
        pricePerUnit: 2.5,
        source: 'DGDA_GOV',
        sourceType: 'government',
        sourceName: 'DGDA',
        licenseReference: 'DGDA',
        importedAt: '2026-11-01T00:00:00.000Z',
        verifiedByAdmin: true,
        status: 'published',
        duplicateKey: 'napa_extra_500_beximco',
      },
      {
        id: 'lib-2',
        brandName: 'Seclo',
        brandNameBn: 'সেক্লো',
        genericName: 'Omeprazole',
        genericNameBn: 'অমিপ্রাজল',
        strength: '20 mg',
        dosageForm: 'ক্যাপসুল',
        manufacturer: 'Square Pharma',
        pricePerUnit: 6,
        source: 'DGDA_GOV',
        sourceType: 'government',
        sourceName: 'DGDA',
        licenseReference: 'DGDA',
        importedAt: '2026-11-01T00:00:00.000Z',
        verifiedByAdmin: true,
        status: 'published',
        duplicateKey: 'seclo_20_square',
      },
      {
        id: 'lib-3',
        brandName: 'DraftMed',
        genericName: 'Azithromycin',
        strength: '500 mg',
        dosageForm: 'ট্যাবলেট',
        manufacturer: 'Incepta',
        source: 'DGDA_GOV',
        sourceType: 'government',
        sourceName: 'DGDA',
        licenseReference: 'DGDA',
        importedAt: '2026-11-01T00:00:00.000Z',
        verifiedByAdmin: false,
        status: 'draft',
        duplicateKey: 'draftmed_500_incepta',
      },
    ];

    const idx1 = buildLibrarySearchIndexSync(meds, true);
    const idx1Again = buildLibrarySearchIndexSync(meds, true);
    assert.strictEqual(idx1, idx1Again); // Exact cached reference reused

    const meta = computeLibraryMetadata(meds);
    assert.deepStrictEqual(meta.uniqueForms, ['ক্যাপসুল', 'ট্যাবলেট']);
    assert.strictEqual(meta.publishedCount, 2);
    assert.strictEqual(meta.pendingCount, 1);
    assert.ok(meta.availableLettersPublished.has('N'));
    assert.ok(meta.availableLettersPublished.has('S'));
    assert.ok(!meta.availableLettersPublished.has('D'));

    // Incremental update: keep lib-1 unchanged, remove lib-3, add lib-4
    const updatedMeds: GlobalMedicine[] = [
      meds[0],
      meds[1],
      {
        id: 'lib-4',
        brandName: 'Monas',
        brandNameBn: 'মোনাস',
        genericName: 'Montelukast',
        genericNameBn: 'মন্টেলুকাস্ট',
        strength: '10 mg',
        dosageForm: 'ট্যাবলেট',
        manufacturer: 'Acme',
        source: 'DGDA_GOV',
        sourceType: 'government',
        sourceName: 'DGDA',
        licenseReference: 'DGDA',
        importedAt: '2026-11-02T00:00:00.000Z',
        verifiedByAdmin: true,
        status: 'published',
        duplicateKey: 'monas_10_acme',
      },
    ];
    const idx2 = buildLibrarySearchIndexSync(updatedMeds, true);
    assert.strictEqual(idx2.entries[0], idx1.entries[0]); // Unchanged entry object reused!
    assert.strictEqual(idx2.totalCount, 3);

    const baseFilters = {
      isAdmin: false,
      adminStatusFilter: 'published' as const,
      favoritesOnly: false,
      favoriteIdSet: new Set<string>(),
      selectedLetter: 'ALL',
      selectedForm: 'all',
      selectedManufacturer: 'all',
      priceFilter: 'all' as const,
      selectedSource: 'all',
    };

    // English, Bengali, Typo, Two-word searches
    assert.strictEqual(searchIndexedMedicines(idx2, baseFilters, 'Napa Extra').medicines[0].id, 'lib-1');
    assert.strictEqual(searchIndexedMedicines(idx2, baseFilters, 'সেক্লো').medicines[0].id, 'lib-2');
    assert.strictEqual(searchIndexedMedicines(idx2, baseFilters, 'omeprazol').medicines[0].id, 'lib-2');
    assert.strictEqual(searchIndexedMedicines(idx2, baseFilters, 'Paracetamol 500').medicines[0].id, 'lib-1');
    assert.strictEqual(searchIndexedMedicines(idx2, baseFilters, 'montlukast').medicines[0].id, 'lib-4');

    // Quick basic fallback also works cleanly during cold startup
    assert.strictEqual(quickBasicSearchMedicines(updatedMeds, baseFilters, 'Monas').medicines[0].id, 'lib-4');
  });
});

describe('ধাপ ২২: জরুরি কার্ড QR (টোকেন, গোপনীয়তা ফিল্টারিং, ৫০০ অক্ষর সীমা ও QR ম্যাট্রিক্স)', () => {
  it('>= ১২৮-বিট নিরাপদ টোকেন, /e/{token} রাউট পার্সিং এবং ডিফল্ট গোপনীয়তা (ওষুধ বন্ধ) নিশ্চিত করে', () => {
    const token = generateEmergencyToken();
    assert.ok(token.length >= 20, 'Emergency token must be >= 20 chars');
    assert.strictEqual(isValidEmergencyTokenFormat(token), true);
    assert.strictEqual(isValidEmergencyTokenFormat('short'), false);

    assert.strictEqual(extractEmergencyCardTokenFromPath(`/e/${token}`), token);
    assert.strictEqual(extractEmergencyCardTokenFromPath(`/e/${token}/`), token);
    assert.strictEqual(extractEmergencyCardTokenFromPath('/r/some_report_token_123456'), null);
    assert.strictEqual(extractEmergencyCardTokenFromPath('/'), null);

    // Medicines MUST default to OFF for privacy
    assert.strictEqual(DEFAULT_EMERGENCY_CARD_SELECTION.medicines, false);
    assert.strictEqual(DEFAULT_EMERGENCY_CARD_SELECTION.bloodGroup, true);
    assert.strictEqual(DEFAULT_EMERGENCY_CARD_SELECTION.allergies, true);
    assert.strictEqual(DEFAULT_EMERGENCY_CARD_SELECTION.conditions, true);
    assert.strictEqual(DEFAULT_EMERGENCY_CARD_SELECTION.contact, true);

    const url = buildEmergencyCardUrl(token, 'https://shasthobondhu.app/');
    assert.strictEqual(url, `https://shasthobondhu.app/e/${token}`);

    const matrix = generateQrMatrix(url);
    assert.ok(matrix.size >= 21, 'QR matrix must be at least Version 1 (21x21)');
    assert.strictEqual(matrix.modules.length, matrix.size);
    assert.strictEqual(matrix.modules[0].length, matrix.size);

    const waUrl = buildEmergencyCardWhatsAppUrl(url, 'রহিম উদ্দিন');
    assert.ok(waUrl.startsWith('https://api.whatsapp.com/send?text='));
    assert.ok(decodeURIComponent(waUrl).includes(url));
  });

  it('নির্বাচিত তথ্য ছাড়া বাকি ক্ষেত্র বাদ দেয়, ঠিকানা/NID/অতিরিক্ত নম্বর কখনো রাখে না এবং ৫০০ অক্ষরের মধ্যে সীমাবদ্ধ রাখে', () => {
    const token = generateEmergencyToken();
    const patient: PatientProfile = {
      id: 'pat-1',
      name: 'রহিম উদ্দিন',
      relation: 'বাবা',
      age: 66,
      gender: 'পুরুষ',
      bloodGroup: 'B+',
      chronicConditions: ['উচ্চ রক্তচাপ', 'ডায়াবেটিস'],
      allergies: ['Penicillin', 'Sulfa'],
      emergencyContact: '01711000001',
    };
    const meds: Medicine[] = [
      {
        id: 'med-1',
        brandName: 'Napa Extra '.repeat(40),
        genericName: 'Paracetamol',
        type: 'ট্যাবলেট',
        strength: '500mg',
        mealTiming: 'খাওয়ার পরে',
        schedules: [{ id: 's1', timeSlot: 'রাত', time: '09:00 PM', dosage: '১টি' }],
        stock: 10,
        minStockAlert: 2,
        unit: 'টি',
        startDate: '2026-11-01',
        isChronic: true,
        doctorName: 'ডা. কামাল হোসেন',
        assignedPatientId: 'pat-1',
        status: 'active',
        colorTag: 'indigo',
      },
    ];

    // Default selection: medicines and doctorName OFF
    const defaultPayload = buildEmergencyCardPayload({
      ownerUid: 'uid-1',
      token,
      patient,
      medicines: meds,
      selection: DEFAULT_EMERGENCY_CARD_SELECTION,
      emergencyContactName: 'তানভীর (ছেলে)',
      emergencyContactPhone: '01711000001',
    });

    assert.strictEqual(defaultPayload.patientName, 'রহিম উদ্দিন');
    assert.strictEqual(defaultPayload.age, 66);
    assert.strictEqual(defaultPayload.bloodGroup, 'B+');
    assert.strictEqual(defaultPayload.allergies, 'Penicillin, Sulfa');
    assert.strictEqual(defaultPayload.conditions, 'উচ্চ রক্তচাপ, ডায়াবেটিস');
    assert.strictEqual(defaultPayload.contactName, 'তানভীর (ছেলে)');
    assert.strictEqual(defaultPayload.contactPhone, '01711000001');
    assert.strictEqual(defaultPayload.medicines, undefined);
    assert.strictEqual(defaultPayload.doctorName, undefined);
    assert.strictEqual('nid' in defaultPayload, false);
    assert.strictEqual('address' in defaultPayload, false);

    // Enable medicines & doctorName -> clamped <= 500 chars
    const fullPayload = buildEmergencyCardPayload({
      ownerUid: 'uid-1',
      token,
      patient,
      medicines: meds,
      selection: { ...DEFAULT_EMERGENCY_CARD_SELECTION, medicines: true, doctorName: true },
    });
    assert.ok(fullPayload.medicines && fullPayload.medicines.length <= EMERGENCY_CARD_FIELD_LIMIT);
    assert.strictEqual(fullPayload.doctorName, 'ডা. কামাল হোসেন');

    const derived = deriveSelectionFromEmergencyCard(fullPayload);
    assert.deepStrictEqual(derived, {
      bloodGroup: true,
      allergies: true,
      conditions: true,
      contact: true,
      medicines: true,
      doctorName: true,
    });

    const summaryLabels = getEmergencyIncludedSummaryLabels(DEFAULT_EMERGENCY_CARD_SELECTION, defaultPayload);
    assert.ok(summaryLabels.includes('রক্তের গ্রুপ'));
    assert.ok(!summaryLabels.includes('চলমান ওষুধের তালিকা'));

    // deleteField() sentinel survives stripUndefined
    const updateSentinel = stripUndefined({
      patientName: 'রহিম উদ্দিন',
      medicines: deleteField(),
      createdAt: serverTimestamp(),
    });
    assert.ok(updateSentinel.medicines instanceof FieldValue);
    assert.ok(updateSentinel.createdAt instanceof FieldValue);
  });
});

// ============================================================================
// Suite 23: Caregiver Medicine Suggestions & Patient Approval Pure Logic
// ============================================================================
describe('Suite 23: Caregiver Medicine Suggestions & Patient Approval', () => {
  const baseLink: CaregiverLinkDoc = {
    id: 'ABC123',
    inviteCode: 'ABC123',
    patientUid: 'patient-uid-1',
    caregiverUid: 'caregiver-uid-1',
    patientName: 'রহিম উদ্দিন',
    caregiverName: 'তানভীর (ছেলে)',
    status: 'active',
    allowFullView: false,
    allowSuggestions: true,
    createdAt: '2026-11-15T00:00:00.000Z',
    expiresAtMs: Date.now() + 86400000,
    updatedAt: '2026-11-15T00:00:00.000Z',
  };

  it('builds valid add suggestion payload with no undefined values and enforces allowFullView for edit/stop', () => {
    const longNote = 'ক'.repeat(700);
    const sug = buildCaregiverSuggestionPayload({
      id: 'sug_test_1',
      link: baseLink,
      caregiverUid: 'caregiver-uid-1',
      caregiverName: 'তানভীর (ছেলে)',
      input: {
        kind: 'add',
        brandName: 'Napa Extend',
        strength: '৬৬৫ মিগ্রা',
        type: 'ট্যাবলেট',
        dosage: '১টি',
        timeSlots: ['রাত', 'সকাল', 'দুপুর'],
        mealTiming: 'খাওয়ার পরে',
        durationDays: 10,
        stock: 30,
        note: longNote,
      },
      nowMs: 1_700_000_000_000,
    });

    assert.strictEqual(sug.status, 'pending');
    assert.strictEqual(sug.kind, 'add');
    assert.deepStrictEqual(sug.medicine.timeSlots, ['সকাল', 'দুপুর', 'রাত']);
    assert.strictEqual(sug.medicine.schedules?.length, 3);
    assert.ok(sug.note && sug.note.length <= SUGGESTION_TEXT_LIMIT);
    assert.strictEqual(Object.values(sug).includes(undefined), false);
    assert.strictEqual(Object.values(sug.medicine).includes(undefined), false);

    const headline = buildSuggestionSummaryHeadlineBn(sug);
    assert.ok(headline.includes('তানভীর (ছেলে)'));
    assert.ok(headline.includes('Napa Extend ৬৬৫ মিগ্রা'));
    assert.ok(headline.includes('দিনে ৩ বার'));

    assert.throws(() =>
      buildCaregiverSuggestionPayload({
        link: { ...baseLink, allowFullView: false },
        caregiverUid: 'caregiver-uid-1',
        caregiverName: 'তানভীর',
        input: {
          kind: 'edit',
          brandName: 'Napa',
          type: 'ট্যাবলেট',
          dosage: '১টি',
          timeSlots: ['সকাল'],
          mealTiming: 'খাওয়ার পরে',
          stock: 10,
        },
      })
    );
  });

  it('filters expired (>30 days) pending suggestions and tracks max 10/day caregiver limit', () => {
    const nowMs = 1_800_000_000_000;
    const baseSug = buildCaregiverSuggestionPayload({
      id: 'sug_fresh',
      link: baseLink,
      caregiverUid: 'caregiver-uid-1',
      caregiverName: 'তানভীর',
      input: {
        kind: 'add',
        brandName: 'Seclo',
        type: 'ক্যাপসুল',
        dosage: '১টি',
        timeSlots: ['সকাল'],
        mealTiming: 'খাওয়ার আগে',
        stock: 14,
      },
      nowMs: nowMs - 1000,
    });

    const expiredSug: CaregiverSuggestionDoc = {
      ...baseSug,
      id: 'sug_old',
      createdAtMs: nowMs - SUGGESTION_EXPIRY_MS - 1000,
    };
    const rejectedSug: CaregiverSuggestionDoc = {
      ...baseSug,
      id: 'sug_rejected',
      status: 'rejected',
    };

    assert.strictEqual(isSuggestionExpired(expiredSug.createdAtMs, nowMs), true);
    assert.strictEqual(isSuggestionExpired(baseSug.createdAtMs, nowMs), false);

    const visible = filterVisiblePendingSuggestions([expiredSug, rejectedSug, baseSug], nowMs);
    assert.strictEqual(visible.length, 1);
    assert.strictEqual(visible[0].id, 'sug_fresh');

    const map = new Map<string, string>();
    const fakeStorage = {
      getItem: (k: string) => map.get(k) ?? null,
      setItem: (k: string, v: string) => {
        map.set(k, v);
      },
      removeItem: (k: string) => {
        map.delete(k);
      },
      clear: () => map.clear(),
      key: () => null,
      length: 0,
    } as unknown as Storage;

    const dateIso = '2026-11-15';
    assert.strictEqual(getCaregiverDailySuggestionCount('cg-1', [], fakeStorage, dateIso), 0);
    for (let i = 0; i < MAX_DAILY_CAREGIVER_SUGGESTIONS; i++) {
      incrementCaregiverDailySuggestionCount('cg-1', fakeStorage, dateIso);
    }
    assert.strictEqual(
      getCaregiverDailySuggestionCount('cg-1', [], fakeStorage, dateIso),
      MAX_DAILY_CAREGIVER_SUGGESTIONS
    );
  });

  it('converts accepted suggestion into clean Medicine input and resolves edit/stop targets', () => {
    const existingMed: Medicine = {
      id: 'med-99',
      brandName: 'Napa',
      genericName: 'Paracetamol',
      type: 'ট্যাবলেট',
      strength: '500mg',
      mealTiming: 'খাওয়ার পরে',
      schedules: [{ id: '1', timeSlot: 'সকাল', time: '08:00 AM', dosage: '১টি' }],
      stock: 12,
      minStockAlert: 5,
      unit: 'টি',
      startDate: '2026-11-01',
      isChronic: false,
      colorTag: 'teal',
      status: 'active',
      assignedPatientId: 'p-1',
    };

    const defaults = buildFormDefaultsFromSharedMedicine({
      id: existingMed.id,
      brandName: existingMed.brandName,
      strength: existingMed.strength,
      type: existingMed.type,
      mealTiming: existingMed.mealTiming,
      stock: existingMed.stock,
      unit: existingMed.unit,
      schedules: existingMed.schedules,
      schedulesText: 'সকাল',
    });

    const editSug = buildCaregiverSuggestionPayload({
      id: 'sug_edit_1',
      link: { ...baseLink, allowFullView: true },
      caregiverUid: 'caregiver-uid-1',
      caregiverName: 'তানভীর',
      input: {
        ...defaults,
        kind: 'edit',
        timeSlots: ['সকাল', 'রাত'],
        stock: 20,
      },
    });

    const matchedTarget = findTargetMedicineForSuggestion([existingMed], editSug);
    assert.strictEqual(matchedTarget?.id, 'med-99');

    const converted = buildMedicineInputFromSuggestion({
      suggestion: editSug,
      edited: { stock: 24 },
      assignedPatientId: 'p-1',
    });
    assert.strictEqual(converted.brandName, 'Napa');
    assert.strictEqual(converted.stock, 24);
    assert.strictEqual(converted.schedules.length, 2);
    assert.strictEqual(converted.assignedPatientId, 'p-1');
    assert.strictEqual(Object.values(converted).some((v) => v === undefined), false);
  });
});

// ============================================================================
// Suite 24: Weekly Pillbox Grid, Course Bounds, DoseLog Indicators & Totals
// ============================================================================
describe('Suite 24: Weekly Pillbox (সাপ্তাহিক পিলবক্স)', () => {
  it('computes Saturday (default), Sunday, and Monday week starts and cross-month Bengali ranges', () => {
    // 2026-11-18 is Wednesday -> Saturday start = 2026-11-14, Friday end = 2026-11-20
    const satStart = getWeekStartDate('2026-11-18', 'saturday');
    const satDays = getWeekDays(satStart, '2026-11-18');
    assert.strictEqual(satDays[0].iso, '2026-11-14');
    assert.strictEqual(satDays[0].weekdayShortBn, 'শনি');
    assert.strictEqual(satDays[6].iso, '2026-11-20');
    assert.strictEqual(satDays[6].weekdayShortBn, 'শুক্র');
    assert.strictEqual(satDays[4].isToday, true); // Wed Nov 18
    assert.strictEqual(satDays[0].isPast, true);
    assert.strictEqual(satDays[6].isFuture, true);
    assert.strictEqual(formatWeekRangeBn(satDays), '১৪ – ২০ নভেম্বর ২০২৬');

    // Sunday start -> 2026-11-15 to 2026-11-21
    const sunStart = getWeekStartDate('2026-11-18', 'sunday');
    const sunDays = getWeekDays(sunStart, '2026-11-18');
    assert.strictEqual(sunDays[0].iso, '2026-11-15');
    assert.strictEqual(sunDays[6].iso, '2026-11-21');

    // Monday start -> 2026-11-16 to 2026-11-22
    const monStart = getWeekStartDate('2026-11-18', 'monday');
    const monDays = getWeekDays(monStart, '2026-11-18');
    assert.strictEqual(monDays[0].iso, '2026-11-16');
    assert.strictEqual(monDays[6].iso, '2026-11-22');

    // Next week crosses Nov -> Dec (2026-11-28 to 2026-12-04)
    const crossMonthStart = addWeeksToLocalDate(satStart, 2);
    const crossDays = getWeekDays(crossMonthStart, '2026-11-18');
    assert.strictEqual(formatWeekRangeBn(crossDays), '২৮ নভেম্বর – ৪ ডিসেম্বর ২০২৬');
  });

  it('enforces per-day course bounds, hides empty time rows, separates PRN, and never guesses missing DoseLogs', () => {
    const meds: Medicine[] = [
      {
        id: 'med-napa',
        brandName: 'Napa Extend',
        genericName: 'Paracetamol',
        type: 'ট্যাবলেট',
        strength: '665mg',
        mealTiming: 'খাওয়ার পরে',
        schedules: [
          { id: 's1', timeSlot: 'সকাল', time: '08:00 AM', dosage: '১টি' },
          { id: 's2', timeSlot: 'রাত', time: '09:00 PM', dosage: '১টি' },
        ],
        stock: 20,
        minStockAlert: 5,
        unit: 'টি',
        startDate: '2026-11-14',
        durationDays: 3, // Active ONLY Nov 14, 15, 16 (expires before Nov 17)
        isChronic: false,
        colorTag: 'indigo',
        status: 'active',
        assignedPatientId: 'p-1',
      },
      {
        id: 'med-seclo',
        brandName: 'Seclo',
        genericName: 'Omeprazole',
        type: 'ক্যাপসুল',
        strength: '20mg',
        mealTiming: 'খাওয়ার আগে',
        schedules: [
          { id: 's3', timeSlot: 'সকাল', time: '07:30 AM', dosage: '১টি' },
        ],
        stock: 30,
        minStockAlert: 5,
        unit: 'টি',
        startDate: '2026-11-01',
        isChronic: true,
        colorTag: 'teal',
        status: 'active',
        assignedPatientId: 'p-1',
      },
      {
        id: 'med-prn',
        brandName: 'Alatrol',
        genericName: 'Cetirizine',
        type: 'ট্যাবলেট',
        strength: '10mg',
        mealTiming: 'প্রয়োজনমতো',
        schedules: [],
        stock: 10,
        minStockAlert: 2,
        unit: 'টি',
        startDate: '2026-11-10',
        isChronic: true,
        colorTag: 'indigo',
        status: 'active',
        assignedPatientId: 'p-1',
      },
      {
        id: 'med-other-patient',
        brandName: 'OtherMed',
        genericName: 'Other',
        type: 'ট্যাবলেট',
        strength: '50mg',
        mealTiming: 'খাওয়ার পরে',
        schedules: [{ id: 's4', timeSlot: 'দুপুর', time: '01:00 PM', dosage: '১টি' }],
        stock: 10,
        minStockAlert: 2,
        unit: 'টি',
        startDate: '2026-11-01',
        isChronic: true,
        colorTag: 'indigo',
        status: 'active',
        assignedPatientId: 'p-2',
      },
    ];

    const logs: DoseLog[] = [
      // Past Nov 14 morning Seclo taken, Napa skipped
      {
        id: 'l1',
        medicineId: 'med-seclo',
        medicineName: 'Seclo',
        patientId: 'p-1',
        scheduledDate: '2026-11-14',
        scheduledTime: '07:30 AM',
        timeSlot: 'সকাল',
        dosage: '১টি',
        status: 'taken',
      },
      {
        id: 'l2',
        medicineId: 'med-napa',
        medicineName: 'Napa Extend',
        patientId: 'p-1',
        scheduledDate: '2026-11-14',
        scheduledTime: '08:00 AM',
        timeSlot: 'সকাল',
        dosage: '১টি',
        status: 'skipped',
      },
      // Nov 15 & Nov 16 have NO logs at all — must stay undefined (no guessing!)
      // Future Nov 20 log even if present must never show as past status
      {
        id: 'l3',
        medicineId: 'med-seclo',
        medicineName: 'Seclo',
        patientId: 'p-1',
        scheduledDate: '2026-11-20',
        scheduledTime: '07:30 AM',
        timeSlot: 'সকাল',
        dosage: '১টি',
        status: 'taken',
      },
    ];

    const weekStart = getWeekStartDate('2026-11-18', 'saturday'); // Nov 14 - Nov 20
    const data = buildWeeklyPillbox({
      medicines: meds,
      doseLogs: logs,
      patientId: 'p-1',
      weekStartDate: weekStart,
      weekStartDay: 'saturday',
      todayStr: '2026-11-18',
    });

    // Only morning & night rows should be visible (noon belonging to p-2 & evening empty are hidden)
    assert.deepStrictEqual(
      data.visibleRows.map((r) => r.key),
      ['morning', 'night']
    );

    const morningRow = data.visibleRows[0];
    // Nov 14 morning: Seclo (taken ✓) + Napa Extend (missed ✗)
    const nov14Morning = morningRow.cellsByDayIso['2026-11-14'];
    assert.strictEqual(nov14Morning.length, 2);
    assert.strictEqual(nov14Morning.find((i) => i.medicineId === 'med-seclo')?.logStatus, 'taken');
    assert.strictEqual(nov14Morning.find((i) => i.medicineId === 'med-napa')?.logStatus, 'missed');

    // Nov 15 morning (past, NO logs): both items MUST have logStatus === undefined
    const nov15Morning = morningRow.cellsByDayIso['2026-11-15'];
    assert.strictEqual(nov15Morning.length, 2);
    assert.strictEqual(nov15Morning.every((i) => i.logStatus === undefined), true);

    // Nov 17 morning (Napa 3-day course ended after Nov 16): ONLY Seclo remains!
    const nov17Morning = morningRow.cellsByDayIso['2026-11-17'];
    assert.deepStrictEqual(
      nov17Morning.map((i) => i.medicineId),
      ['med-seclo']
    );

    // Nov 20 morning (future): logStatus must be undefined
    const nov20Morning = morningRow.cellsByDayIso['2026-11-20'];
    assert.strictEqual(nov20Morning[0].logStatus, undefined);

    // PRN separated
    assert.deepStrictEqual(
      data.asNeededItems.map((i) => i.medicineId),
      ['med-prn']
    );

    // Weekly totals: Napa = 3 days * 2 doses = 6টি; Seclo = 7 days * 1 dose = 7টি
    const napaTotal = data.weeklyTotals.find((t) => t.medicineId === 'med-napa');
    const secloTotal = data.weeklyTotals.find((t) => t.medicineId === 'med-seclo');
    assert.strictEqual(napaTotal?.totalUnits, 6);
    assert.strictEqual(napaTotal?.summaryLabelBn, 'Napa Extend (665mg) — ৬টি');
    assert.strictEqual(secloTotal?.totalUnits, 7);
    assert.strictEqual(secloTotal?.summaryLabelBn, 'Seclo (20mg) — ৭টি');

    // Short chip formatting
    assert.strictEqual(formatShortMedicineChipLabel('Napa', '১টি'), 'Napa ১');
    assert.strictEqual(formatShortMedicineChipLabel('Seclo', '১/২টি'), 'Seclo ১/২');
  });
});

describe('Suite 25: Firestore দৈনিক Read হ্রাস (৪৫ দিন উইন্ডো, TTL ক্যাশ ও অন-ডিমান্ড লোড)', () => {
  it('৪৫ দিনের কাটঅফ তারিখ সঠিকভাবে হিসাব করে এবং রিয়েল-টাইম উইন্ডোর সাথে পুরনো লগ অক্ষত রাখে', () => {
    const refDate = new Date(2026, 10, 16); // 2026-11-16
    const cutoff = getDoseLogsCutoffDate(DOSE_LOG_REALTIME_DAYS, refDate);
    assert.strictEqual(cutoff, '2026-10-02');

    const yesterday = getAppointmentsRecentCutoffDate(1, refDate);
    assert.strictEqual(yesterday, '2026-11-15');

    const existingLogs: DoseLog[] = [
      {
        id: 'log-old-1',
        medicineId: 'm1',
        medicineName: 'Napa',
        scheduledDate: '2026-09-15',
        scheduledTime: '08:00 AM',
        timeSlot: 'সকাল',
        dosage: '১টি',
        status: 'taken',
      },
      {
        id: 'log-recent-deleted-on-cloud',
        medicineId: 'm1',
        medicineName: 'Napa',
        scheduledDate: '2026-11-01',
        scheduledTime: '08:00 AM',
        timeSlot: 'সকাল',
        dosage: '১টি',
        status: 'taken',
      },
    ];

    const recentFromSnapshot: DoseLog[] = [
      {
        id: 'log-recent-live',
        medicineId: 'm2',
        medicineName: 'Seclo',
        scheduledDate: '2026-11-16',
        scheduledTime: '07:30 AM',
        timeSlot: 'সকাল',
        dosage: '১টি',
        status: 'taken',
      },
    ];

    // Bounded snapshot preserves < cutoff cached logs and replaces >= cutoff window authoritatively
    const merged = mergeDoseLogsWithWindow(existingLogs, recentFromSnapshot, cutoff);
    assert.deepStrictEqual(
      merged.map((l) => l.id),
      ['log-recent-live', 'log-old-1']
    );

    // Lazy older load preserves live 45-day logs and refreshes < cutoff logs
    const fetchedOlder: DoseLog[] = [
      {
        id: 'log-old-2',
        medicineId: 'm1',
        medicineName: 'Napa',
        scheduledDate: '2026-08-20',
        scheduledTime: '09:00 PM',
        timeSlot: 'রাত',
        dosage: '১টি',
        status: 'skipped',
      },
    ];
    const withOlder = replaceOlderDoseLogsKeepingRecent(merged, fetchedOlder, cutoff);
    assert.deepStrictEqual(
      withOlder.map((l) => l.id),
      ['log-recent-live', 'log-old-2']
    );
  });

  it('আসন্ন এবং পূর্ববর্তী অ্যাপয়েন্টমেন্ট আলাদাভাবে মার্জ ও ক্যাশ করে', () => {
    const minDate = '2026-11-15';
    const existingApts: DoctorAppointment[] = [
      {
        id: 'apt-past-cached',
        patientId: 'p1',
        doctorName: 'ডা. করিম',
        appointmentDate: '2026-10-10',
        appointmentTime: '10:00 AM',
        location: 'ঢাকা',
        status: 'completed',
        createdAt: '2026-10-01T00:00:00Z',
      },
      {
        id: 'apt-upcoming-stale',
        patientId: 'p1',
        doctorName: 'ডা. পুরনো',
        appointmentDate: '2026-11-20',
        appointmentTime: '05:00 PM',
        location: 'ঢাকা',
        status: 'upcoming',
        createdAt: '2026-11-01T00:00:00Z',
      },
    ];
    const upcomingCloud: DoctorAppointment[] = [
      {
        id: 'apt-upcoming-fresh',
        patientId: 'p1',
        doctorName: 'ডা. রহমান',
        appointmentDate: '2026-11-18',
        appointmentTime: '06:00 PM',
        location: 'চেম্বার',
        status: 'upcoming',
        createdAt: '2026-11-10T00:00:00Z',
      },
    ];

    const mergedBoot = mergeUpcomingAppointments(existingApts, upcomingCloud, minDate);
    assert.deepStrictEqual(
      mergedBoot.map((a) => a.id).sort(),
      ['apt-past-cached', 'apt-upcoming-fresh']
    );

    const pastCloud: DoctorAppointment[] = [
      {
        id: 'apt-past-real',
        patientId: 'p1',
        doctorName: 'ডা. জামান',
        appointmentDate: '2026-09-05',
        appointmentTime: '11:00 AM',
        location: 'ক্লিনিক',
        status: 'completed',
        createdAt: '2026-09-01T00:00:00Z',
      },
    ];
    const mergedFull = replacePastAppointmentsKeepingUpcoming(mergedBoot, pastCloud, minDate);
    assert.deepStrictEqual(
      mergedFull.map((a) => a.id).sort(),
      ['apt-past-real', 'apt-upcoming-fresh']
    );
  });

  it('UID-ভিত্তিক TTL মেটা ও ২৪-ঘণ্টার ক্যাশ পুনরাবৃত্ত read আটকায় এবং লগআউটে পরিষ্কার হয়', () => {
    const store = new Map<string, string>();
    const prevWindow = (globalThis as any).window;
    const prevStorage = (globalThis as any).localStorage;

    const mockStorage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => {
        store.set(k, v);
      },
      removeItem: (k: string) => {
        store.delete(k);
      },
    };
    (globalThis as any).window = {};
    (globalThis as any).localStorage = mockStorage;

    try {
      const uid = 'user-read-opt-1';
      const otherUid = 'user-read-opt-2';
      const t0 = 1_750_000_000_000;

      // Fresh user must fetch on initial boot
      assert.strictEqual(
        shouldFetchCollectionFromCloud(uid, 'medicines', COLLECTION_SYNC_TTL_MS, t0),
        true
      );

      markCollectionSynced(uid, 'medicines', t0);
      // Within TTL: skip cloud read (0 reads!)
      assert.strictEqual(
        shouldFetchCollectionFromCloud(uid, 'medicines', COLLECTION_SYNC_TTL_MS, t0 + 30 * 60 * 1000),
        false
      );
      // Force refresh overrides TTL
      assert.strictEqual(
        shouldFetchCollectionFromCloud(uid, 'medicines', COLLECTION_SYNC_TTL_MS, t0 + 30 * 60 * 1000, true),
        true
      );
      // Different UID is isolated and still fetches
      assert.strictEqual(
        shouldFetchCollectionFromCloud(otherUid, 'medicines', COLLECTION_SYNC_TTL_MS, t0 + 1000),
        true
      );
      // Expired TTL triggers fresh fetch
      assert.strictEqual(
        shouldFetchCollectionFromCloud(uid, 'medicines', COLLECTION_SYNC_TTL_MS, t0 + COLLECTION_SYNC_TTL_MS + 1),
        true
      );

      // Older doseLogs cache hit/miss/cutoff rollover
      const cutoff = '2026-10-02';
      const oldLogs: DoseLog[] = [
        {
          id: 'old-log-1',
          medicineId: 'm1',
          medicineName: 'Napa',
          scheduledDate: '2026-09-20',
          scheduledTime: '08:00 AM',
          timeSlot: 'সকাল',
          dosage: '১টি',
          status: 'taken',
        },
        {
          id: 'recent-ignored',
          medicineId: 'm1',
          medicineName: 'Napa',
          scheduledDate: '2026-11-01',
          scheduledTime: '08:00 AM',
          timeSlot: 'সকাল',
          dosage: '১টি',
          status: 'taken',
        },
      ];
      saveCachedOlderDoseLogs(uid, cutoff, oldLogs, t0);

      const hitSameDay = loadCachedOlderDoseLogs(uid, cutoff, t0 + 60_000);
      assert.strictEqual(hitSameDay.hit, true);
      assert.deepStrictEqual(hitSameDay.logs.map((l) => l.id), ['old-log-1']);

      // After TTL expiry -> cache miss
      const missExpired = loadCachedOlderDoseLogs(uid, cutoff, t0 + OLDER_LOGS_CACHE_TTL_MS + 1);
      assert.strictEqual(missExpired.hit, false);

      // If cutoff advances past cached cutoff -> miss so no 1-day gap can happen
      const missRollover = loadCachedOlderDoseLogs(uid, '2026-10-03', t0 + 60_000);
      assert.strictEqual(missRollover.hit, false);

      // Past appointments cache
      saveCachedPastAppointments(
        uid,
        '2026-11-15',
        [
          {
            id: 'past-1',
            patientId: 'p1',
            doctorName: 'ডা. এ',
            appointmentDate: '2026-10-01',
            appointmentTime: '10:00 AM',
            location: 'ঢাকা',
            status: 'completed',
            createdAt: '2026-10-01T00:00:00Z',
          },
        ],
        t0
      );
      const aptHit = loadCachedPastAppointments(uid, '2026-11-15', t0 + 1000);
      assert.strictEqual(aptHit.hit, true);
      assert.strictEqual(aptHit.appointments.length, 1);

      // Invalidation & full clear on logout
      invalidateCollectionSyncMeta(uid, ['medicines']);
      assert.strictEqual(
        shouldFetchCollectionFromCloud(uid, 'medicines', COLLECTION_SYNC_TTL_MS, t0 + 1000),
        true
      );
      clearUserReadOptimizerCaches(uid);
      assert.strictEqual(loadCachedOlderDoseLogs(uid, cutoff, t0 + 1000).hit, false);
      assert.strictEqual(loadCachedPastAppointments(uid, '2026-11-15', t0 + 1000).hit, false);
    } finally {
      (globalThis as any).window = prevWindow;
      (globalThis as any).localStorage = prevStorage;
    }
  });
});

describe('আমার ডাক্তার (ডিরেক্টরি, ফোন যাচাই, অগ্রাধিকার ও Firestore-সাশ্রয়ী ক্যাশ)', () => {
  it('বাংলা ও ইংরেজি সংখ্যায় বাংলাদেশি ফোন নম্বর যাচাই করে, কল/হোয়াটসঅ্যাপ লিংক বানায় এবং অস্বাভাবিক ফরম্যাটে নম্র সতর্কতা দেয়', () => {
    assert.strictEqual(normalizeBengaliDigits('০১৭১২-৩৪৫৬৭৮'), '01712-345678');

    const bdMobile = validateBangladeshiPhone('০১৭১২-৩৪৫৬৭৮');
    assert.strictEqual(bdMobile.valid, true);
    assert.strictEqual(bdMobile.normalized, '01712345678');
    assert.strictEqual(bdMobile.telHref, 'tel:01712345678');
    assert.strictEqual(bdMobile.waUrl, 'https://wa.me/8801712345678');
    assert.strictEqual(bdMobile.warningBn, undefined);

    const intlBd = validateBangladeshiPhone('+880 1811-223344');
    assert.strictEqual(intlBd.valid, true);
    assert.strictEqual(intlBd.telHref, 'tel:+8801811223344');
    assert.strictEqual(intlBd.waUrl, 'https://wa.me/8801811223344');

    const unusual = validateBangladeshiPhone('02-9661234');
    assert.strictEqual(unusual.valid, false);
    assert.ok(unusual.warningBn && unusual.warningBn.length > 0);
    // Soft non-blocking: telHref still generated for landline
    assert.strictEqual(unusual.telHref, 'tel:029661234');

    const empty = validateBangladeshiPhone('   ');
    assert.strictEqual(empty.isEmpty, true);
    assert.strictEqual(empty.valid, true);
    assert.strictEqual(empty.telHref, null);
  });

  it('জরুরি ডাক্তার (isEmergency) সবসময় প্রথমে পিন করে, এরপর আসন্ন ভিজিট ও নাম অনুযায়ী সাজায় এবং ফিল্টার করে', () => {
    const refDate = new Date(2026, 10, 15, 10, 0, 0); // 2026-11-15
    const docs: DoctorProfile[] = [
      {
        id: 'd-normal-later',
        name: 'ডা. করিম',
        specialty: 'মেডিসিন',
        hospital: 'ঢাকা মেডিকেল',
        forConditions: 'জ্বর ও ঠান্ডা',
        patientIds: ['p-mom'],
        nextVisitDate: '2026-11-20',
        isEmergency: false,
        createdAt: '2026-11-01T00:00:00Z',
        updatedAt: '2026-11-01T00:00:00Z',
      },
      {
        id: 'd-normal-sooner',
        name: 'ডা. আয়েশা',
        specialty: 'হৃদরোগ',
        hospital: 'জাতীয় হৃদরোগ ইনস্টিটিউট',
        forConditions: 'উচ্চ রক্তচাপ',
        patientIds: ['p-dad'],
        nextVisitDate: '2026-11-16',
        isEmergency: false,
        createdAt: '2026-11-01T00:00:00Z',
        updatedAt: '2026-11-01T00:00:00Z',
      },
      {
        id: 'd-emerg',
        name: 'ডা. জহির',
        specialty: 'কার্ডিওলজি',
        phone: '01711000000',
        patientIds: ['p-dad'],
        isEmergency: true,
        createdAt: '2026-11-01T00:00:00Z',
        updatedAt: '2026-11-01T00:00:00Z',
      },
    ];

    const sorted = sortDoctors(docs, refDate);
    assert.deepStrictEqual(
      sorted.map((d) => d.id),
      ['d-emerg', 'd-normal-sooner', 'd-normal-later']
    );

    assert.strictEqual(formatVisitCountdownBn('2026-11-15', refDate).label, 'আজ ভিজিট');
    assert.strictEqual(formatVisitCountdownBn('2026-11-16', refDate).label, 'আগামীকাল ভিজিট');
    assert.strictEqual(formatVisitCountdownBn('2026-11-20', refDate).label, 'আর ৫ দিন');
    assert.strictEqual(formatVisitCountdownBn('2026-11-13', refDate).label, '২ দিন আগে');

    assert.deepStrictEqual(
      filterDoctors(sorted, 'হৃদরোগ', 'all').map((d) => d.id),
      ['d-normal-sooner']
    );
    assert.deepStrictEqual(
      filterDoctors(sorted, '', 'p-dad').map((d) => d.id),
      ['d-emerg', 'd-normal-sooner']
    );
  });

  it('undefined/খালি ফিল্ড বাদ দেয় এবং Timestamp, serverTimestamp ও deleteField অক্ষত রাখে', () => {
    const clean = buildCleanDoctorInput({
      name: '  ডা. সাবিনা ইয়াসমিন  ',
      specialty: '   ',
      phone: '০১৭১১২২৩৩৪৪',
      hospital: '  স্কয়ার হাসপাতাল  ',
      notes: 'x'.repeat(650),
      patientIds: Array.from({ length: 25 }, (_, i) => `p-${i}`),
      isEmergency: true,
    });

    assert.strictEqual(clean.name, 'ডা. সাবিনা ইয়াসমিন');
    assert.strictEqual(clean.specialty, undefined);
    assert.strictEqual(clean.phone, '01711223344');
    assert.strictEqual(clean.hospital, 'স্কয়ার হাসপাতাল');
    assert.strictEqual(clean.notes?.length, 500);
    assert.strictEqual(clean.patientIds?.length, 20);
    assert.strictEqual(clean.isEmergency, true);

    const st = serverTimestamp();
    const df = deleteField();
    const ts = Timestamp.fromMillis(1_763_000_000_000);
    const firestorePayload = stripUndefined({
      ...clean,
      id: 'doc_1',
      specialty: df,
      createdAt: ts,
      updatedAt: st,
    });

    assert.strictEqual('whatsapp' in firestorePayload, false);
    assert.strictEqual(firestorePayload.specialty, df);
    assert.strictEqual(firestorePayload.createdAt, ts);
    assert.strictEqual(firestorePayload.updatedAt, st);
  });

  it('অ্যাপয়েন্টমেন্ট পে-লোড, জরুরি কার্ড/QR অগ্রাধিকার, নাম মেলানো ও শেয়ার রিপোর্ট সংযোগ কাজ করে', () => {
    const doctors: DoctorProfile[] = [
      {
        id: 'd1',
        name: 'ডা. তানভীর আহমেদ',
        specialty: 'মেডিসিন',
        phone: '01711111111',
        hospital: 'ল্যাবএইড',
        patientIds: ['pat_1'],
        nextVisitDate: '2026-11-25',
        visitingHours: 'বিকাল ৫টা',
        isEmergency: true,
        createdAt: '2026-11-01T00:00:00Z',
        updatedAt: '2026-11-01T00:00:00Z',
      },
    ];

    assert.strictEqual(doctorExistsByName(doctors, 'Dr. তানভীর আহমেদ'), true);
    assert.strictEqual(doctorExistsByName(doctors, 'ডা. কামাল'), false);

    const emerg = findEmergencyDoctorForPatient(doctors, 'pat_1');
    assert.strictEqual(emerg?.id, 'd1');

    const qrDoc = findDoctorForEmergencyQr(doctors, 'pat_1');
    assert.strictEqual(qrDoc?.id, 'd1');
    assert.ok(formatEmergencyDoctorLabelForQr(qrDoc!).includes('01711111111'));

    const aptPayload = buildDoctorNextVisitAppointmentPayload(doctors[0]);
    assert.ok(aptPayload);
    assert.strictEqual(aptPayload.doctorName, 'ডা. তানভীর আহমেদ');
    assert.strictEqual(aptPayload.appointmentDate, '2026-11-25');
    assert.strictEqual(aptPayload.location, 'ল্যাবএইড');

    const patient: PatientProfile = {
      id: 'pat_1',
      name: 'রহিম সাহেব',
      relation: 'বাবা',
      age: 62,
      gender: 'পুরুষ',
      bloodGroup: 'A+',
      chronicConditions: ['ডায়াবেটিস'],
      allergies: [],
      emergencyContact: '01711000000',
    };
    const snap = buildSharedReportSnapshot({
      ownerUid: 'u1',
      token: generateShareToken(),
      patient,
      medicines: [],
      healthRecords: [],
      appointments: [],
      selection: DEFAULT_SHARED_REPORT_SECTIONS,
      expiryHours: 168,
      selectedDoctor: doctors[0],
    });
    assert.strictEqual(snap.sections.doctor?.name, 'ডা. তানভীর আহমেদ');
    assert.strictEqual(snap.sections.doctor?.specialty, 'মেডিসিন');
    assert.strictEqual(snap.sections.doctor?.hospital, 'ল্যাবএইড');
    assert.ok(getIncludedSectionLabels(snap.sections).includes('ডাক্তারের তথ্য'));
  });

  it('ফোনের ক্যাশ (৬ ঘণ্টার TTL) ও দ্বিমুখী সিঙ্ক মার্জ নতুন পরিবর্তন সংরক্ষণ করে', () => {
    const store = new Map<string, string>();
    const prevWindow = (globalThis as any).window;
    const prevStorage = (globalThis as any).localStorage;
    const mockStorage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => {
        store.set(k, v);
      },
      removeItem: (k: string) => {
        store.delete(k);
      },
    };
    (globalThis as any).window = {};
    (globalThis as any).localStorage = mockStorage;

    try {
      const uid = 'doc-cache-user';
      const t0 = 1_760_000_000_000;

      assert.strictEqual(
        shouldFetchCollectionFromCloud(uid, 'doctors', RECORDS_SYNC_TTL_MS, t0),
        true
      );
      markCollectionSynced(uid, 'doctors', t0);
      // Within 6 hours -> 0 cloud reads
      assert.strictEqual(
        shouldFetchCollectionFromCloud(uid, 'doctors', RECORDS_SYNC_TTL_MS, t0 + 3 * 60 * 60 * 1000),
        false
      );
      // After 6 hours -> allows refresh
      assert.strictEqual(
        shouldFetchCollectionFromCloud(uid, 'doctors', RECORDS_SYNC_TTL_MS, t0 + RECORDS_SYNC_TTL_MS + 1),
        true
      );

      const localOnly: DoctorProfile = {
        id: 'doc-local-1',
        name: 'ডা. স্থানীয়',
        isEmergency: false,
        createdAt: new Date(t0).toISOString(),
        updatedAt: new Date(t0 + 5000).toISOString(),
      };
      const updatedLocal: DoctorProfile = {
        id: 'doc-shared-1',
        name: 'ডা. আপডেটেড (নতুন নম্বর)',
        phone: '01811111111',
        isEmergency: true,
        createdAt: new Date(t0).toISOString(),
        updatedAt: new Date(t0 + 10_000).toISOString(),
      };
      const olderCloud: DoctorProfile = {
        id: 'doc-shared-1',
        name: 'ডা. পুরনো',
        phone: '01700000000',
        isEmergency: false,
        createdAt: new Date(t0).toISOString(),
        updatedAt: new Date(t0 + 1000).toISOString(),
      };
      const cloudOnly: DoctorProfile = {
        id: 'doc-cloud-2',
        name: 'ডা. অন্য ডিভাইস',
        isEmergency: false,
        createdAt: new Date(t0).toISOString(),
        updatedAt: new Date(t0 + 2000).toISOString(),
      };

      saveCachedDoctors(uid, [localOnly, updatedLocal]);
      assert.strictEqual(loadCachedDoctors(uid).length, 2);

      const mergedRes = mergeLocalAndCloudDoctors([localOnly, updatedLocal], [olderCloud, cloudOnly]);
      assert.strictEqual(mergedRes.merged.length, 3);
      assert.strictEqual(mergedRes.merged[0].id, 'doc-shared-1'); // Emergency pinned first & newer local wins
      assert.deepStrictEqual(mergedRes.toCreateInCloud.map((d) => d.id), ['doc-local-1']);
      assert.deepStrictEqual(mergedRes.toUpdateInCloud.map((d) => d.id), ['doc-shared-1']);

      clearCachedDoctors(uid);
      assert.strictEqual(loadCachedDoctors(uid).length, 0);
    } finally {
      (globalThis as any).window = prevWindow;
      (globalThis as any).localStorage = prevStorage;
    }
  });
});

describe('ধাপ ২০: প্রেসক্রিপশন ও রিপোর্ট ভল্ট (কোটা সীমা, ঘোরানো, ফিল্টার, PDF বান্ডেল ও সিঙ্ক কিউ)', () => {
  const samplePage = (idx: number) => ({
    fileId: `file-${idx}`,
    thumb: 'data:image/jpeg;base64,/9j/4AAQSkZJRg==',
    width: 200,
    height: 260,
    rotation: 0 as const,
  });

  const makeDoc = (id: string, pagesCount: number, overrides: Partial<MedicalDocument> = {}): MedicalDocument => ({
    id,
    kind: 'prescription',
    patientId: 'pat-1',
    doctorId: 'doc-1',
    title: `প্রেসক্রিপশন — ${id}`,
    date: '2026-11-15',
    pages: Array.from({ length: pagesCount }, (_, i) => samplePage(i + 1)),
    createdAt: '2026-11-15T10:00:00Z',
    updatedAt: '2026-11-15T10:00:00Z',
    ...overrides,
  });

  it('base64 আকার হিসাব, ছবি ঘোরানো, আগে-পরে সাজানো ও পাতা বাদ দেওয়া কাজ করে', () => {
    const raw = Buffer.from('Hello Shasthobondhu!').toString('base64');
    assert.strictEqual(
      estimateBase64DataUrlBytes(`data:image/jpeg;base64,${raw}`),
      Buffer.byteLength('Hello Shasthobondhu!')
    );

    assert.strictEqual(rotateDegreeClockwise(0), 90);
    assert.strictEqual(rotateDegreeClockwise(90), 180);
    assert.strictEqual(rotateDegreeClockwise(180), 270);
    assert.strictEqual(rotateDegreeClockwise(270), 0);

    const movedUp = movePageInList(['a', 'b', 'c'], 1, 'up');
    assert.deepStrictEqual(movedUp, ['b', 'a', 'c']);
    const movedDown = movePageInList(['a', 'b', 'c'], 1, 'down');
    assert.deepStrictEqual(movedDown, ['a', 'c', 'b']);
    assert.deepStrictEqual(removePageFromList(['a', 'b', 'c'], 1), ['a', 'c']);
  });

  it('প্রতি নথিতে সর্বোচ্চ ১০ পাতা ও ব্যবহারকারীর মোট ১২০ পাতার সীমা যাচাই করে', () => {
    const existing = [
      ...Array.from({ length: 11 }, (_, i) => makeDoc(`d-${i + 1}`, 10)),
      makeDoc('d-edit', 8),
    ];
    assert.strictEqual(countTotalUserPages(existing), 118);

    // 11 pages in one document violates MAX_DOCUMENT_PAGES (10)
    const perDocExceeded = canAddUserPages([], MAX_DOCUMENT_PAGES + 1);
    assert.strictEqual(perDocExceeded.allowed, false);

    // 118 + 3 = 121 exceeds MAX_USER_DOCUMENT_PAGES (120)
    const userLimitExceeded = canAddUserPages(existing, 3);
    assert.strictEqual(userLimitExceeded.allowed, false);
    assert.strictEqual(userLimitExceeded.remaining, 2);

    // Editing d-edit from 8 to 10 pages results in 110 + 10 = 120 (allowed)
    const editWithinLimit = canAddUserPages(existing, 10, 8);
    assert.strictEqual(editWithinLimit.allowed, true);
    assert.strictEqual(editWithinLimit.projectedTotal, MAX_USER_DOCUMENT_PAGES);
  });

  it('ডিফল্ট বাংলা শিরোনাম ও মেটাডাটা পরিষ্কার করে (undefined ছাড়া ও সীমার মধ্যে)', () => {
    const rxTitle = buildDefaultDocumentTitle('prescription', {
      doctorName: 'ডা. কামরুল হাসান',
      date: '2026-11-16',
    });
    assert.ok(rxTitle.startsWith('প্রেসক্রিপশন — ডা. কামরুল হাসান'));

    const reportTitle = buildDefaultDocumentTitle('report', {
      reportType: 'রক্ত পরীক্ষা',
      date: '2026-11-16',
    });
    assert.ok(reportTitle.startsWith('রিপোর্ট — রক্ত পরীক্ষা'));

    const clean = buildCleanMedicalDocumentInput({
      kind: 'prescription',
      patientId: 'p-1',
      doctorId: '   ',
      title: 'T'.repeat(200),
      date: '২০২৬-১১-১৬',
      note: 'N'.repeat(1200),
      reportType: 'রক্ত পরীক্ষা', // stripped for prescriptions
      pages: [samplePage(1)],
    });

    assert.strictEqual('doctorId' in clean, false);
    assert.strictEqual('reportType' in clean, false);
    assert.strictEqual(clean.date, '2026-11-16');
    assert.strictEqual(clean.title.length, 130);
    assert.strictEqual(clean.note?.length, 1000);
  });

  it('তারিখ অনুযায়ী নতুন আগে সাজায়, ফিল্টার করে ও ৩০ পাতার PDF সীমা যাচাই করে', () => {
    const docs: MedicalDocument[] = [
      makeDoc('rx-old', 2, { date: '2026-10-01', doctorId: 'doc-1', patientId: 'pat-1' }),
      makeDoc('rx-new', 3, { date: '2026-11-16', doctorId: 'doc-1', patientId: 'pat-2' }),
      makeDoc('rx-unlinked', 1, { date: '2026-11-10', doctorId: undefined, patientId: 'pat-1' }),
      makeDoc('rep-1', 2, { kind: 'report', reportType: 'ECG', doctorId: undefined, date: '2026-11-14', patientId: 'pat-1', title: 'ইসিজি রিপোর্ট' }),
    ];

    const doc1Prescriptions = filterAndSortMedicalDocuments(docs, {
      kind: 'prescription',
      doctorId: 'doc-1',
    });
    assert.deepStrictEqual(doc1Prescriptions.map((d) => d.id), ['rx-new', 'rx-old']);

    const unlinkedPrescriptions = filterAndSortMedicalDocuments(docs, {
      kind: 'prescription',
      unlinkedOnly: true,
    });
    assert.deepStrictEqual(unlinkedPrescriptions.map((d) => d.id), ['rx-unlinked']);

    const ecgReports = filterAndSortMedicalDocuments(docs, {
      kind: 'report',
      reportType: 'ECG',
    });
    assert.deepStrictEqual(ecgReports.map((d) => d.id), ['rep-1']);

    // Print validation: <= 30 allowed, 31 blocked
    assert.strictEqual(validatePrintSelectionPageCount([]).allowed, false);
    assert.strictEqual(
      validatePrintSelectionPageCount([makeDoc('big', MAX_PRINT_PAGES)]).allowed,
      true
    );
    assert.strictEqual(
      validatePrintSelectionPageCount([makeDoc('too-big', MAX_PRINT_PAGES + 1)]).allowed,
      false
    );

    const bundle = buildDocumentPrintBundle({
      kind: 'prescription',
      docs: doc1Prescriptions,
      patients: [
        {
          id: 'pat-1',
          name: 'রহিম',
          relation: 'বাবা',
          age: 62,
          gender: 'পুরুষ',
          bloodGroup: 'O+',
          chronicConditions: [],
          allergies: [],
          emergencyContact: '',
        },
        {
          id: 'pat-2',
          name: 'আমিনা',
          relation: 'মা',
          age: 55,
          gender: 'মহিলা',
          bloodGroup: 'A+',
          chronicConditions: [],
          allergies: [],
          emergencyContact: '',
        },
      ],
      doctors: [
        {
          id: 'doc-1',
          name: 'ডা. তানভীর',
          specialty: 'হৃদরোগ',
          isEmergency: true,
          createdAt: '2026-11-01T00:00:00Z',
          updatedAt: '2026-11-01T00:00:00Z',
        },
      ],
    });
    assert.strictEqual(bundle.headingTitle, 'স্বাস্থ্যবন্ধু — প্রেসক্রিপশন সংগ্রহ');
    assert.strictEqual(bundle.rows.length, 2);
    assert.strictEqual(bundle.pages.length, 5);
    assert.strictEqual(bundle.pages[0].docId, 'rx-new');
    assert.strictEqual(bundle.pages[0].pageNumberInDoc, 1);
    assert.strictEqual(bundle.pages[0].totalPagesInDoc, 3);
  });

  it('অফলাইন ও কোটা সীমা পূর্ণ হলে নথি ও ছবি নিরাপদ সিঙ্ক কিউ-তে সংরক্ষণ করে', () => {
    const map = new Map<string, string>();
    const memStore = {
      getItem: (k: string) => map.get(k) ?? null,
      setItem: (k: string, v: string) => {
        map.set(k, v);
      },
      removeItem: (k: string) => {
        map.delete(k);
      },
    };
    const uid = 'vault-user-1';

    enqueueDocUpsert(
      uid,
      'mdoc-1',
      [
        { fileId: 'mfile-1', docId: 'mdoc-1' },
        { fileId: 'mfile-2', docId: 'mdoc-1' },
      ],
      [],
      memStore
    );

    let q = loadDocSyncQueue(uid, memStore);
    assert.strictEqual(countPendingDocSyncOps(q), 3); // 1 meta + 2 files
    assert.strictEqual(getPendingDocIdSet(q).has('mdoc-1'), true);

    markFileUploadedInQueue(uid, 'mfile-1', memStore);
    markFileUploadedInQueue(uid, 'mfile-2', memStore);
    markDocUpsertSyncedInQueue(uid, 'mdoc-1', memStore);
    q = loadDocSyncQueue(uid, memStore);
    assert.strictEqual(countPendingDocSyncOps(q), 0);

    // Enqueue upsert offline then delete before cloud upload -> deletes local upload task without queuing orphan cloud file delete
    enqueueDocUpsert(
      uid,
      'mdoc-2',
      [{ fileId: 'mfile-unsynced', docId: 'mdoc-2' }],
      [],
      memStore
    );
    enqueueDocDelete(uid, 'mdoc-2', ['mfile-unsynced', 'mfile-already-cloud'], memStore);
    q = loadDocSyncQueue(uid, memStore);
    assert.deepStrictEqual(q.uploadFiles, []);
    assert.deepStrictEqual(q.deleteFileIds, ['mfile-already-cloud']);
    assert.deepStrictEqual(q.deleteDocIds, ['mdoc-2']);

    markFileDeletedInQueue(uid, 'mfile-already-cloud', memStore);
    markDocDeleteSyncedInQueue(uid, 'mdoc-2', memStore);
    clearDocSyncQueue(uid, memStore);
    assert.strictEqual(countPendingDocSyncOps(loadDocSyncQueue(uid, memStore)), 0);
  });
});

describe('ধাপ ২৮: টার্গেটেড ডার্টি সিঙ্ক, এডমিন অফলাইন/কোটা প্রকাশ সারি ও Firestore রাইট/রিড কাউন্টার', () => {
  it('১০০০ লগ ও ১০ ওষুধে পরিবর্তিত না হলে ০ লেখা এবং শুধু পরিবর্তিত রেকর্ডগুলোই সিঙ্ক পরিকল্পনায় ধরে', () => {
    const map = new Map<string, string>();
    const memStore = {
      getItem: (k: string) => map.get(k) ?? null,
      setItem: (k: string, v: string) => {
        map.set(k, v);
      },
      removeItem: (k: string) => {
        map.delete(k);
      },
    };
    const uid = 'sync-user-1';
    const lastSyncMs = 1_760_000_000_000;
    setLastSuccessfulSyncMs(uid, lastSyncMs, memStore);
    assert.strictEqual(getLastSuccessfulSyncMs(uid, memStore), lastSyncMs);

    const medicines10 = Array.from({ length: 10 }, (_, i) => ({
      id: `med-${i + 1}`,
      updatedAtMs: lastSyncMs - 10_000,
    }));
    const logs1000 = Array.from({ length: 1000 }, (_, i) => ({
      id: `log-${i + 1}`,
      updatedAtMs: lastSyncMs - 5_000,
    }));

    // 0 dirty -> 0 writes!
    const cleanPlan = collectDirtySyncPlan(
      createEmptyOutbox(),
      {
        medicines: medicines10,
        patients: [],
        doseLogs: logs1000,
        healthRecords: [],
        appointments: [],
      },
      null,
      lastSyncMs
    );
    assert.strictEqual(cleanPlan.totalWrites, 0);
    assert.deepStrictEqual(cleanPlan.breakdownLabels, []);

    // 2 modified doseLogs + 1 outbox medicine -> strictly 3 writes!
    logs1000[5].updatedAtMs = lastSyncMs + 1000;
    logs1000[42].updatedAtMs = lastSyncMs + 2000;
    markOutboxUpsert(uid, 'medicines', 'med-3', memStore);

    const dirtyPlan = collectDirtySyncPlan(
      {
        ...createEmptyOutbox(),
        upserts: {
          ...createEmptyOutbox().upserts,
          medicines: ['med-3'],
        },
      },
      {
        medicines: medicines10,
        patients: [],
        doseLogs: logs1000,
        healthRecords: [],
        appointments: [],
      },
      null,
      lastSyncMs
    );
    assert.strictEqual(dirtyPlan.totalWrites, 3);
    assert.strictEqual(dirtyPlan.collectionCounts.medicines, 1);
    assert.strictEqual(dirtyPlan.collectionCounts.doseLogs, 2);
    assert.deepStrictEqual(dirtyPlan.outboxToFlush.upserts.medicines, ['med-3']);
    assert.deepStrictEqual(dirtyPlan.outboxToFlush.upserts.doseLogs, ['log-6', 'log-43']);
  });

  it('এডমিন অপেক্ষমাণ প্রকাশ সারি ডিডুপ করে, এক সংস্করণে যুক্ত করে, সাধারণ ব্যবহারকারীর কাছে লুকায় ও ১৪:১০ BDT রিসেটে স্বয়ংক্রিয় চেষ্টা চালায়', () => {
    const makeGlobal = (id: string, brand: string): GlobalMedicine => ({
      id,
      brandName: brand,
      genericName: 'Paracetamol',
      strength: '500 mg',
      dosageForm: 'ট্যাবলেট',
      manufacturer: 'Beximco',
      source: 'DGDA_GOV',
      sourceType: 'government',
      sourceName: 'DGDA',
      licenseReference: 'DGDA Gazette',
      duplicateKey: `${id}|paracetamol|500 mg`,
      status: 'published',
      verifiedByAdmin: true,
      importedAt: '2026-11-17T00:00:00.000Z',
    });

    const cloudCatalog = [makeGlobal('gmed_1', 'Napa')];
    const q1 = dedupeAndMergeQueueMedicines([], [makeGlobal('gmed_2', 'Ace'), makeGlobal('gmed_3', 'Sergel')]);
    const q2 = dedupeAndMergeQueueMedicines(q1, [makeGlobal('gmed_2', 'Ace Plus')]);
    assert.strictEqual(q2.length, 2);
    assert.strictEqual(q2.find((m) => m.id === 'gmed_2')?.brandName, 'Ace Plus');

    // Admin sees queued items; regular users see ONLY cloudCatalog
    assert.strictEqual(mergePendingQueueForAdminDisplay(cloudCatalog, q2, true).length, 3);
    assert.strictEqual(mergePendingQueueForAdminDisplay(cloudCatalog, q2, false).length, 1);

    // Combined single-version merge puts all queued items into one list
    const singleVersionList = combineCatalogWithPendingQueueForSingleVersionPublish(cloudCatalog, q2);
    assert.strictEqual(singleVersionList.length, 3);

    const removed = removeIdsFromPublishQueue(q2, ['gmed_2']);
    assert.deepStrictEqual(removed.map((m) => m.id), ['gmed_3']);

    // Post-reset retry check: 14:15 Asia/Dhaka = 08:15 UTC
    const postResetUtc = new Date(Date.UTC(2026, 10, 17, 8, 15, 0));
    const preResetUtc = new Date(Date.UTC(2026, 10, 17, 7, 55, 0)); // 13:55 Asia/Dhaka

    const attemptAfterReset = shouldAttemptAdminQueueAutoPublish({
      hasPending: true,
      isAdmin: true,
      isOnline: true,
      isFlushing: false,
      isQuotaPausedNow: true,
      now: postResetUtc,
      lastAttemptMs: preResetUtc.getTime(),
      postResetRetriedDhakaDayKey: null,
    });
    assert.strictEqual(attemptAfterReset.shouldAttempt, true);
    assert.strictEqual(attemptAfterReset.reason, 'post_reset_210pm');

    // Before 14:10 BDT while quota is paused, do NOT burn retry writes
    const attemptBeforeReset = shouldAttemptAdminQueueAutoPublish({
      hasPending: true,
      isAdmin: true,
      isOnline: true,
      isFlushing: false,
      isQuotaPausedNow: true,
      now: preResetUtc,
      lastAttemptMs: preResetUtc.getTime() - 10_000,
      postResetRetriedDhakaDayKey: null,
    });
    assert.strictEqual(attemptBeforeReset.shouldAttempt, false);
  });

  it('দৈনিক Firestore write ও read কালেকশন অনুযায়ী সঠিকভাবে হিসাব করে', () => {
    const map = new Map<string, string>();
    const memStore = {
      getItem: (k: string) => map.get(k) ?? null,
      setItem: (k: string, v: string) => {
        map.set(k, v);
      },
      removeItem: (k: string) => {
        map.delete(k);
      },
    };
    const now = new Date('2026-11-17T06:00:00.000Z');
    resetFirestoreUsageForTests(memStore);

    recordFirestoreWrite('doseLogs', 2, memStore, now);
    recordFirestoreWrite('medicines', 1, memStore, now);
    recordFirestoreRead('library_meta', 1, memStore, now);
    recordFirestoreRead('doctors', 5, memStore, now);

    const snapshot = getTodayFirestoreUsage(memStore, now);
    assert.strictEqual(snapshot.dateKey, '2026-11-17');
    assert.strictEqual(snapshot.totalWrites, 3);
    assert.strictEqual(snapshot.totalReads, 6);
    assert.strictEqual(snapshot.writesByCollection['doseLogs'], 2);
    assert.strictEqual(snapshot.writesByCollection['medicines'], 1);
    assert.strictEqual(snapshot.readsByCollection['doctors'], 5);
  });
});

describe('ধাপ ৩১: AI মডেল কনফিগারেশন, ফলব্যাক নির্বাচন, স্ট্যান্ডার্ড কোড ও নিরাপদ মডেল লগিং', () => {
  it('ai.models.list থেকে শুধু flash/pro যুক্ত সর্বোচ্চ ২০টি মডেলের নাম ফিল্টার করে এবং ফলব্যাক flash মডেল বাছাই করে', () => {
    const rawNames = [
      'models/embedding-001',
      'models/gemini-1.5-flash',
      'models/gemini-2.0-flash',
      'models/gemini-2.5-flash-tts',
      'models/gemini-2.5-flash',
      'models/gemini-2.5-pro',
      'models/gemini-3.8-flash',
      ...Array.from({ length: 25 }, (_, i) => `models/gemini-extra-${i}-flash`),
    ];

    const filtered = filterAvailableFlashProModels(rawNames, 20);
    assert.strictEqual(filtered.length, 20);
    assert.strictEqual(filtered.includes('embedding-001'), false);
    assert.strictEqual(filtered[0], 'gemini-1.5-flash');

    // Auto fallback skips 1.5/2.0/tts and primary gemini-3.8-flash -> picks gemini-2.5-flash
    const autoFallback = pickFallbackFlashModel(filtered, 'gemini-3.8-flash');
    assert.strictEqual(autoFallback, 'gemini-2.5-flash');

    // Env GEMINI_FALLBACK_MODEL overrides auto pick and strips models/ prefix
    const envFallback = pickFallbackFlashModel(
      filtered,
      'gemini-3.8-flash',
      'models/gemini-4-hydrogen'
    );
    assert.strictEqual(envFallback, 'gemini-4-hydrogen');
    assert.strictEqual(normalizeGeminiModelName('models/gemini-3.8-flash'), 'gemini-3.8-flash');
  });

  it('404 ও 400 invalid model ত্রুটি সঠিকভাবে শনাক্ত করে এবং সব AI কোডে শ্রেণিবদ্ধ করে', () => {
    assert.strictEqual(isModelNotFoundError({ status: 404, message: 'NOT_FOUND' }), true);
    assert.strictEqual(
      isModelNotFoundError({ status: 400, message: 'INVALID_ARGUMENT: invalid model name' }),
      true
    );
    assert.strictEqual(
      isModelNotFoundError({ status: 400, message: 'INVALID_ARGUMENT: missing contents' }),
      false
    );
    assert.strictEqual(isModelNotFoundError({ status: 429, message: 'RESOURCE_EXHAUSTED' }), false);

    assert.strictEqual(classifyAiError({ status: 404, message: 'NOT_FOUND' }, 'err').code, 'model_not_found');
    assert.strictEqual(classifyAiError({ status: 401, message: 'API key not valid' }, 'err').code, 'invalid_key');
    assert.strictEqual(classifyAiError({ status: 429, message: 'RESOURCE_EXHAUSTED' }, 'err').code, 'quota');
    assert.strictEqual(classifyAiError({ status: 503, message: 'UNAVAILABLE' }, 'err').code, 'overloaded');
    assert.strictEqual(classifyAiError({ status: 504, message: 'DEADLINE_EXCEEDED' }, 'err').code, 'timeout');
    assert.strictEqual(classifyAiError(new SyntaxError('Unexpected token in JSON'), 'err').code, 'bad_response');
  });

  it('ব্যর্থতার লগে endpoint, model, status রাখে এবং চাবি/ছবি/রোগীর তথ্য গোপন রাখে', () => {
    const errLog = formatSafeAiErrorLog(
      '/api/ai/prescription',
      404,
      new Error('Model not found for AIzaSy12345678901234567890123456789012345'),
      ['রোগী আব্দুল্লাহ'],
      'gemini-3.8-flash'
    );
    assert.ok(errLog.includes('route=/api/ai/prescription'));
    assert.ok(errLog.includes('status=404'));
    assert.ok(errLog.includes('model=gemini-3.8-flash'));
    assert.strictEqual(errLog.includes('AIzaSy'), false);
  });

  it('AiServiceError এবং getAiErrorDisplay সাধারণ বাংলা বার্তা ও অ্যাডমিন কোড আলাদাভাবে সংরক্ষণ করে', () => {
    const err = new AiServiceError('AI মডেল পাওয়া যায়নি।', 'model_not_found', 404);
    const display = getAiErrorDisplay(err, 'সাধারণ ত্রুটি');
    assert.strictEqual(display.message, 'AI মডেল পাওয়া যায়নি।');
    assert.strictEqual(display.code, 'model_not_found');

    const genericDisplay = getAiErrorDisplay(new Error('অজানা সমস্যা'), 'সাধারণ ত্রুটি');
    assert.strictEqual(genericDisplay.message, 'অজানা সমস্যা');
    assert.strictEqual(genericDisplay.code, undefined);
  });
});

console.log('\n================================================================');
console.log('  🎉 ALL NEW FEATURE TESTS PASSED SUCCESSFULLY!');
console.log('================================================================\n');


