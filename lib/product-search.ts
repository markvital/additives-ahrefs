const FDC_SEARCH_BASE_URL = 'https://fdc.nal.usda.gov/food-search';

const createAndQuery = (value: string): string => {
  const tokens = value
    .trim()
    .split(/[\s-]+/)
    .map((token) => token.trim())
    .filter(Boolean);

  if (tokens.length <= 1) {
    return value.trim();
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
