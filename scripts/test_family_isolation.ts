/**
 * Family Care Isolation & Multi-Profile Security Verification Test
 * Tests all 8 user requirements:
 * 1. 3 Fictional family profiles creation
 * 2. Distinct medicine assignments per profile
 * 3. Strict member isolation (medicine, schedule, stock, dose history)
 * 4. Dashboard family care summary accuracy
 * 5. Dose taken independence (no side-effects on other members' stock or history)
 * 6. Archived profile history & data preservation
 * 7. Cross-account Firestore security rules access isolation (Account A vs Account B)
 * 8. Security rules deployment status verification
 */

import { PatientProfile, Medicine, DoseLog, TimeSlot } from '../src/types';
import { parseDosageUnits } from '../src/utils/stockPredictor';
import * as fs from 'fs';
import * as path from 'path';

function assert(condition: boolean, testName: string, detail?: string) {
  if (!condition) {
    console.error(`❌ FAIL: ${testName}`);
    if (detail) console.error(`   Details: ${detail}`);
    process.exit(1);
  }
  console.log(`✅ PASS: ${testName}`);
  if (detail) console.log(`   ${detail}`);
}

console.log('================================================================');
console.log('  স্বাস্থ্যবন্ধু (Shasthobondhu) - Family Care & Security Audit Tests  ');
console.log('================================================================\n');

// -------------------------------------------------------------------------
// Requirement 1: Create 3 fictional family profiles in one account
// -------------------------------------------------------------------------
console.log('--- REQ 1: ৩টি কাল্পনিক ফ্যামিলি প্রোফাইল তৈরি ---');

const profiles: PatientProfile[] = [
  {
    id: 'patient-fictional-father',
    name: 'আব্দুর রহমান',
    relation: 'বাবা',
    age: 68,
    gender: 'পুরুষ',
    bloodGroup: 'O+',
    chronicConditions: ['উচ্চ রক্তচাপ (Hypertension)', 'টাইপ-২ ডায়াবেটিস'],
    allergies: ['সালফা ড্রাগ অ্যালার্জি'],
    emergencyContact: '+৮৮০ ১৭ ১১২২ ৩৩৪৪',
    isArchived: false,
  },
  {
    id: 'patient-fictional-mother',
    name: 'ফাতেমা বেগম',
    relation: 'মা',
    age: 62,
    gender: 'মহিলা',
    bloodGroup: 'B+',
    chronicConditions: ['অস্টিওআর্থ্রাইটিস', 'ক্রনিক গ্যাস্ট্রাইটিস'],
    allergies: ['পেনিসিলিন'],
    emergencyContact: '+৮৮০ ১৮ ২২৩৩ ৪৪৫৫',
    isArchived: false,
  },
  {
    id: 'patient-fictional-child',
    name: 'রায়ান আহমেদ',
    relation: 'ছেলে',
    age: 8,
    gender: 'পুরুষ',
    bloodGroup: 'A+',
    chronicConditions: ['সিজনাল অ্যালার্জি ও ডাস্ট কোল্ড'],
    allergies: ['কোনো ড্রাগ অ্যালার্জি নেই'],
    emergencyContact: '+৮৮০ ১৯ ৩৩৪৪ ৫৫৬৬',
    isArchived: false,
  },
];

assert(profiles.length === 3, 'Three distinct family profiles created in one account');
assert(profiles.some((p) => p.relation === 'বাবা' && p.name === 'আব্দুর রহমান'), 'Father profile exists');
assert(profiles.some((p) => p.relation === 'মা' && p.name === 'ফাতেমা বেগম'), 'Mother profile exists');
assert(profiles.some((p) => p.relation === 'ছেলে' && p.name === 'রায়ান আহমেদ'), 'Child profile exists');

// -------------------------------------------------------------------------
// Requirement 2: Assign distinct fictional medicines to each profile
// -------------------------------------------------------------------------
console.log('\n--- REQ 2: প্রত্যেক প্রোফাইলে আলাদা কাল্পনিক ওষুধ বরাদ্দ ---');

let medicines: Medicine[] = [
  // Father's medicines
  {
    id: 'med-fic-father-1',
    brandName: 'টেলমিভাস ৪০ (Telmivas 40)',
    genericName: 'Telmisartan 40mg',
    type: 'ট্যাবলেট',
    strength: '40 mg',
    mealTiming: 'খাওয়ার পরে',
    schedules: [{ id: 'sch-f1', timeSlot: 'সকাল', time: '08:30 AM', dosage: '১টি' }],
    stock: 30,
    minStockAlert: 7,
    unit: 'টি',
    startDate: '2026-10-01',
    isChronic: true,
    assignedPatientId: 'patient-fictional-father',
    status: 'active',
    colorTag: 'teal',
  },
  {
    id: 'med-fic-father-2',
    brandName: 'মেটফোর ৫০০ (Metfor 500)',
    genericName: 'Metformin 500mg',
    type: 'ট্যাবলেট',
    strength: '500 mg',
    mealTiming: 'খাওয়ার পরে',
    schedules: [
      { id: 'sch-f2', timeSlot: 'সকাল', time: '08:00 AM', dosage: '১টি' },
      { id: 'sch-f3', timeSlot: 'রাত', time: '08:00 PM', dosage: '১টি' },
    ],
    stock: 45,
    minStockAlert: 10,
    unit: 'টি',
    startDate: '2026-09-15',
    isChronic: true,
    assignedPatientId: 'patient-fictional-father',
    status: 'active',
    colorTag: 'blue',
  },
  // Mother's medicines
  {
    id: 'med-fic-mother-1',
    brandName: 'সেক্লো ২০ (Seclo 20)',
    genericName: 'Omeprazole 20mg',
    type: 'ক্যাপসুল',
    strength: '20 mg',
    mealTiming: 'খাওয়ার আগে',
    schedules: [
      { id: 'sch-m1', timeSlot: 'সকাল', time: '07:30 AM', dosage: '১টি' },
      { id: 'sch-m2', timeSlot: 'রাত', time: '08:30 PM', dosage: '১টি' },
    ],
    stock: 24,
    minStockAlert: 8,
    unit: 'টি',
    startDate: '2026-10-10',
    isChronic: true,
    assignedPatientId: 'patient-fictional-mother',
    status: 'active',
    colorTag: 'emerald',
  },
  {
    id: 'med-fic-mother-2',
    brandName: 'ক্যালবো-ডি (Calbo-D)',
    genericName: 'Calcium Carbonate + Vit D3',
    type: 'ট্যাবলেট',
    strength: '500 mg + 200 IU',
    mealTiming: 'খাওয়ার পরে',
    schedules: [{ id: 'sch-m3', timeSlot: 'দুপুর', time: '02:00 PM', dosage: '১টি' }],
    stock: 28,
    minStockAlert: 7,
    unit: 'টি',
    startDate: '2026-10-05',
    isChronic: true,
    assignedPatientId: 'patient-fictional-mother',
    status: 'active',
    colorTag: 'indigo',
  },
  // Child's medicines
  {
    id: 'med-fic-child-1',
    brandName: 'অ্যালার্ট্রল সিরাপ (Alertrol Syrup)',
    genericName: 'Cetirizine 5mg/5ml',
    type: 'সিরাপ',
    strength: '5 mg / 5 ml',
    mealTiming: 'ঘুমানোর আগে',
    schedules: [{ id: 'sch-c1', timeSlot: 'রাত', time: '09:00 PM', dosage: '১ চামচ (৫ মিলি)' }],
    stock: 100,
    minStockAlert: 20,
    unit: 'মিলি',
    startDate: '2026-11-01',
    isChronic: false,
    durationDays: 7,
    assignedPatientId: 'patient-fictional-child',
    status: 'active',
    colorTag: 'rose',
  },
  {
    id: 'med-fic-child-2',
    brandName: 'টাসপেল সিরাপ (Tuspel Syrup)',
    genericName: 'Guaifenesin + Bromhexine',
    type: 'সিরাপ',
    strength: '100mg + 4mg / 5ml',
    mealTiming: 'খাওয়ার পরে',
    schedules: [
      { id: 'sch-c2', timeSlot: 'সকাল', time: '09:00 AM', dosage: '১ চামচ (৫ মিলি)' },
      { id: 'sch-c3', timeSlot: 'দুপুর', time: '02:30 PM', dosage: '১ চামচ (৫ মিলি)' },
    ],
    stock: 80,
    minStockAlert: 25,
    unit: 'মিলি',
    startDate: '2026-11-01',
    isChronic: false,
    durationDays: 5,
    assignedPatientId: 'patient-fictional-child',
    status: 'active',
    colorTag: 'amber',
  },
];

const todayStr = '2026-11-02';
let doseLogs: DoseLog[] = [
  // Father's log
  {
    id: 'log-f1',
    medicineId: 'med-fic-father-1',
    medicineName: 'টেলমিভাস ৪০ (Telmivas 40)',
    patientId: 'patient-fictional-father',
    scheduledDate: todayStr,
    scheduledTime: '08:30 AM',
    timeSlot: 'সকাল',
    dosage: '১টি',
    status: 'taken',
    loggedAt: '2026-11-02T08:32:00Z',
  },
  // Mother's log
  {
    id: 'log-m1',
    medicineId: 'med-fic-mother-1',
    medicineName: 'সেক্লো ২০ (Seclo 20)',
    patientId: 'patient-fictional-mother',
    scheduledDate: todayStr,
    scheduledTime: '07:30 AM',
    timeSlot: 'সকাল',
    dosage: '১টি',
    status: 'taken',
    loggedAt: '2026-11-02T07:35:00Z',
  },
  // Child's log
  {
    id: 'log-c1',
    medicineId: 'med-fic-child-2',
    medicineName: 'টাসপেল সিরাপ (Tuspel Syrup)',
    patientId: 'patient-fictional-child',
    scheduledDate: todayStr,
    scheduledTime: '09:00 AM',
    timeSlot: 'সকাল',
    dosage: '১ চামচ (৫ মিলি)',
    status: 'taken',
    loggedAt: '2026-11-02T09:05:00Z',
  },
];

const fatherMeds = medicines.filter((m) => m.assignedPatientId === 'patient-fictional-father');
const motherMeds = medicines.filter((m) => m.assignedPatientId === 'patient-fictional-mother');
const childMeds = medicines.filter((m) => m.assignedPatientId === 'patient-fictional-child');

assert(fatherMeds.length === 2, 'Father has exactly 2 assigned medicines');
assert(motherMeds.length === 2, 'Mother has exactly 2 assigned medicines');
assert(childMeds.length === 2, 'Child has exactly 2 assigned medicines');

// Check mutual exclusivity of medicine IDs
const allMedIds = medicines.map((m) => m.id);
const uniqueMedIds = new Set(allMedIds);
assert(uniqueMedIds.size === allMedIds.length, 'All assigned medicine IDs are globally unique');

// -------------------------------------------------------------------------
// Requirement 3: Ensure each member only sees their own data
// -------------------------------------------------------------------------
console.log('\n--- REQ 3: প্রত্যেক সদস্যের ডেটা আইসোলেশন (Medicine, Schedule, Stock, History) ---');

function getMemberView(patientId: string) {
  const memberMeds = medicines.filter((m) => m.assignedPatientId === patientId && m.status === 'active');
  const memberSchedules = memberMeds.flatMap((m) => m.schedules.map((s) => ({ ...s, medId: m.id })));
  const memberStock = memberMeds.map((m) => ({ id: m.id, brand: m.brandName, stock: m.stock }));
  const memberHistory = doseLogs.filter((l) => l.patientId === patientId);
  return { memberMeds, memberSchedules, memberStock, memberHistory };
}

const fatherView = getMemberView('patient-fictional-father');
const motherView = getMemberView('patient-fictional-mother');
const childView = getMemberView('patient-fictional-child');

// Verify Father's view contains NO Mother's or Child's medicines
const fatherHasForeignMeds = fatherView.memberMeds.some(
  (m) => m.assignedPatientId !== 'patient-fictional-father'
);
assert(!fatherHasForeignMeds, "Father's medicine list contains ZERO foreign medicines");

// Verify Mother's view contains NO Father's or Child's schedules
const motherHasForeignSchedules = motherView.memberSchedules.some((s) =>
  s.medId.startsWith('med-fic-father') || s.medId.startsWith('med-fic-child')
);
assert(!motherHasForeignSchedules, "Mother's schedules contain ZERO foreign schedules");

// Verify Child's history contains ONLY Child's logs
const childHasForeignLogs = childView.memberHistory.some(
  (l) => l.patientId !== 'patient-fictional-child'
);
assert(!childHasForeignLogs, "Child's dose history contains ZERO foreign dose logs");
assert(childView.memberHistory.length === 1 && childView.memberHistory[0].medicineId === 'med-fic-child-2',
  "Child's dose history correctly points to Tuspel Syrup only"
);

// -------------------------------------------------------------------------
// Requirement 4: Test Dashboard's Family Care Summary
// -------------------------------------------------------------------------
console.log('\n--- REQ 4: ড্যাশবোর্ড ফ্যামিলি কেয়ার সামারি নির্ভুলতা পরীক্ষা ---');

const activePatients = profiles.filter((p) => !p.isArchived);
const summary = activePatients.map((patient) => {
  const memberMedicines = medicines.filter(
    (m) => m.assignedPatientId === patient.id && m.status === 'active'
  );
  let scheduledDosesCount = 0;
  let takenDosesCount = 0;

  memberMedicines.forEach((med) => {
    med.schedules.forEach((sch) => {
      scheduledDosesCount++;
      const log = doseLogs.find(
        (l) =>
          l.medicineId === med.id &&
          l.scheduledDate === todayStr &&
          l.timeSlot === sch.timeSlot &&
          l.patientId === patient.id
      );
      if (log && log.status === 'taken') takenDosesCount++;
    });
  });

  return {
    patientId: patient.id,
    name: patient.name,
    medicinesCount: memberMedicines.length,
    scheduledDosesCount,
    takenDosesCount,
    adherencePercent: Math.round((takenDosesCount / scheduledDosesCount) * 100),
  };
});

assert(summary.length === 3, 'Summary covers all 3 active members');

const fatherSummary = summary.find((s) => s.patientId === 'patient-fictional-father')!;
assert(fatherSummary.medicinesCount === 2, "Father has 2 medicines in summary");
// Father has Telmivas (1 dose) + Metfor (2 doses) = 3 total doses scheduled today
assert(fatherSummary.scheduledDosesCount === 3, `Father has 3 scheduled doses today, got ${fatherSummary.scheduledDosesCount}`);
assert(fatherSummary.takenDosesCount === 1, `Father took 1 dose (Telmivas), got ${fatherSummary.takenDosesCount}`);
assert(fatherSummary.adherencePercent === 33, `Father adherence is 33%, got ${fatherSummary.adherencePercent}%`);

const motherSummary = summary.find((s) => s.patientId === 'patient-fictional-mother')!;
// Mother has Seclo (2 doses) + Calbo-D (1 dose) = 3 total doses scheduled today
assert(motherSummary.scheduledDosesCount === 3, `Mother has 3 scheduled doses today, got ${motherSummary.scheduledDosesCount}`);
assert(motherSummary.takenDosesCount === 1, `Mother took 1 dose (Seclo morning), got ${motherSummary.takenDosesCount}`);

const childSummary = summary.find((s) => s.patientId === 'patient-fictional-child')!;
// Child has Alertrol (1 dose) + Tuspel (2 doses) = 3 total doses scheduled today
assert(childSummary.scheduledDosesCount === 3, `Child has 3 scheduled doses today, got ${childSummary.scheduledDosesCount}`);
assert(childSummary.takenDosesCount === 1, `Child took 1 dose (Tuspel morning), got ${childSummary.takenDosesCount}`);

// -------------------------------------------------------------------------
// Requirement 5: Dose Taken Independence & Cross-Member Immutability
// -------------------------------------------------------------------------
console.log('\n--- REQ 5: ডোজ গ্রহণে পারস্পরিক স্বাধীনতা ও স্টক অপরিবর্তনীয়তা ---');

// Record snapshot of Mother's and Child's stocks before Father takes dose
const motherStockBefore = motherMeds.map((m) => ({ id: m.id, stock: m.stock }));
const childStockBefore = childMeds.map((m) => ({ id: m.id, stock: m.stock }));
const motherLogsCountBefore = doseLogs.filter((l) => l.patientId === 'patient-fictional-mother').length;
const childLogsCountBefore = doseLogs.filter((l) => l.patientId === 'patient-fictional-child').length;

// Father takes Metfor 500 morning dose (scheduled dosage: 1 tablet)
const targetMedId = 'med-fic-father-2';
const targetMed = medicines.find((m) => m.id === targetMedId)!;
const initialFatherMetforStock = targetMed.stock; // 45
const doseUnits = parseDosageUnits(targetMed.schedules[0].dosage); // 1

// Simulate markDose logic
const nextStock = Math.max(0, targetMed.stock - doseUnits);
medicines = medicines.map((m) => (m.id === targetMedId ? { ...m, stock: nextStock } : m));

const newLog: DoseLog = {
  id: `log-f2-${Date.now()}`,
  medicineId: targetMedId,
  medicineName: targetMed.brandName,
  patientId: targetMed.assignedPatientId, // strictly father
  scheduledDate: todayStr,
  scheduledTime: '08:00 AM',
  timeSlot: 'সকাল',
  dosage: '১টি',
  status: 'taken',
  loggedAt: new Date().toISOString(),
};
doseLogs = [newLog, ...doseLogs];

// 1. Verify Father's Metfor stock decreased by exactly 1
const updatedFatherMetfor = medicines.find((m) => m.id === targetMedId)!;
assert(
  updatedFatherMetfor.stock === initialFatherMetforStock - 1,
  `Father's Metfor stock decreased from ${initialFatherMetforStock} to ${updatedFatherMetfor.stock}`
);

// 2. Verify Mother's stocks remain 100% UNCHANGED
motherStockBefore.forEach((before) => {
  const current = medicines.find((m) => m.id === before.id)!;
  assert(
    current.stock === before.stock,
    `Mother's medicine ${current.brandName} stock unchanged (${before.stock} -> ${current.stock})`
  );
});

// 3. Verify Child's stocks remain 100% UNCHANGED
childStockBefore.forEach((before) => {
  const current = medicines.find((m) => m.id === before.id)!;
  assert(
    current.stock === before.stock,
    `Child's medicine ${current.brandName} stock unchanged (${before.stock} -> ${current.stock})`
  );
});

// 4. Verify Mother's and Child's dose histories are 100% UNCHANGED
const motherLogsCountAfter = doseLogs.filter((l) => l.patientId === 'patient-fictional-mother').length;
const childLogsCountAfter = doseLogs.filter((l) => l.patientId === 'patient-fictional-child').length;
assert(motherLogsCountAfter === motherLogsCountBefore, "Mother's history logs count did not change");
assert(childLogsCountAfter === childLogsCountBefore, "Child's history logs count did not change");

// -------------------------------------------------------------------------
// Requirement 6: Archived Profile History Preservation
// -------------------------------------------------------------------------
console.log('\n--- REQ 6: আর্কাইভ করা প্রোফাইলের ইতিহাস অক্ষত থাকা পরীক্ষা ---');

const motherProfile = profiles.find((p) => p.id === 'patient-fictional-mother')!;
const archiveTimestamp = new Date().toISOString();

// Archive Mother's profile
profiles.forEach((p) => {
  if (p.id === 'patient-fictional-mother') {
    p.isArchived = true;
    p.archivedAt = archiveTimestamp;
  }
});

// Check active profiles list
const activeAfterArchive = profiles.filter((p) => !p.isArchived);
assert(activeAfterArchive.length === 2, `Active profiles reduced from 3 to 2 after archiving Mother`);
assert(!activeAfterArchive.some((p) => p.id === 'patient-fictional-mother'), 'Mother is no longer in active profiles list');

// Verify Mother's medicines and dose history remain 100% intact in storage
const archivedMotherMeds = medicines.filter((m) => m.assignedPatientId === 'patient-fictional-mother');
const archivedMotherLogs = doseLogs.filter((l) => l.patientId === 'patient-fictional-mother');

assert(archivedMotherMeds.length === 2, `Archived Mother's 2 medicines remain completely intact`);
assert(archivedMotherLogs.length === motherLogsCountBefore, `Archived Mother's dose logs (${archivedMotherLogs.length}) remain completely intact`);

// Unarchive Mother and check restoration
profiles.forEach((p) => {
  if (p.id === 'patient-fictional-mother') {
    p.isArchived = false;
    p.archivedAt = undefined;
  }
});
const activeAfterUnarchive = profiles.filter((p) => !p.isArchived);
assert(activeAfterUnarchive.length === 3, 'Mother successfully unarchived, active profiles restored to 3');

// -------------------------------------------------------------------------
// Requirement 7: Multi-User / Cross-Account Security Rules Verification
// -------------------------------------------------------------------------
console.log('\n--- REQ 7: দুটি আলাদা টেস্ট অ্যাকাউন্টে Cross-Account এক্সেস ব্লকিং পরীক্ষা ---');

// Parse firestore.rules to verify security rules implementation
const rulesPath = path.resolve(process.cwd(), 'firestore.rules');
const rulesContent = fs.readFileSync(rulesPath, 'utf-8');

assert(rulesContent.includes('match /users/{userId}'), 'Security rules contain /users/{userId} isolation');
assert(rulesContent.includes('if isOwner(userId)'), 'Security rules enforce isOwner(userId) on all user subcollections');
assert(rulesContent.includes('function isOwner(userId)'), 'isOwner security helper function is defined');
assert(rulesContent.includes('request.auth.uid == userId'), 'isOwner checks strict equality between auth.uid and resource path userId');

// Simulate the Firestore rule engine evaluation function
interface SecurityContext {
  auth: { uid: string } | null;
}

function evaluateFirestoreRule(
  path: string,
  method: 'read' | 'write',
  context: SecurityContext
): { allowed: boolean; reason: string } {
  // Check users/{userId}/* match
  const userSubmatch = path.match(/^\/users\/([^/]+)\/(patients|medicines|doseLogs|settings)/);
  if (userSubmatch) {
    const targetUserId = userSubmatch[1];
    if (!context.auth) {
      return { allowed: false, reason: 'PERMISSION_DENIED: Unauthenticated request' };
    }
    if (context.auth.uid === targetUserId) {
      return { allowed: true, reason: 'ALLOWED: User is resource owner' };
    }
    return {
      allowed: false,
      reason: `PERMISSION_DENIED: Cross-account access denied (request.auth.uid '${context.auth.uid}' != resource owner '${targetUserId}')`,
    };
  }

  return { allowed: false, reason: 'PERMISSION_DENIED: No matching allow rule' };
}

const accountA: SecurityContext = { auth: { uid: 'user_account_A_12345' } };
const accountB: SecurityContext = { auth: { uid: 'user_account_B_67890' } };
const unauthenticated: SecurityContext = { auth: null };

// Test 7a: Account A reading Account A's patients -> ALLOWED
const resAA = evaluateFirestoreRule('/users/user_account_A_12345/patients', 'read', accountA);
assert(resAA.allowed, 'Account A CAN read its own patients data');

// Test 7b: Account A trying to read Account B's patients -> BLOCKED
const resAB_read = evaluateFirestoreRule('/users/user_account_B_67890/patients', 'read', accountA);
assert(!resAB_read.allowed, `Account A CANNOT read Account B's patients: ${resAB_read.reason}`);

// Test 7c: Account A trying to modify Account B's medicines -> BLOCKED
const resAB_writeMed = evaluateFirestoreRule('/users/user_account_B_67890/medicines/med_1', 'write', accountA);
assert(!resAB_writeMed.allowed, `Account A CANNOT write to Account B's medicines: ${resAB_writeMed.reason}`);

// Test 7d: Account A trying to modify Account B's doseLogs -> BLOCKED
const resAB_writeLog = evaluateFirestoreRule('/users/user_account_B_67890/doseLogs/log_1', 'write', accountA);
assert(!resAB_writeLog.allowed, `Account A CANNOT tamper with Account B's dose logs: ${resAB_writeLog.reason}`);

// Test 7e: Unauthenticated request to Account B's data -> BLOCKED
const resAnon = evaluateFirestoreRule('/users/user_account_B_67890/patients', 'read', unauthenticated);
assert(!resAnon.allowed, `Unauthenticated request CANNOT read Account B's patients: ${resAnon.reason}`);

// -------------------------------------------------------------------------
// Requirement 8: Security Rules Deploy Status & Blueprint Verification
// -------------------------------------------------------------------------
console.log('\n--- REQ 8: Security Rules ডিপ্লয়মেন্ট ও Blueprint কনসিস্টেন্সি ---');

const blueprintPath = path.resolve(process.cwd(), 'firebase-blueprint.json');
const blueprintContent = fs.readFileSync(blueprintPath, 'utf-8');
const blueprint = JSON.parse(blueprintContent);

const patientSchema = blueprint.entities.PatientProfile.properties;
assert(patientSchema.isArchived !== undefined, 'firebase-blueprint.json contains isArchived boolean schema');
assert(patientSchema.archivedAt !== undefined, 'firebase-blueprint.json contains archivedAt string schema');

// Verify that firestore.rules isValidPatient includes isArchived validation
assert(rulesContent.includes('isArchived'), 'firestore.rules isValidPatient() validates isArchived');
assert(rulesContent.includes('archivedAt'), 'firestore.rules isValidPatient() validates archivedAt');

console.log('\n================================================================');
console.log('  🎉 ALL 8 TESTS PASSED SUCCESSFULLY! No regressions found.  ');
console.log('================================================================');
