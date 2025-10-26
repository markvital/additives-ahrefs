const stripDiacritics = (value) =>
  value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '');

const slugifySegment = (value) => {
  if (!value) {
    return '';
  }

  const stripped = stripDiacritics(String(value));

  return stripped
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
};

const normaliseENumber = (value) => {
  if (!value) {
    return '';
  }

  const compact = String(value)
    .replace(/[^a-z0-9]+/gi, '')
    .toLowerCase();

  if (!compact) {
    return '';
  }

  if (compact.startsWith('e')) {
    return compact;
  }

  return `e${compact}`;
};

const createAdditiveSlug = ({ eNumber, title }) => {
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

module.exports = {
  createAdditiveSlug,
  slugifySegment,
  normaliseENumber,
};
