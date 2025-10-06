const FDC_SEARCH_BASE_URL = 'https://fdc.nal.usda.gov/food-search';

const encodeQuery = (query: string): string => encodeURIComponent(query.trim());

export const getFdcProductSearchUrl = (query: string): string => {
  const encodedQuery = encodeQuery(query);
  return `${FDC_SEARCH_BASE_URL}?type=Branded&query=&ingredients=${encodedQuery}`;
};
