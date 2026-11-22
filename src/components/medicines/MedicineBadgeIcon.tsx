import React from 'react';
import {
  CircleDot,
  Droplets,
  FlaskConical,
  Package,
  Pill,
  Sparkles,
  Syringe,
  Tablet,
  Wind,
} from 'lucide-react';
import { MedicineIconTag, MedicineType } from '../../types';
import {
  resolveMedicineColorStyle,
  resolveMedicineIconOption,
  resolveMedicineIconTag,
} from '../../utils/medicineAppearance';

interface MedicineBadgeIconProps {
  iconTag?: MedicineIconTag | null;
  type?: MedicineType | string;
  colorTag?: string | null;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  className?: string;
}

function renderIconSvg(tag: MedicineIconTag, iconClass: string) {
  switch (tag) {
    case 'ক্যাপসুল':
      return <Pill className={iconClass} aria-hidden="true" />;
    case 'সিরাপ':
      return <FlaskConical className={iconClass} aria-hidden="true" />;
    case 'ইনজেকশন':
      return <Syringe className={iconClass} aria-hidden="true" />;
    case 'ড্রপ':
      return <Droplets className={iconClass} aria-hidden="true" />;
    case 'ইনহেলার':
      return <Wind className={iconClass} aria-hidden="true" />;
    case 'ক্রিম/মলম':
      return <Sparkles className={iconClass} aria-hidden="true" />;
    case 'সাপোজিটরি':
      return <CircleDot className={iconClass} aria-hidden="true" />;
    case 'স্যাশে':
      return <Package className={iconClass} aria-hidden="true" />;
    case 'ট্যাবলেট':
    default:
      return <Tablet className={iconClass} aria-hidden="true" />;
  }
}

export const MedicineBadgeIcon: React.FC<MedicineBadgeIconProps> = ({
  iconTag,
  type,
  colorTag,
  size = 'md',
  showLabel = false,
  className = '',
}) => {
  const resolvedTag = resolveMedicineIconTag(iconTag, type);
  const iconOption = resolveMedicineIconOption(iconTag, type);
  const colorStyle = resolveMedicineColorStyle(colorTag);

  const boxSizeClass =
    size === 'xs'
      ? 'w-5 h-5 rounded-md'
      : size === 'sm'
      ? 'w-7 h-7 rounded-lg'
      : size === 'lg'
      ? 'w-11 h-11 rounded-2xl'
      : 'w-9 h-9 rounded-xl';

  const iconSizeClass =
    size === 'xs'
      ? 'w-3 h-3'
      : size === 'sm'
      ? 'w-3.5 h-3.5'
      : size === 'lg'
      ? 'w-5 h-5'
      : 'w-4 h-4';

  if (showLabel) {
    return (
      <span
        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg border text-xs font-bold ${colorStyle.badgeClass} ${className}`}
        title={`${iconOption.labelBn} (${colorStyle.labelBn})`}
      >
        {renderIconSvg(resolvedTag, iconSizeClass)}
        <span>{iconOption.labelBn}</span>
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center justify-center shrink-0 border ${boxSizeClass} ${colorStyle.badgeClass} ${className}`}
      title={`${iconOption.labelBn} (${colorStyle.labelBn})`}
      aria-label={`${iconOption.labelBn}, রঙ: ${colorStyle.labelBn}`}
    >
      {renderIconSvg(resolvedTag, iconSizeClass)}
    </span>
  );
};
