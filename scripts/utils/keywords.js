const toKeywordList = ({ title, eNumber, synonyms }) => {
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
    if (normalised && !result.has(normalised)) {
      result.set(normalised, trimmed);
    }
  };

  addKeyword(title);
  addKeyword(eNumber);

  if (Array.isArray(synonyms)) {
    synonyms.forEach(addKeyword);
  }

  return Array.from(result.values());
};

module.exports = {
  toKeywordList,
};
