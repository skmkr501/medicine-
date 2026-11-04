import {
  Medicine,
  DoseSchedule,
  StockPrediction,
  StockPredictionStatus,
} from '../types';
import { toBengaliNumber, formatBengaliDate } from './bengaliUtils';

const bengaliToEnglishMap: Record<string, string> = {
  '০': '0',
  '১': '1',
  '২': '2',
  '৩': '3',
  '৪': '4',
  '৫': '5',
  '৬': '6',
  '৭': '7',
  '৮': '8',
  '৯': '9',
};

/**
 * Normalizes a Bengali or mixed dosage string into numeric units.
 * Examples:
 *  "১টি" -> 1
 *  "২টি" -> 2
 *  "০.৫টি" -> 0.5
 *  "১/২" or "1/2" -> 0.5
 *  "৫ মিলি" -> 5
 *  "1 tablet" -> 1
 *  "২ চামচ" -> 2
 */
export function parseDosageUnits(dosageStr?: string): number {
  if (!dosageStr || !dosageStr.trim()) return 1;

  const trimmed = dosageStr.trim().toLowerCase();

  // Fraction recognition
  if (trimmed.includes('১/২') || trimmed.includes('1/2') || trimmed.includes('আধা')) {
    return 0.5;
  }
  if (trimmed.includes('১/৪') || trimmed.includes('1/4') || trimmed.includes('এক চতুর্থাংশ')) {
    return 0.25;
  }
  if (trimmed.includes('৩/৪') || trimmed.includes('3/4')) {
    return 0.75;
  }

  // Convert Bengali numerals to English numerals
  const normalized = trimmed.replace(/[০-৯]/g, (match) => bengaliToEnglishMap[match] || match);

  // Extract numeric digits with optional decimals
  const match = normalized.match(/(\d+(?:\.\d+)?)/);
  if (match) {
    const val = parseFloat(match[1]);
    if (!isNaN(val) && val > 0) {
      return val;
    }
  }

  // Safe fallback for single dose schedule
  return 1;
}

/**
 * Calculates total units consumed per day across all scheduled time slots.
 * Accepts either an array of DoseSchedule or a Medicine object.
 */
export function calculateDailyConsumption(input?: DoseSchedule[] | Medicine): number {
  if (!input) return 0;
  const schedules = Array.isArray(input) ? input : (input as Medicine).schedules;
  if (!schedules || !Array.isArray(schedules) || schedules.length === 0) return 0;
  return schedules.reduce((total, s) => {
    return total + parseDosageUnits(s.dosage);
  }, 0);
}

/**
 * Calculates Smart Stock Prediction for a single medicine record.
 * Evaluates stock, daily rate, remaining days, estimated run-out date, and status.
 */
export function predictMedicineStock(
  medicine: Medicine,
  referenceDate: Date = new Date()
): StockPrediction {
  const brandName = medicine.brandName || 'অজ্ঞাত ওষুধ';
  const unit = medicine.unit || 'টি';
  const currentStock = typeof medicine.stock === 'number' && !isNaN(medicine.stock) ? medicine.stock : 0;
  const schedulesCount = medicine.schedules?.length || 0;

  // Incalculable condition 1: Invalid or undefined stock
  if (medicine.stock === undefined || medicine.stock === null || isNaN(Number(medicine.stock))) {
    return {
      medicineId: medicine.id,
      brandName,
      genericName: medicine.genericName,
      type: medicine.type,
      strength: medicine.strength,
      currentStock: 0,
      unit,
      dailyDosageUnits: 0,
      daysRemaining: null,
      estimatedRunOutDate: null,
      estimatedRunOutDateStr: 'হিসাব করা যাচ্ছে না',
      status: 'incalculable',
      statusLabelBn: 'হিসাব করা যাচ্ছে না',
      adviceBn: 'সঠিক পূর্বাভাসের জন্য বর্তমান স্টক সংখ্যা যোগ বা সংশোধন করুন।',
      isLowOrUrgent: false,
      assignedPatientId: medicine.assignedPatientId,
      schedulesCount,
      calculationReasonBn: 'বর্তমান স্টকের সংখ্যা অসম্পূর্ণ বা অনুপস্থিত',
      medicine,
      dailyConsumptionRate: 0,
      runoutDate: null,
    };
  }

  // Incalculable condition 2: No schedules defined
  if (!medicine.schedules || medicine.schedules.length === 0) {
    return {
      medicineId: medicine.id,
      brandName,
      genericName: medicine.genericName,
      type: medicine.type,
      strength: medicine.strength,
      currentStock,
      unit,
      dailyDosageUnits: 0,
      daysRemaining: null,
      estimatedRunOutDate: null,
      estimatedRunOutDateStr: 'হিসাব করা যাচ্ছে না',
      status: 'incalculable',
      statusLabelBn: 'হিসাব করা যাচ্ছে না',
      adviceBn: 'সেবনের দৈনিক সময়সূচি যোগ করলে বাকি দিন হিসাব করা যাবে।',
      isLowOrUrgent: false,
      assignedPatientId: medicine.assignedPatientId,
      schedulesCount: 0,
      calculationReasonBn: 'দৈনিক সেবনের সময়সূচি ও ডোজ নির্ধারিত নেই',
      medicine,
      dailyConsumptionRate: 0,
      runoutDate: null,
    };
  }

  const dailyDosageUnits = calculateDailyConsumption(medicine.schedules);

  // Incalculable condition 3: Daily units parsed to 0
  if (dailyDosageUnits <= 0) {
    return {
      medicineId: medicine.id,
      brandName,
      genericName: medicine.genericName,
      type: medicine.type,
      strength: medicine.strength,
      currentStock,
      unit,
      dailyDosageUnits: 0,
      daysRemaining: null,
      estimatedRunOutDate: null,
      estimatedRunOutDateStr: 'হিসাব করা যাচ্ছে না',
      status: 'incalculable',
      statusLabelBn: 'হিসাব করা যাচ্ছে না',
      adviceBn: 'প্রতি ডোজে কত ইউনিট (যেমন: ১টি, ২টি) তা সময়সূচিতে নির্দিষ্ট করুন।',
      isLowOrUrgent: false,
      assignedPatientId: medicine.assignedPatientId,
      schedulesCount,
      calculationReasonBn: 'প্রতি ডোজের ইউনিট সংখ্যা শূন্য বা অনির্ধারিত',
      medicine,
      dailyConsumptionRate: 0,
      runoutDate: null,
    };
  }

  // Out of Stock condition
  if (currentStock <= 0) {
    return {
      medicineId: medicine.id,
      brandName,
      genericName: medicine.genericName,
      type: medicine.type,
      strength: medicine.strength,
      currentStock: 0,
      unit,
      dailyDosageUnits,
      daysRemaining: 0,
      estimatedRunOutDate: referenceDate,
      estimatedRunOutDateStr: 'স্টক শেষ (আজকের তারিখ)',
      status: 'out_of_stock',
      statusLabelBn: 'স্টক শেষ',
      adviceBn: 'ওষুধের মজুত সম্পূর্ণ শেষ। জরুরিভাবে নতুন ওষুধ সংগ্রহের কথা ভাবুন এবং স্টক আপডেট করুন।',
      isLowOrUrgent: true,
      assignedPatientId: medicine.assignedPatientId,
      schedulesCount,
      medicine,
      dailyConsumptionRate: dailyDosageUnits,
      runoutDate: referenceDate,
    };
  }

  // Standard Mathematical Calculation
  const exactDays = currentStock / dailyDosageUnits;
  const daysRemaining = Math.floor(exactDays);

  const runOutDate = new Date(referenceDate);
  runOutDate.setDate(runOutDate.getDate() + daysRemaining);
  const estimatedRunOutDateStr = formatBengaliDate(runOutDate);

  let status: StockPredictionStatus = 'safe';
  let statusLabelBn = 'পর্যাপ্ত স্টক';
  let adviceBn = 'পর্যাপ্ত স্টক রয়েছে। প্রেসক্রিপশন অনুযায়ী নিয়মিত ডোজ গ্রহণ করুন।';
  let isLowOrUrgent = false;

  if (daysRemaining <= 0) {
    status = 'out_of_stock';
    statusLabelBn = 'স্টক শেষ';
    adviceBn = 'ওষুধের মজুত শেষ হতে চলেছে। নতুন পাতা বা বোতল সংগ্রহের কথা ভাবুন।';
    isLowOrUrgent = true;
  } else if (daysRemaining <= 3) {
    status = 'urgent';
    statusLabelBn = 'জরুরি সতর্কতা (৩ দিন বা কম)';
    adviceBn = 'ওষুধ দ্রুত শেষ হতে চলেছে (৩ দিন বা কম বাকি)। অনতিবিলম্বে নতুন ওষুধ সংগ্রহের কথা ভাবুন।';
    isLowOrUrgent = true;
  } else if (daysRemaining <= 7) {
    status = 'low_stock';
    statusLabelBn = 'স্বল্প স্টক সতর্কতা (৭ দিন বা কম)';
    adviceBn = 'স্বল্প স্টক বাকি (৭ দিন বা কম)। আগামী কয়েক দিনের মধ্যে নতুন পাতা সংগ্রহের কথা ভাবুন।';
    isLowOrUrgent = true;
  } else {
    status = 'safe';
    statusLabelBn = 'পর্যাপ্ত স্টক (>৭ দিন)';
    adviceBn = 'স্টক পর্যাপ্ত রয়েছে। নির্ধারিত সময়ে নিয়মিত ডোজ গ্রহণ করুন।';
    isLowOrUrgent = false;
  }

  return {
    medicineId: medicine.id,
    brandName,
    genericName: medicine.genericName,
    type: medicine.type,
    strength: medicine.strength,
    currentStock,
    unit,
    dailyDosageUnits,
    daysRemaining,
    estimatedRunOutDate: runOutDate,
    estimatedRunOutDateStr,
    status,
    statusLabelBn,
    adviceBn,
    isLowOrUrgent,
    assignedPatientId: medicine.assignedPatientId,
    schedulesCount,
    medicine,
    dailyConsumptionRate: dailyDosageUnits,
    runoutDate: runOutDate,
  };
}

/**
 * Predicts stock for all personal medicines, optionally filtered by patient ID.
 * Orders results by urgency: Out of Stock -> Urgent -> Low Stock -> Incalculable -> Safe.
 */
export function predictAllMedicinesStock(
  medicines: Medicine[],
  patientId?: string | null,
  referenceDate: Date = new Date()
): StockPrediction[] {
  const filtered = medicines.filter((m) => {
    if (m.status !== 'active') return false;
    if (!patientId) return true;
    return !m.assignedPatientId || m.assignedPatientId === patientId;
  });

  const predictions = filtered.map((m) => predictMedicineStock(m, referenceDate));

  // Severity ranking for intuitive sorting
  const severityScore: Record<StockPredictionStatus, number> = {
    out_of_stock: 5,
    urgent: 4,
    low_stock: 3,
    incalculable: 2,
    safe: 1,
  };

  return predictions.sort((a, b) => {
    const diff = severityScore[b.status] - severityScore[a.status];
    if (diff !== 0) return diff;
    if (a.daysRemaining !== null && b.daysRemaining !== null) {
      return a.daysRemaining - b.daysRemaining;
    }
    return a.brandName.localeCompare(b.brandName);
  });
}

/**
 * Notification cooldown tracking key in localStorage
 */
const STORAGE_KEY_SENT_ALERTS = 'shasthobondhu_stock_alerts_sent_v1';
const ALERT_COOLDOWN_HOURS = 24;

interface SentAlertRecord {
  medicineId: string;
  status: StockPredictionStatus;
  sentAt: string; // ISO string
}

/**
 * Retrieves past alerts sent to prevent duplicate notifications
 */
function getSentAlerts(): Record<string, SentAlertRecord> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_SENT_ALERTS);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

/**
 * Records that an alert was dispatched to prevent repeat spam
 */
export function markStockAlertSent(medicineId: string, status: StockPredictionStatus): void {
  try {
    const alerts = getSentAlerts();
    const key = `${medicineId}_${status}`;
    alerts[key] = {
      medicineId,
      status,
      sentAt: new Date().toISOString(),
    };
    localStorage.setItem(STORAGE_KEY_SENT_ALERTS, JSON.stringify(alerts));
  } catch (e) {
    console.warn('Could not record sent alert:', e);
  }
}

/**
 * Filters predictions to identify those eligible for notification without duplicates
 */
export function getNewEligibleAlerts(predictions: StockPrediction[]): StockPrediction[] {
  const sentMap = getSentAlerts();
  const now = Date.now();
  const cooldownMs = ALERT_COOLDOWN_HOURS * 60 * 60 * 1000;

  return predictions.filter((pred) => {
    if (pred.status !== 'out_of_stock' && pred.status !== 'urgent' && pred.status !== 'low_stock') {
      return false;
    }

    const key = `${pred.medicineId}_${pred.status}`;
    const past = sentMap[key];

    if (!past) return true;

    const pastTime = new Date(past.sentAt).getTime();
    if (isNaN(pastTime)) return true;

    return now - pastTime > cooldownMs;
  });
}

/**
 * Inspects browser notification capabilities.
 * Honest reporting: If running inside an iframe or background workers are not permitted,
 * clearly clarifies that in-app notification is active rather than pretending background works.
 */
export function getNotificationSupportInfo(): {
  isBrowserNotificationSupported: boolean;
  permission: NotificationPermission | 'unsupported';
  isBackgroundReliable: boolean;
  channelDescriptionBn: string;
} {
  const isSupported = typeof window !== 'undefined' && 'Notification' in window;
  const permission: NotificationPermission | 'unsupported' = isSupported
    ? Notification.permission
    : 'unsupported';

  // Inside sandboxed iframes or browsers without background sync, background push is restricted
  const isIframe = typeof window !== 'undefined' && window.self !== window.top;
  const isBackgroundReliable = isSupported && permission === 'granted' && !isIframe;

  let channelDescriptionBn = 'ইন-অ্যাপ অডিও ও ভিজ্যুয়াল অ্যালার্ট সক্রিয় রয়েছে।';
  if (isBackgroundReliable) {
    channelDescriptionBn = 'ব্রাউজার সিস্টেম নোটিফিকেশন ও ইন-অ্যাপ অ্যালার্ট উভয়ই সক্রিয়।';
  } else if (permission === 'denied') {
    channelDescriptionBn = 'ব্রাউজার নোটিফিকেশন ব্লক করা আছে; অ্যাপে ইন-অ্যাপ ব্যানার ও টোস্ট অ্যালার্ট নির্ভরযোগ্যভাবে দেখানো হচ্ছে।';
  } else if (isIframe) {
    channelDescriptionBn = 'সুরক্ষিত আইফ্রেম পরিবেশের কারণে ব্যাকগ্রাউন্ড পুশ সীমাবদ্ধ; অ্যাপের ইন-অ্যাপ অ্যালার্ট নির্ভরযোগ্যভাবে সচল রয়েছে।';
  }

  return {
    isBrowserNotificationSupported: isSupported,
    permission,
    isBackgroundReliable,
    channelDescriptionBn,
  };
}
