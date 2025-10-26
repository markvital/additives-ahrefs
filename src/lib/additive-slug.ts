const stripDiacritics = (value: string): string =>
  value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '');

const slugifySegment = (value: string | undefined | null): string => {
  if (!value) {
    return '';
  }

  const stripped = stripDiacritics(value);

  return stripped
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
};

const normaliseENumber = (value: string | undefined | null): string => {
  if (!value) {
    return '';
  }

  const compact = value.replace(/[^a-z0-9]+/gi, '').toLowerCase();
  if (!compact) {
    return '';
  }

  if (compact.startsWith('e')) {
    return compact;
  }

  return `e${compact}`;
};

export interface SlugSource {
  eNumber?: string | null;
  title?: string | null;
}

export const createAdditiveSlug = ({ eNumber, title }: SlugSource): string => {
  const eNumberSegment = normaliseENumber(eNumber);
  const titleSegment = slugifySegment(title);

  if (eNumberSegment && titleSegment) {
    return `${eNumberSegment}-${titleSegment}`;
  }

  if (eNumberSegment) {
    return eNumberSegment;
  }

  if (titleSegment) {
    return titleSegment;
  }

  throw new Error('Unable to derive slug without eNumber or title');
};

export const slugifyTitle = (title: string): string => slugifySegment(title);
