export const formatMonthlyVolume = (value: number): string => {
  if (!Number.isFinite(value)) {
    return '';
  }

  if (value >= 1_000_000) {
    return `${Math.round(value / 100_000) / 10}M`;
  }

  if (value >= 1_000) {
    return `${Math.round(value / 100) / 10}K`;
  }

  return `${Math.round(value)}`;
};

const COUNTRY_NAME_MAP: Record<string, string> = {
  US: 'U.S.',
};

const getCountryDisplayName = (countryCode: string): string | null => {
  const code = countryCode.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) {
    return null;
  }

  if (COUNTRY_NAME_MAP[code]) {
    return COUNTRY_NAME_MAP[code];
  }

  if (typeof Intl !== 'undefined' && typeof Intl.DisplayNames !== 'undefined') {
    const displayNames = new Intl.DisplayNames(['en'], { type: 'region' });
    const name = displayNames.of(code);
    if (name) {
      return name;
    }
  }

  return code;
};

export const getCountryFlagEmoji = (countryCode: string): string | null => {
  const code = countryCode.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) {
    return null;
  }

  const codePoints = Array.from(code).map((char) => 0x1f1e6 + char.charCodeAt(0) - 65);
  return String.fromCodePoint(...codePoints);
};

export const getCountryLabel = (countryCode: string): string | null => getCountryDisplayName(countryCode);
