const normaliseStringList = (values) => {
  if (!Array.isArray(values)) {
    return [];
  }

  const seen = new Set();
  const result = [];

  values.forEach((value) => {
    if (typeof value !== 'string') {
      return;
    }
    const trimmed = value.trim();
    if (!trimmed) {
      return;
    }
    const key = trimmed.toLowerCase();
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    result.push(trimmed);
  });

  return result;
};

const resolveKeywordConfig = ({ title, eNumber, synonyms, searchKeywords, searchFilter }) => {
  const excludedKeywords = normaliseStringList(searchFilter);
  const excludedSet = new Set(excludedKeywords.map((keyword) => keyword.toLowerCase()));

  const supplementaryKeywords = normaliseStringList(searchKeywords);
  const supplementarySet = new Set(supplementaryKeywords.map((keyword) => keyword.toLowerCase()));

  const result = new Map();

  const addKeyword = (value) => {
    if (typeof value !== 'string') {
      return;
    }

    const trimmed = value.trim();
    if (!trimmed) {
      return;
    }

    const normalised = trimmed.toLowerCase();
    if (!normalised || excludedSet.has(normalised) || result.has(normalised)) {
      return;
    }

    result.set(normalised, trimmed);
  };

  addKeyword(title);
  addKeyword(eNumber);

  if (Array.isArray(synonyms)) {
    synonyms.forEach(addKeyword);
  }

  supplementaryKeywords.forEach(addKeyword);

  const includedKeywords = Array.from(result.values());

  const supplementaryIncluded = includedKeywords.filter((keyword) =>
    supplementarySet.has(keyword.toLowerCase()),
  );

  return {
    included: includedKeywords,
    supplementary: supplementaryIncluded,
    excluded: excludedKeywords,
  };
};

const toKeywordList = (props) => {
  const config = resolveKeywordConfig(props || {});
  return config.included;
};

module.exports = {
  toKeywordList,
  resolveKeywordConfig,
};
