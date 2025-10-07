const FDC_SEARCH_BASE_URL = 'https://fdc.nal.usda.gov/food-search';

const normalizeToken = (token: string): string =>
  token
    .replace(/[^0-9A-Za-z]+/g, ' ')
    .trim();

const createAndQuery = (value: string): string => {
  const tokens = value
    .trim()
    .split(/[\s/-]+/)
    .map((token) => normalizeToken(token))
    .filter(Boolean)
    .flatMap((token) => token.split(/\s+/))
    .filter(Boolean);

  if (tokens.length === 0) {
    return value.trim();
  }

  if (tokens.length === 1) {
    return tokens[0];
  }

  return tokens.join(' AND ');
};

const encodeQuery = (query: string): string => encodeURIComponent(query.trim());

export const buildFdcProductSearchQuery = (value: string): string => createAndQuery(value);

export const getFdcProductSearchUrl = (query: string): string => {
  const formattedQuery = buildFdcProductSearchQuery(query);
  const encodedQuery = encodeQuery(formattedQuery);
  return `${FDC_SEARCH_BASE_URL}?type=Branded&query=&ingredients=${encodedQuery}`;
};
