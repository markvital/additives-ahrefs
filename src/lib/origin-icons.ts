const ORIGIN_ICON_MAP: Record<string, string> = {
  animal: '/img/origin/animal-icon.png',
  artificial: '/img/origin/artificial-icon.png',
  microbiological: '/img/origin/microbiological-icon.png',
  mineral: '/img/origin/mineral-icon.png',
  plant: '/img/origin/plant-icon.png',
  synthetic: '/img/origin/synthetic-icon.png',
};

const ORIGIN_PREV2X_ICON_MAP: Record<string, string> = {
  animal: '/img/origin/prev2x/animal.png',
  artificial: '/img/origin/prev2x/artificial.png',
  microbiological: '/img/origin/prev2x/microbiological.png',
  mineral: '/img/origin/prev2x/mineral.png',
  plant: '/img/origin/prev2x/plant.png',
  synthetic: '/img/origin/prev2x/synthetic.png',
};

export const getOriginIcon = (value: string): string | null => {
  const normalized = value.trim().toLowerCase();

  if (!normalized) {
    return null;
  }

  return ORIGIN_ICON_MAP[normalized] ?? null;
};

export const getOriginHeroIcon = (value: string): string | null => {
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
