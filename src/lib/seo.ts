const DEFAULT_TITLE_MAX = 60;
const DEFAULT_DESCRIPTION_MAX = 160;
const ELLIPSIS = '...';

const trimWithWordBoundary = (value: string, maxLength: number): string => {
  const normalized = value.trim();

  if (normalized.length <= maxLength) {
    return normalized;
  }

  if (maxLength <= ELLIPSIS.length) {
    return normalized.slice(0, maxLength);
  }

  const cutoff = maxLength - ELLIPSIS.length;
  const boundaryIndex = normalized.lastIndexOf(' ', cutoff);
  const safeCut = boundaryIndex >= Math.max(0, cutoff - 15) ? boundaryIndex : cutoff;
  const trimmed = normalized.slice(0, safeCut).trimEnd();

  return `${trimmed}${ELLIPSIS}`;
};

export const trimTitle = (value: string, maxLength: number = DEFAULT_TITLE_MAX): string =>
  trimWithWordBoundary(value, maxLength);

export const trimDescription = (value: string, maxLength: number = DEFAULT_DESCRIPTION_MAX): string =>
  trimWithWordBoundary(value, maxLength);

export const trimComparisonTitle = (
  firstName: string,
  secondName: string,
  maxLength: number = DEFAULT_TITLE_MAX,
): string => {
  const prefix = 'Compare ';
  const separator = ' vs ';
  const available = Math.max(0, maxLength - prefix.length - separator.length);
  const firstTrimmed = trimTitle(firstName, Math.ceil(available / 2));
  const remaining = Math.max(0, available - firstTrimmed.length);
  const secondTrimmed = trimTitle(secondName, remaining);
  const composed = `${prefix}${firstTrimmed}${separator}${secondTrimmed}`;

  return trimTitle(composed, maxLength);
};

export const trimComparisonDescription = (
  firstName: string,
  secondName: string,
  maxLength: number = DEFAULT_DESCRIPTION_MAX,
): string => {
  const prefix = 'Side-by-side comparison of ';
  const separator = ' and ';
  const suffix =
    ', including synonyms, origin, search interest, and article highlights.';
  const available = Math.max(0, maxLength - prefix.length - separator.length - suffix.length);
  const firstTrimmed = trimDescription(firstName, Math.ceil(available / 2));
  const remaining = Math.max(0, available - firstTrimmed.length);
  const secondTrimmed = trimDescription(secondName, remaining);
  const composed = `${prefix}${firstTrimmed}${separator}${secondTrimmed}${suffix}`;

  return trimDescription(composed, maxLength);
};
