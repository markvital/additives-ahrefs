import type { StaticImageData } from 'next/image';

import animalIcon from '../img/origins/animal-icon.png';
import artificialIcon from '../img/origins/artificial-icon.png';
import microbiologicalIcon from '../img/origins/microbiological-icon.png';
import mineralIcon from '../img/origins/mineral-icon.png';
import plantIcon from '../img/origins/plant-icon.png';
import syntheticIcon from '../img/origins/synthetic-icon.png';
import animalPrev2xIcon from '../img/origins/prev2x/animal.png';
import artificialPrev2xIcon from '../img/origins/prev2x/artificial.png';
import microbiologicalPrev2xIcon from '../img/origins/prev2x/microbiological.png';
import mineralPrev2xIcon from '../img/origins/prev2x/mineral.png';
import plantPrev2xIcon from '../img/origins/prev2x/plant.png';
import syntheticPrev2xIcon from '../img/origins/prev2x/synthetic.png';

const ORIGIN_ICON_MAP: Record<string, StaticImageData> = {
  animal: animalIcon,
  artificial: artificialIcon,
  microbiological: microbiologicalIcon,
  mineral: mineralIcon,
  plant: plantIcon,
  synthetic: syntheticIcon,
};

const ORIGIN_PREV2X_ICON_MAP: Record<string, StaticImageData> = {
  animal: animalPrev2xIcon,
  artificial: artificialPrev2xIcon,
  microbiological: microbiologicalPrev2xIcon,
  mineral: mineralPrev2xIcon,
  plant: plantPrev2xIcon,
  synthetic: syntheticPrev2xIcon,
};

export const getOriginIcon = (value: string): StaticImageData | null => {
  const normalized = value.trim().toLowerCase();

  if (!normalized) {
    return null;
  }

  return ORIGIN_ICON_MAP[normalized] ?? null;
};

export const getOriginHeroIcon = (value: string): StaticImageData | null => {
  const normalized = value.trim().toLowerCase();

  if (!normalized) {
    return null;
  }

  return ORIGIN_PREV2X_ICON_MAP[normalized] ?? null;
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
