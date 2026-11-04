import {
  parseDosageUnits,
  calculateDailyConsumption,
  predictMedicineStock,
  predictAllMedicinesStock,
  getNewEligibleAlerts,
  markStockAlertSent,
} from '../src/utils/stockPredictor';
import { Medicine } from '../src/types';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    process.exit(1);
  }
  console.log(`✅ PASS: ${message}`);
}

console.log('--- TEST 1: Dosage Parsing ---');
assert(parseDosageUnits('1') === 1, 'Parse "1" = 1');
assert(parseDosageUnits('১ টি') === 1, 'Parse "১ টি" = 1');
assert(parseDosageUnits('২') === 2, 'Parse "২" = 2');
assert(parseDosageUnits('1/2') === 0.5, 'Parse "1/2" = 0.5');
assert(parseDosageUnits('১/২') === 0.5, 'Parse "১/২" = 0.5');
assert(parseDosageUnits('০.৫') === 0.5, 'Parse "০.৫" = 0.5');
assert(parseDosageUnits('1.5 চামচ') === 1.5, 'Parse "1.5 চামচ" = 1.5');

console.log('\n--- TEST 2: Daily Consumption Calculation ---');
const dummyMed1: Medicine = {
  id: 'med-1',
  brandName: 'Napa Extra',
  genericName: 'Paracetamol + Caffeine',
  strength: '500mg+65mg',
  type: 'ট্যাবলেট',
  colorTag: 'teal',
  schedules: [
    { id: 'sch-1', timeSlot: 'সকাল', time: '08:00', dosage: '১' },
    { id: 'sch-2', timeSlot: 'রাত', time: '21:00', dosage: '১' },
  ],
  mealTiming: 'খাওয়ার পরে',
  stock: 20,
  minStockAlert: 5,
  unit: 'টি',
  startDate: '2026-11-01',
  durationDays: 30,
  isChronic: true,
  status: 'active',
};

const dailyRate1 = calculateDailyConsumption(dummyMed1);
assert(dailyRate1 === 2, `dummyMed1 daily consumption should be 2, got ${dailyRate1}`);

console.log('\n--- TEST 3: Stock Prediction Categories ---');
// 20 units with 2/day = 10 days -> safe
const pred1 = predictMedicineStock(dummyMed1);
assert(pred1.daysRemaining === 10, `pred1 daysRemaining should be 10, got ${pred1.daysRemaining}`);
assert(pred1.status === 'safe', `pred1 status should be safe, got ${pred1.status}`);

// 6 units with 2/day = 3 days -> urgent
const urgentMed: Medicine = { ...dummyMed1, id: 'med-urgent', stock: 6 };
const predUrgent = predictMedicineStock(urgentMed);
assert(predUrgent.daysRemaining === 3, `predUrgent daysRemaining should be 3, got ${predUrgent.daysRemaining}`);
assert(predUrgent.status === 'urgent', `predUrgent status should be urgent, got ${predUrgent.status}`);

// 10 units with 2/day = 5 days -> low_stock (<= 7 days)
const lowMed: Medicine = { ...dummyMed1, id: 'med-low', stock: 10 };
const predLow = predictMedicineStock(lowMed);
assert(predLow.daysRemaining === 5, `predLow daysRemaining should be 5, got ${predLow.daysRemaining}`);
assert(predLow.status === 'low_stock', `predLow status should be low_stock, got ${predLow.status}`);

// 0 units -> out_of_stock
const zeroMed: Medicine = { ...dummyMed1, id: 'med-zero', stock: 0 };
const predZero = predictMedicineStock(zeroMed);
assert(predZero.daysRemaining === 0, `predZero daysRemaining should be 0, got ${predZero.daysRemaining}`);
assert(predZero.status === 'out_of_stock', `predZero status should be out_of_stock, got ${predZero.status}`);

// No schedules / 0 daily rate -> incalculable
const noScheduleMed: Medicine = { ...dummyMed1, id: 'med-no-sch', schedules: [] };
const predNoSch = predictMedicineStock(noScheduleMed);
assert(predNoSch.daysRemaining === null, 'noScheduleMed daysRemaining should be null');
assert(predNoSch.status === 'incalculable', `noScheduleMed status should be incalculable, got ${predNoSch.status}`);

console.log('\n--- TEST 4: Multiple Medicines Priority Sorting ---');
const allMeds = [dummyMed1, urgentMed, zeroMed, lowMed];
const sortedPreds = predictAllMedicinesStock(allMeds);
assert(sortedPreds[0].status === 'out_of_stock', `First sorted should be out_of_stock, got ${sortedPreds[0].status}`);
assert(sortedPreds[1].status === 'urgent', `Second sorted should be urgent, got ${sortedPreds[1].status}`);
assert(sortedPreds[2].status === 'low_stock', `Third sorted should be low_stock, got ${sortedPreds[2].status}`);
assert(sortedPreds[3].status === 'safe', `Fourth sorted should be safe, got ${sortedPreds[3].status}`);

console.log('\n--- TEST 5: Stock Adjustment Audit Structure ---');
const testMed: Medicine = { ...dummyMed1, stock: 20, stockAdjustments: [] };
const reason = 'নতুন ওষুধ ক্রয় / রিফিল';
const notes = 'ফার্মেসি থেকে ১ পাতা ক্রয়';
const prevStock = testMed.stock;
const nextStock = 30;

const adjustment = {
  id: 'adj-1',
  previousStock: prevStock,
  newStock: nextStock,
  reason,
  timestamp: new Date().toISOString(),
  notes,
};

testMed.stock = nextStock;
testMed.stockAdjustments = [adjustment];

assert(testMed.stock === 30, 'Stock updated to 30');
assert(testMed.stockAdjustments.length === 1, 'Adjustment recorded');
assert(testMed.stockAdjustments[0].previousStock === 20, 'Previous stock is 20');
assert(testMed.stockAdjustments[0].reason === reason, 'Reason recorded correctly');

console.log('\n--- ALL UNIT TESTS COMPLETED SUCCESSFULLY! ---');
