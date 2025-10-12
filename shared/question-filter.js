const removeDiacritics = (value) =>
  value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '');

const canonicalize = (value) => {
  if (typeof value !== 'string') {
    return '';
  }

  return removeDiacritics(value)
    .toLowerCase()
    .replace(/[?？]+$/g, '')
    .replace(/[’'`]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
};

const sanitizeToken = (value) =>
  canonicalize(value)
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const BUY_PATTERN =
  /(\bwhere\s+(?:(?:can|do|to)\s+)?(?:i|you|u|one)?\s*(?:buy|get|purchase|find|order)\b|\bwhere\s+(?:buy|get|purchase|find|order)\b)/i;

const shouldExcludeQuestion = (question, options = {}) => {
  const { keywords = [] } = options;

  if (typeof question !== 'string') {
    return true;
  }

  const rawLower = question.toLowerCase();
  if (BUY_PATTERN.test(rawLower)) {
    return true;
  }

  const canonicalQuestion = canonicalize(question);
  if (!canonicalQuestion) {
    return true;
  }

  const whatMatch = canonicalQuestion.match(/^(what is|whats|what are|whatre)\s+(.*)$/);

  if (whatMatch) {
    const remainder = whatMatch[2];
    const remainderToken = sanitizeToken(remainder);
    if (!remainderToken) {
      return true;
    }

    const keywordTokens = new Set(
      (Array.isArray(keywords) ? keywords : [])
        .map((value) => sanitizeToken(value))
        .filter((value) => value.length > 0),
    );

    if (keywordTokens.has(remainderToken)) {
      return true;
    }
  }

  return false;
};

module.exports = {
  shouldExcludeQuestion,
};
