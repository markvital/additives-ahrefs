const FDC_SEARCH_BASE_URL = 'https://fdc.nal.usda.gov/food-search?type=Branded&query=&ingredients=';

export const getFdcProductSearchUrl = (title: string): string => {
  const query = title ? encodeURIComponent(title.trim()) : '';
  return `${FDC_SEARCH_BASE_URL}${query}`;
};
