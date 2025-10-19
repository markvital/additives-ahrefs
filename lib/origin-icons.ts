import type { StaticImageData } from 'next/image';

import animalIcon from '../img/origins/animal-icon.png';
import artificialIcon from '../img/origins/artificial-icon.png';
import microbiologicalIcon from '../img/origins/microbiological-icon.png';
import mineralIcon from '../img/origins/mineral-icon.png';
import plantIcon from '../img/origins/plant-icon.png';
import syntheticIcon from '../img/origins/synthetic-icon.png';

const ORIGIN_ICON_MAP: Record<string, StaticImageData> = {
  animal: animalIcon,
  artificial: artificialIcon,
  microbiological: microbiologicalIcon,
  mineral: mineralIcon,
  plant: plantIcon,
  synthetic: syntheticIcon,
};

export const getOriginIcon = (value: string): StaticImageData | null => {
  const normalized = value.trim().toLowerCase();

  if (!normalized) {
    return null;
  }

  return ORIGIN_ICON_MAP[normalized] ?? null;
};

export const getOriginAbbreviation = (value: string): string => {
  const letters = value.replace(/[^A-Za-z]/g, '');

  if (!letters) {
    return '';
  }

  const first = letters.charAt(0).toUpperCase();
  const second = letters.charAt(1);

  return `${first}${second ? second.toLowerCase() : ''}`;
};
