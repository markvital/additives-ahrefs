const normaliseKeyword = (value) => {
  if (typeof value !== 'string') {
    return '';
  }

  return value
    .replace(/\s+/g, ' ')
    .trim();
};

const collectUniqueKeywords = (values) => {
  const unique = new Map();

  values.forEach((value) => {
    const cleaned = normaliseKeyword(value);
    if (!cleaned) {
      return;
    }

    const key = cleaned.toLowerCase();
    if (!unique.has(key)) {
      unique.set(key, cleaned);
    }
  });

  return Array.from(unique.values());
};

const collectAdditiveKeywords = (additive, props = {}) => {
  const sourceValues = [];

  if (props && typeof props.title === 'string') {
    sourceValues.push(props.title);
  }
  if (props && typeof props.eNumber === 'string') {
    sourceValues.push(props.eNumber);
  }
  if (props && Array.isArray(props.synonyms)) {
    sourceValues.push(...props.synonyms);
  }

  if (additive && typeof additive.title === 'string') {
    sourceValues.push(additive.title);
  }
  if (additive && typeof additive.eNumber === 'string') {
    sourceValues.push(additive.eNumber);
  }

  return collectUniqueKeywords(sourceValues);
};

module.exports = {
  collectAdditiveKeywords,
  collectUniqueKeywords,
  normaliseKeyword,
};
