import { getAdditives, getFunctionFilters, getOriginFilters } from './additives';
import { absoluteUrl } from './site';

const SITEMAP_BASE_PATHS = ['/', '/function', '/origin', '/compare', '/about'] as const;
const SITEMAP_PAGE_SIZE = 5000;

type SitemapSegment = {
  size: number;
  getUrl: (index: number) => string;
};

interface SitemapData {
  pageSize: number;
  total: number;
  segments: SitemapSegment[];
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

const buildSegments = (): SitemapSegment[] => {
  const baseUrls = SITEMAP_BASE_PATHS.map((path) => absoluteUrl(path));

  const additives = getAdditives();
  const additiveSlugs = additives.map((additive) => additive.slug);

  const functionFilters = getFunctionFilters();
  const originFilters = getOriginFilters();

  const functionUrls = functionFilters.map(({ slug }) => absoluteUrl(`/function/${slug}`));
  const originUrls = originFilters.map(({ slug }) => absoluteUrl(`/origin/${slug}`));

  const segments: SitemapSegment[] = [
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
    {
      size: getComparisonCount(additiveSlugs.length),
      getUrl: (index) => {
        const [first, second] = getComparisonPair(additiveSlugs, index);

        return absoluteUrl(`/compare/${first}-vs-${second}`);
      },
    },
  ];

  return segments;
};

const buildSitemapData = (): SitemapData => {
  const segments = buildSegments();
  const total = segments.reduce((sum, segment) => sum + segment.size, 0);

  return {
    pageSize: SITEMAP_PAGE_SIZE,
    total,
    segments,
  };
};

const getSitemapData = (): SitemapData => {
  if (cachedData) {
    return cachedData;
  }

  cachedData = buildSitemapData();

  return cachedData;
};

export const getSitemapPageCount = (): number => {
  const { total, pageSize } = getSitemapData();

  if (total === 0) {
    return 1;
  }

  return Math.ceil(total / pageSize);
};

export const getSitemapPageUrls = (page: number): string[] => {
  if (!Number.isFinite(page) || page < 1) {
    return [];
  }

  const { total, pageSize, segments } = getSitemapData();
  const start = (page - 1) * pageSize;

  if (start >= total) {
    return [];
  }

  const end = Math.min(total, start + pageSize);
  const urls: string[] = [];

  let offset = 0;

  for (const segment of segments) {
    const segmentStart = offset;
    const segmentEnd = offset + segment.size;

    if (end <= segmentStart) {
      break;
    }

    if (start >= segmentEnd) {
      offset = segmentEnd;
      continue;
    }

    const from = Math.max(0, start - segmentStart);
    const to = Math.min(segment.size, end - segmentStart);

    for (let index = from; index < to; index += 1) {
      urls.push(segment.getUrl(index));
    }

    offset = segmentEnd;
  }

  return urls;
};

export const resetSitemapCache = (): void => {
  cachedData = null;
};
