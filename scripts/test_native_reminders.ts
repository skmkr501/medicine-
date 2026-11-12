import {
  convertBengaliDigitsToEnglish,
  parseReminderTime,
  buildNativeReminderItems,
  syncNativeReminders,
  clearAllNativeReminders,
  getNativePermissionStatus,
  isNativeRemindersAvailable,
  getNativeAlarmTone,
  pickNativeAlarmTone,
  pickNativeAlarmToneFromFiles,
  previewNativeAlarmTone,
  stopNativeAlarmTonePreview,
  resetNativeAlarmTone,
  AndroidRemindersBridge,
} from '../src/services/nativeReminders';
import { Medicine, PatientProfile } from '../src/types';

console.log('================================================================');
console.log('  স্বাস্থ্যবন্ধু (Shasthobondhu) - Native Reminders Bridge Tests');
console.log('================================================================');

// 1. Test Bengali digits conversion
console.log('\n--- TEST 1: Bengali Digits Conversion ---');
const converted = convertBengaliDigitsToEnglish('০৮:৩০ AM এবং ১২:০০ PM');
if (converted === '08:30 AM এবং 12:00 PM') {
  console.log('✅ PASS: Bengali digits converted accurately:', converted);
} else {
  console.error('❌ FAIL: Expected "08:30 AM এবং 12:00 PM", got:', converted);
  process.exit(1);
}

// 2. Test Time Parsing across formats and edge cases
console.log('\n--- TEST 2: Time Parsing (Bengali, English, 12h, 24h, AM/PM) ---');
const testCases: Array<{ input: string; expected: { hour: number; minute: number } | null }> = [
  { input: '০৮:০০ AM', expected: { hour: 8, minute: 0 } },
  { input: '08:30 PM', expected: { hour: 20, minute: 30 } },
  { input: '১২:০০ AM', expected: { hour: 0, minute: 0 } },   // 12:00 AM = 0
  { input: '12:00 AM', expected: { hour: 0, minute: 0 } },
  { input: '12:30 AM', expected: { hour: 0, minute: 30 } },
  { input: '১২:০০ PM', expected: { hour: 12, minute: 0 } },  // 12:00 PM = 12
  { input: '12:00 PM', expected: { hour: 12, minute: 0 } },
  { input: '12:45 PM', expected: { hour: 12, minute: 45 } },
  { input: '০১:১৫ PM', expected: { hour: 13, minute: 15 } },
  { input: '11:59 PM', expected: { hour: 23, minute: 59 } },
  { input: '14:20', expected: { hour: 14, minute: 20 } },
  { input: '০৯:১৫', expected: { hour: 9, minute: 15 } },
  { input: '25:00', expected: null },
  { input: 'invalid', expected: null },
  { input: '', expected: null },
];

for (const tc of testCases) {
  const result = parseReminderTime(tc.input);
  if (tc.expected === null) {
    if (result === null) {
      console.log(`✅ PASS: Invalid time "${tc.input}" correctly parsed to null`);
    } else {
      console.error(`❌ FAIL: Expected null for "${tc.input}", got:`, result);
      process.exit(1);
    }
  } else {
    if (result && result.hour === tc.expected.hour && result.minute === tc.expected.minute) {
      console.log(`✅ PASS: "${tc.input}" -> { hour: ${result.hour}, minute: ${result.minute} }`);
    } else {
      console.error(`❌ FAIL: "${tc.input}" expected`, tc.expected, 'got', result);
      process.exit(1);
    }
  }
}

// 3. Test buildNativeReminderItems across family members and archived exclusion
console.log('\n--- TEST 3: Multi-Member Reminder Items & Archive Exclusion ---');

const dummyPatients: PatientProfile[] = [
  {
    id: 'p-father',
    name: 'আব্দুর রহমান',
    relation: 'বাবা',
    age: 68,
    gender: 'পুরুষ',
    bloodGroup: 'B+',
    emergencyContact: '01711000000',
    chronicConditions: ['উচ্চ রক্তচাপ'],
    allergies: [],
    isArchived: false,
  },
  {
    id: 'p-mother',
    name: 'রাহেলা বেগম',
    relation: 'মা',
    age: 62,
    gender: 'মহিলা',
    bloodGroup: 'O+',
    emergencyContact: '01811000000',
    chronicConditions: ['ডায়াবেটিস'],
    allergies: [],
    isArchived: true, // ARCHIVED!
  },
];

const dummyMedicines: Medicine[] = [
  // Active medicine for Father (Active profile)
  {
    id: 'med-1',
    brandName: 'টেলমিভাস ৪০ (Telmivas 40)',
    genericName: 'Telmisartan 40mg',
    type: 'ট্যাবলেট',
    strength: '40mg',
    mealTiming: 'খাওয়ার পরে',
    assignedPatientId: 'p-father',
    stock: 28,
    minStockAlert: 7,
    unit: 'টি',
    startDate: '2026-11-01',
    isChronic: true,
    status: 'active',
    colorTag: 'teal',
    schedules: [
      { id: 'sch-1', timeSlot: 'সকাল', time: '০৮:৩০ AM', dosage: '১টি' },
      { id: 'sch-2', timeSlot: 'রাত', time: '09:00 PM', dosage: '১টি' },
    ],
  },
  // Active medicine for Mother (Archived profile -> MUST BE EXCLUDED)
  {
    id: 'med-2',
    brandName: 'সেক্লো ২০ (Seclo 20)',
    genericName: 'Omeprazole 20mg',
    type: 'ক্যাপসুল',
    strength: '20mg',
    mealTiming: 'খাওয়ার আগে',
    assignedPatientId: 'p-mother',
    stock: 14,
    minStockAlert: 5,
    unit: 'টি',
    startDate: '2026-11-01',
    isChronic: true,
    status: 'active',
    colorTag: 'blue',
    schedules: [
      { id: 'sch-3', timeSlot: 'সকাল', time: '০৭:০০ AM', dosage: '১টি' },
    ],
  },
  // Paused medicine for Father (Status !== 'active' -> MUST BE EXCLUDED)
  {
    id: 'med-3',
    brandName: 'নাপা এক্সট্রা',
    genericName: 'Paracetamol',
    type: 'ট্যাবলেট',
    strength: '500mg',
    mealTiming: 'খাওয়ার পরে',
    assignedPatientId: 'p-father',
    stock: 10,
    minStockAlert: 5,
    unit: 'টি',
    startDate: '2026-11-01',
    isChronic: false,
    status: 'paused',
    colorTag: 'amber',
    schedules: [
      { id: 'sch-4', timeSlot: 'দুপুর', time: '02:00 PM', dosage: '১টি' },
    ],
  },
  // Medicine without assignedPatientId (Belongs to default user -> INCLUDED)
  {
    id: 'med-4',
    brandName: 'সিভিট ২৫০ (Ceevit 250)',
    genericName: 'Vitamin C',
    type: 'ট্যাবলেট',
    strength: '250mg',
    mealTiming: 'খাওয়ার পরে',
    stock: 30,
    minStockAlert: 5,
    unit: 'টি',
    startDate: '2026-11-01',
    isChronic: false,
    status: 'active',
    colorTag: 'emerald',
    schedules: [
      { id: 'sch-5', timeSlot: 'দুপুর', time: '০১:০০ PM', dosage: '১টি' },
    ],
  },
];

const items = buildNativeReminderItems(dummyMedicines, dummyPatients);
console.log(`Generated ${items.length} reminder items:`, items.map(i => ({ id: i.reminderId, med: i.medicineName, time: `${i.hour}:${i.minute}`, patient: i.patientName })));

if (items.length !== 3) {
  console.error(`❌ FAIL: Expected exactly 3 items, got ${items.length}`);
  process.exit(1);
}

// Check Father's 2 schedules
const fatherItems = items.filter(i => i.patientName === 'আব্দুর রহমান');
if (fatherItems.length !== 2) {
  console.error(`❌ FAIL: Expected 2 items for Father, got ${fatherItems.length}`);
  process.exit(1);
}
console.log('✅ PASS: Exactly 2 items for Father');

// Check Mother's items (Must be 0 because archived)
const motherItems = items.filter(i => i.medicineId === 'med-2');
if (motherItems.length !== 0) {
  console.error(`❌ FAIL: Archived patient medicine was not excluded!`);
  process.exit(1);
}
console.log('✅ PASS: Archived patient medicine excluded');

// Check paused medicine (Must be 0)
const pausedItems = items.filter(i => i.medicineId === 'med-3');
if (pausedItems.length !== 0) {
  console.error(`❌ FAIL: Paused medicine was not excluded!`);
  process.exit(1);
}
console.log('✅ PASS: Paused medicine excluded');

// Check default patient medicine
const defaultItems = items.filter(i => i.medicineId === 'med-4');
if (defaultItems.length === 1 && defaultItems[0].patientName === 'আমার ওষুধ') {
  console.log('✅ PASS: Default patient medicine included with name "আমার ওষুধ"');
} else {
  console.error(`❌ FAIL: Default patient medicine issue:`, defaultItems);
  process.exit(1);
}

// Check exact fields of first item
const first = items[0];
if (
  first.reminderId === 'med-1_sch-1' &&
  first.medicineId === 'med-1' &&
  first.medicineName === 'টেলমিভাস ৪০ (Telmivas 40)' &&
  first.genericName === 'Telmisartan 40mg' &&
  first.dosage === '১টি টি' &&
  first.hour === 8 &&
  first.minute === 30 &&
  first.active === true
) {
  console.log('✅ PASS: First item structure and fields match specification exactly');
} else {
  console.error('❌ FAIL: Item fields do not match:', first);
  process.exit(1);
}

// 4. Test Native Bridge Simulation
console.log('\n--- TEST 4: window.AndroidReminders Bridge Interaction ---');

// Initially window.AndroidReminders is undefined (browser mode)
if (!isNativeRemindersAvailable()) {
  console.log('✅ PASS: isNativeRemindersAvailable() returns false in standard browser mode');
} else {
  console.error('❌ FAIL: Expected false when bridge is missing');
  process.exit(1);
}

// Mock window.AndroidReminders
let syncedPayload = '';
let clearCalled = false;
let testAlarmScheduled = false;

const mockBridge: AndroidRemindersBridge = {
  syncReminders: (jsonString: string) => {
    syncedPayload = jsonString;
    const parsed = JSON.parse(jsonString);
    return JSON.stringify({ ok: true, count: parsed.length });
  },
  clearAll: () => {
    clearCalled = true;
  },
  getPermissionStatus: () => {
    return JSON.stringify({
      exactAlarm: true,
      notifications: true,
      batteryUnrestricted: false,
    });
  },
  openExactAlarmSettings: () => {},
  openBatterySettings: () => {},
  requestNotificationPermission: () => {},
  scheduleTestAlarm: () => {
    testAlarmScheduled = true;
    return true;
  },
  getAlarmTone: () => JSON.stringify({ name: 'ভোরের সুর', isDefault: false }),
  pickAlarmTone: () => {
    alarmTonePicked = true;
  },
  pickAlarmToneFromFiles: () => {
    alarmToneFilePicked = true;
  },
  previewAlarmTone: () => {
    alarmPreviewStarted = true;
  },
  stopPreview: () => {
    alarmPreviewStopped = true;
  },
  resetAlarmTone: () => {
    alarmToneReset = true;
  },
};

let alarmTonePicked = false;
let alarmToneFilePicked = false;
let alarmPreviewStarted = false;
let alarmPreviewStopped = false;
let alarmToneReset = false;

(globalThis as unknown as { window: { AndroidReminders: AndroidRemindersBridge } }).window = {
  AndroidReminders: mockBridge,
};

if (isNativeRemindersAvailable()) {
  console.log('✅ PASS: isNativeRemindersAvailable() returns true when AndroidReminders is present');
} else {
  console.error('❌ FAIL: Expected true when bridge is present');
  process.exit(1);
}

const syncRes = syncNativeReminders(dummyMedicines, dummyPatients);
if (syncRes && syncRes.ok && syncRes.count === 3 && syncedPayload.length > 0) {
  console.log('✅ PASS: syncNativeReminders successfully called AndroidReminders.syncReminders and returned count 3');
} else {
  console.error('❌ FAIL: syncNativeReminders failed:', syncRes);
  process.exit(1);
}

clearAllNativeReminders();
if (clearCalled) {
  console.log('✅ PASS: clearAllNativeReminders called AndroidReminders.clearAll()');
} else {
  console.error('❌ FAIL: clearAll was not called');
  process.exit(1);
}

const permStatus = getNativePermissionStatus();
if (permStatus && permStatus.exactAlarm === true && permStatus.batteryUnrestricted === false) {
  console.log('✅ PASS: getNativePermissionStatus successfully parsed permission JSON:', permStatus);
} else {
  console.error('❌ FAIL: getNativePermissionStatus failed:', permStatus);
  process.exit(1);
}

const toneInfo = getNativeAlarmTone();
if (toneInfo && toneInfo.name === 'ভোরের সুর' && toneInfo.isDefault === false) {
  console.log('✅ PASS: getNativeAlarmTone parsed JSON:', toneInfo);
} else {
  console.error('❌ FAIL: getNativeAlarmTone failed:', toneInfo);
  process.exit(1);
}

if (
  pickNativeAlarmTone() &&
  alarmTonePicked &&
  pickNativeAlarmToneFromFiles() &&
  alarmToneFilePicked &&
  previewNativeAlarmTone() &&
  alarmPreviewStarted
) {
  stopNativeAlarmTonePreview();
  resetNativeAlarmTone();
  if (alarmPreviewStopped && alarmToneReset) {
    console.log('✅ PASS: Alarm tone picker, preview, stopPreview, and resetAlarmTone bridge methods verified');
  } else {
    console.error('❌ FAIL: stopPreview or resetAlarmTone failed');
    process.exit(1);
  }
} else {
  console.error('❌ FAIL: Alarm tone picker/preview bridge methods failed');
  process.exit(1);
}

console.log('\n================================================================');
console.log('  🎉 ALL NATIVE REMINDER TESTS PASSED SUCCESSFULLY!  ');
console.log('================================================================');
