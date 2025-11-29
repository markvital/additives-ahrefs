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
