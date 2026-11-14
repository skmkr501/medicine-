import { toBengaliNumber } from './bengaliUtils';
import {
  ShoppingListResult,
  calculateShoppingCostSummary,
  formatQuantityBn,
  formatTakaBn,
} from './shoppingListCalculator';

export interface ShoppingListShareOptions {
  result: ShoppingListResult;
  doctorName?: string;
  notes?: string;
  excludedMedicineIds?: Set<string> | string[];
}

/**
 * Formats the complete medicine shopping list into clean plain Bengali text
 * ready for WhatsApp sharing via https://wa.me/?text=...
 */
export function buildShoppingListShareText(
  options: ShoppingListShareOptions
): string {
  const { result, doctorName, notes, excludedMedicineIds } = options;
  const excludedSet =
    excludedMedicineIds instanceof Set
      ? excludedMedicineIds
      : Array.isArray(excludedMedicineIds)
      ? new Set(excludedMedicineIds)
      : new Set<string>();

  const activeToBuyItems = result.toBuyItems.filter(
    (item) => !excludedSet.has(item.medicine.id)
  );
  const costSummary = calculateShoppingCostSummary(result.toBuyItems, excludedSet);

  const lines: string[] = [];

  lines.push('স্বাস্থ্যবন্ধু — ওষুধ কেনার তালিকা');
  lines.push(
    `রোগী: ${result.patientLabelBn}${
      result.patientAge !== undefined
        ? ` (বয়স: ${toBengaliNumber(result.patientAge)} বছর)`
        : ''
    }`
  );
  if (doctorName?.trim()) {
    lines.push(`ডাক্তারের নাম: ${doctorName.trim()}`);
  }
  lines.push(`তালিকা তৈরির তারিখ: ${result.startDateBn}`);
  lines.push(
    `কত তারিখ পর্যন্ত: ${result.targetDateBn} (${toBengaliNumber(result.daysCount)} দিনের জন্য${
      result.bufferDays > 0
        ? ` + ${toBengaliNumber(result.bufferDays)} দিনের বাফার`
        : ''
    })`
  );

  lines.push('');
  lines.push(
    `সারসংক্ষেপ: ${toBengaliNumber(result.totalActiveMedicinesConsidered)}টি ওষুধের মধ্যে ${toBengaliNumber(
      activeToBuyItems.length
    )}টি কিনতে হবে${
      costSummary.excludedCount > 0
        ? ` (${toBengaliNumber(costSummary.excludedCount)}টি বাদ দেওয়া হয়েছে)`
        : ''
    }`
  );
  lines.push(`আনুমানিক মোট খরচ ${formatTakaBn(costSummary.totalEstimatedCost)}`);
  if (costSummary.missingPriceCount > 0) {
    lines.push(
      `${toBengaliNumber(costSummary.missingPriceCount)} টির দাম নেই, মোটে ধরা হয়নি`
    );
  }

  if (activeToBuyItems.length > 0) {
    lines.push('');
    lines.push('কিনতে হবে:');
    activeToBuyItems.forEach((item, idx) => {
      const med = item.medicine;
      const title = `${med.brandName}${med.strength ? ` (${med.strength})` : ''}${
        med.genericName ? ` - ${med.genericName}` : ''
      }`;
      const patientSuffix =
        result.patientLabelBn === 'সবার জন্য' && item.patientName !== 'সাধারণ'
          ? ` [${item.patientName}]`
          : '';
      const buyAmount =
        item.toBuyUnits > 0
          ? `${toBengaliNumber(item.toBuyUnits)} ${item.unit}${
              item.packSummaryBn ? ` (${item.packSummaryBn})` : ''
            }`
          : 'নতুন প্যাকেট কিনুন';

      lines.push(`${toBengaliNumber(idx + 1)}. ${title}${patientSuffix}`);
      lines.push(
        `   দৈনিক ব্যবহার: ${formatQuantityBn(item.dailyUsage)} ${item.unit} | বর্তমান মজুদ: ${formatQuantityBn(
          item.currentStock
        )} ${item.unit} (চলবে ${toBengaliNumber(item.daysRemaining)} দিন)`
      );
      lines.push(`   কিনতে হবে: ${buyAmount}`);
      if (item.unitPrice !== null) {
        const pricePart = `একক দাম: ${formatTakaBn(item.unitPrice)}/${item.unit}`;
        const totalPart =
          item.estimatedCost !== null ? ` | এতে খরচ ${formatTakaBn(item.estimatedCost)}` : '';
        lines.push(`   ${pricePart}${totalPart}`);
      } else {
        lines.push('   দাম নেই (মোটে ধরা হয়নি)');
      }
      if (item.expiryWarningBn) {
        lines.push(`   সতর্কতা: ${item.expiryWarningBn}`);
      }
    });
  }

  if (result.sufficientItems.length > 0) {
    lines.push('');
    lines.push(`পর্যাপ্ত আছে ✓ (${toBengaliNumber(result.sufficientItems.length)}টি):`);
    result.sufficientItems.forEach((item) => {
      lines.push(
        `- ${item.medicine.brandName}${
          item.medicine.genericName ? ` (${item.medicine.genericName})` : ''
        }: মজুদ ${formatQuantityBn(item.currentStock)} ${item.unit} (${toBengaliNumber(
          item.daysRemaining
        )} দিন চলবে) — পর্যাপ্ত আছে ✓`
      );
    });
  }

  if (result.asNeededItems.length > 0) {
    lines.push('');
    lines.push(`প্রয়োজনমতো ওষুধ (${toBengaliNumber(result.asNeededItems.length)}টি):`);
    result.asNeededItems.forEach((item) => {
      lines.push(
        `- ${item.medicine.brandName}: মজুদ ${formatQuantityBn(item.currentStock)} ${
          item.unit
        } — নিজে হিসাব করুন${item.expiryWarningBn ? ` (${item.expiryWarningBn})` : ''}`
      );
    });
  }

  if (notes?.trim()) {
    lines.push('');
    lines.push(`নোট: ${notes.trim()}`);
  }

  lines.push('');
  lines.push('দাম আনুমানিক, দোকানভেদে বদলাতে পারে।');
  lines.push('এটি অ্যাপের হিসাব; ওষুধ বদলানোর আগে ডাক্তারের পরামর্শ নিন।');

  return lines.join('\n');
}

export function buildShoppingListWhatsAppUrl(
  options: ShoppingListShareOptions
): string {
  const text = buildShoppingListShareText(options);
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}
