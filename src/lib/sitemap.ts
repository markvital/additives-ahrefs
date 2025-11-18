import { getAdditives, getFunctionFilters, getOriginFilters } from './additives';
import { absoluteUrl } from './site';

const MAIN_SITEMAP_BASE_PATHS = ['/', '/function', '/origin', '/about', '/privacy', '/terms'] as const;
const COMPARE_BASE_PATH = '/compare';
const COMPARISON_CHUNK_SIZE = 30000;
const MAIN_CHUNK_ID = '1-main';

type SitemapEntry = {
  id: string;
  urls: string[];
};

let cachedEntries: SitemapEntry[] | null = null;

const getComparisonCount = (length: number): number => {
  if (length < 2) {
    return 0;
  }

  return (length * (length - 1)) / 2;
};

const getComparisonPair = (slugs: string[], position: number): [string, string] => {
  let offset = position;

  for (let i = 0; i < slugs.length; i += 1) {
    const blockSize = slugs.length - i - 1;

    if (offset < blockSize) {
      return [slugs[i], slugs[i + 1 + offset]];
    }

    offset -= blockSize;
  }

  throw new RangeError(`Comparison index ${position} is out of range`);
};

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
  const additives = getAdditives();
  const additiveSlugs = additives.map((additive) => additive.slug);
  const totalComparisons = getComparisonCount(additiveSlugs.length);
  const urls: string[] = [absoluteUrl(COMPARE_BASE_PATH)];

  for (let index = 0; index < totalComparisons; index += 1) {
    const [first, second] = getComparisonPair(additiveSlugs, index);

    urls.push(absoluteUrl(`/compare/${first}-vs-${second}`));
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
