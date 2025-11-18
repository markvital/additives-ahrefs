import { getAdditives, getFunctionFilters, getOriginFilters } from './additives';
import { absoluteUrl } from './site';

const SITEMAP_BASE_PATHS = ['/', '/function', '/origin', '/compare', '/about', '/privacy', '/terms'] as const;
const MAIN_SITEMAP_SLUG = '1-main';
const COMPARE_SITEMAP_PAGE_SIZE = 30000;

type SitemapSegment = {
  size: number;
  getUrl: (index: number) => string;
};

type SitemapFile = {
  slug: string;
  size: number;
  getUrl: (index: number) => string;
};

interface SitemapData {
  files: SitemapFile[];
}

let cachedData: SitemapData | null = null;

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

const buildSegments = (): { main: SitemapSegment[]; compare: SitemapSegment } => {
  const baseUrls = SITEMAP_BASE_PATHS.map((path) => absoluteUrl(path));

  const additives = getAdditives();
  const additiveSlugs = additives.map((additive) => additive.slug);

  const functionFilters = getFunctionFilters();
  const originFilters = getOriginFilters();

  const functionUrls = functionFilters.map(({ slug }) => absoluteUrl(`/function/${slug}`));
  const originUrls = originFilters.map(({ slug }) => absoluteUrl(`/origin/${slug}`));

  const mainSegments: SitemapSegment[] = [
    {
      size: baseUrls.length,
      getUrl: (index) => baseUrls[index],
    },
    {
      size: additiveSlugs.length,
      getUrl: (index) => absoluteUrl(`/${additiveSlugs[index]}`),
    },
    {
      size: functionUrls.length,
      getUrl: (index) => functionUrls[index],
    },
    {
      size: originUrls.length,
      getUrl: (index) => originUrls[index],
    },
  ];

  const compareSegment: SitemapSegment = {
    size: getComparisonCount(additiveSlugs.length),
    getUrl: (index) => {
      const [first, second] = getComparisonPair(additiveSlugs, index);

      return absoluteUrl(`/compare/${first}-vs-${second}`);
    },
  };

  return { main: mainSegments, compare: compareSegment };
};

const createSegmentAccessor = (segments: SitemapSegment[]): ((index: number) => string) => {
  return (index: number) => {
    if (index < 0) {
      throw new RangeError('Index must be non-negative');
    }

    let offset = 0;

    for (const segment of segments) {
      const segmentEnd = offset + segment.size;

      if (index < segmentEnd) {
        return segment.getUrl(index - offset);
      }

      offset = segmentEnd;
    }

    throw new RangeError(`Index ${index} is out of range`);
  };
};

const buildCompareFiles = (segment: SitemapSegment): SitemapFile[] => {
  const files: SitemapFile[] = [];

  if (segment.size === 0) {
    return files;
  }

  let processed = 0;
  let chunkIndex = 0;

  while (processed < segment.size) {
    const size = Math.min(COMPARE_SITEMAP_PAGE_SIZE, segment.size - processed);
    const slug = `${chunkIndex + 2}-compare`;
    const start = processed;

    files.push({
      slug,
      size,
      getUrl: (index) => segment.getUrl(start + index),
    });

    processed += size;
    chunkIndex += 1;
  }

  return files;
};

const buildSitemapData = (): SitemapData => {
  const { main, compare } = buildSegments();
  const mainSize = main.reduce((sum, segment) => sum + segment.size, 0);
  const files: SitemapFile[] = [
    {
      slug: MAIN_SITEMAP_SLUG,
      size: mainSize,
      getUrl: createSegmentAccessor(main),
    },
  ];

  files.push(...buildCompareFiles(compare));

  return { files };
};

const getSitemapData = (): SitemapData => {
  if (cachedData) {
    return cachedData;
  }

  cachedData = buildSitemapData();

  return cachedData;
};

export const getSitemapSlugs = (): string[] => getSitemapData().files.map((file) => file.slug);

export const getSitemapUrls = (slug: string): string[] => {
  if (!slug) {
    return [];
  }

  const file = getSitemapData().files.find((candidate) => candidate.slug === slug);

  if (!file) {
    return [];
  }

  return Array.from({ length: file.size }, (_, index) => file.getUrl(index));
};

export const resetSitemapCache = (): void => {
  cachedData = null;
};
