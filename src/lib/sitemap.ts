import {
  getAdditives,
  getFunctionFilters,
  getOriginFilters,
  getCanonicalComparisonOrder,
  sortAdditivesByMode,
} from './additives';
import { absoluteUrl } from './site';

const MAIN_SITEMAP_BASE_PATHS = ['/', '/function', '/origin', '/about', '/privacy', '/terms'] as const;
const COMPARE_BASE_PATH = '/compare';
const COMPARISON_CHUNK_SIZE = 50000;
const MAIN_CHUNK_ID = '1-main';

type SitemapEntry = {
  id: string;
  urls: string[];
};

let cachedEntries: SitemapEntry[] | null = null;

const chunkArray = <T>(items: T[], size: number): T[][] => {
  if (size <= 0) {
    return [];
  }

  const chunks: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
};

const buildMainUrls = (): string[] => {
  const baseUrls = MAIN_SITEMAP_BASE_PATHS.map((path) => absoluteUrl(path));

  const additives = getAdditives();
  const additiveSlugs = additives.map((additive) => additive.slug);

  const functionFilters = getFunctionFilters();
  const originFilters = getOriginFilters();

  const functionUrls = functionFilters.map(({ slug }) => absoluteUrl(`/function/${slug}`));
  const originUrls = originFilters.map(({ slug }) => absoluteUrl(`/origin/${slug}`));

  const additiveUrls = additiveSlugs.map((slug) => absoluteUrl(`/${slug}`));

  return [...baseUrls, ...functionUrls, ...originUrls, ...additiveUrls];
};

const buildComparisonUrls = (): string[] => {
  const additives = sortAdditivesByMode(getAdditives(), 'e-number');
  const urls: string[] = [absoluteUrl(COMPARE_BASE_PATH)];

  for (let index = 0; index < additives.length; index += 1) {
    for (let nested = index + 1; nested < additives.length; nested += 1) {
      const [primarySlug, secondarySlug] = getCanonicalComparisonOrder(
        additives[index],
        additives[nested],
      );

      urls.push(absoluteUrl(`/compare/${primarySlug}-vs-${secondarySlug}`));
    }
  }

  return urls;
};

const buildSitemapEntries = (): SitemapEntry[] => {
  const mainUrls = buildMainUrls();
  const comparisonUrls = buildComparisonUrls();
  const comparisonChunks = chunkArray(comparisonUrls, COMPARISON_CHUNK_SIZE);

  const entries: SitemapEntry[] = [
    {
      id: MAIN_CHUNK_ID,
      urls: mainUrls,
    },
  ];

  comparisonChunks.forEach((urls, index) => {
    entries.push({
      id: `${index + 2}-compare`,
      urls,
    });
  });

  return entries;
};

const getSitemapEntriesInternal = (): SitemapEntry[] => {
  if (cachedEntries) {
    return cachedEntries;
  }

  cachedEntries = buildSitemapEntries();

  return cachedEntries;
};

export const getSitemapEntries = (): SitemapEntry[] => getSitemapEntriesInternal();

export const getSitemapEntryUrls = (id: string): string[] => {
  if (!id) {
    return [];
  }

  const entry = getSitemapEntriesInternal().find((item) => item.id === id);

  return entry?.urls ?? [];
};

export const resetSitemapCache = (): void => {
  cachedEntries = null;
};
