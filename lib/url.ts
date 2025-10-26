export type SearchParamValue = string | string[] | undefined;
export type SearchParamRecord = Record<string, SearchParamValue>;

export const buildShowClassesHref = (
  basePath: string,
  params: SearchParamRecord | undefined,
): string => {
  const searchParams = new URLSearchParams();

  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (typeof value === 'undefined') {
        return;
      }

      if (Array.isArray(value)) {
        value.forEach((entry) => {
          searchParams.append(key, entry);
        });
        return;
      }

      searchParams.set(key, value);
    });
  }

  searchParams.set('classes', '1');

  const query = searchParams.toString();

  return query ? `${basePath}?${query}` : basePath;
};
