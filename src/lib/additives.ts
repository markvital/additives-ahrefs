import fs from 'fs';
import path from 'path';

import additivesIndex from '../../data/additives.json';
import { createAdditiveSlug } from './additive-slug';
import { getSearchVolumeDataset } from './search-volume';
import { getSearchHistory } from './search-history';
import {
  AwarenessComputationResult,
  AwarenessScoreResult,
  AwarenessSourceEntry,
  calculateAwarenessScores,
} from './awareness';

const isDevelopment = process.env.NODE_ENV === 'development';

export interface AdditivePropsFile {
  title?: string;
  eNumber?: string;
  synonyms?: unknown;
  functions?: unknown;
  origin?: unknown;
  description?: unknown;
  wikipedia?: unknown;
  wikidata?: unknown;
  productCount?: unknown;
  parents?: unknown;
  children?: unknown;
}

export interface Additive {
  slug: string;
  title: string;
  eNumber: string;
  synonyms: string[];
  functions: string[];
  origin: string[];
  description: string;
  article: string;
  wikipedia: string;
  wikidata: string;
  searchSparkline: Array<number | null>;
  searchVolume: number | null;
  searchRank: number | null;
  productCount: number | null;
  awarenessScore: AwarenessScoreResult | null;
  parentSlugs: string[];
  childSlugs: string[];
}

export interface AdditiveSearchItem {
  slug: string;
  title: string;
  eNumber: string;
  synonyms: string[];
  searchRank: number | null;
}

export type AdditiveSortMode = 'search-rank' | 'product-count' | 'awareness' | 'e-number';

export const DEFAULT_ADDITIVE_SORT_MODE: AdditiveSortMode = 'product-count';

interface AdditiveIndexEntry {
  title?: string;
  eNumber?: string;
}

const dataDir = path.join(process.cwd(), 'data', 'additive');

const readAdditiveArticle = (slug: string): string => {
  const filePath = path.join(dataDir, slug, 'article.md');

  if (!fs.existsSync(filePath)) {
    return '';
  }

  try {
    const raw = fs.readFileSync(filePath, 'utf8');

    return raw.trim();
  } catch (error) {
    console.error(`Failed to read article for ${slug}:`, error);

    return '';
  }
};

const toString = (value: unknown): string => (typeof value === 'string' ? value : '');

const toStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter((item, index, list) => item.length > 0 && list.indexOf(item) === index);
};

const toOptionalNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  return null;
};

const createFilterSlug = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const readAdditiveProps = (
  slug: string,
  fallback: AdditiveIndexEntry,
): Omit<Additive, 'slug'> => {
  const filePath = path.join(dataDir, slug, 'props.json');
  const article = readAdditiveArticle(slug);

  if (!fs.existsSync(filePath)) {
    const title = fallback.title ? fallback.title : '';
    const eNumber = fallback.eNumber ? fallback.eNumber : '';

    return {
      title,
      eNumber,
      synonyms: [],
      functions: [],
      origin: [],
      description: '',
      article,
      wikipedia: '',
      wikidata: '',
      searchSparkline: [],
      searchVolume: null,
      searchRank: null,
      productCount: null,
      awarenessScore: null,
      parentSlugs: [],
      childSlugs: [],
    };
  }

  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw) as AdditivePropsFile;

    const title = toString(parsed.title) || toString(fallback.title);
    const eNumber = toString(parsed.eNumber) || toString(fallback.eNumber);

    return {
      title,
      eNumber,
      synonyms: toStringArray(parsed.synonyms),
      functions: toStringArray(parsed.functions),
      origin: toStringArray(parsed.origin),
      description: toString(parsed.description),
      article,
      wikipedia: toString(parsed.wikipedia),
      wikidata: toString(parsed.wikidata),
      searchSparkline: [],
      searchVolume: null,
      searchRank: null,
      productCount: toOptionalNumber(parsed.productCount),
      awarenessScore: null,
      parentSlugs: toStringArray(parsed.parents),
      childSlugs: toStringArray(parsed.children),
    };
  } catch (error) {
    console.error(`Failed to read additive props for ${slug}:`, error);
    const title = fallback.title ? fallback.title : '';
    const eNumber = fallback.eNumber ? fallback.eNumber : '';

    return {
      title,
      eNumber,
      synonyms: [],
      functions: [],
      origin: [],
      description: '',
      article,
      wikipedia: '',
      wikidata: '',
      searchSparkline: [],
      searchVolume: null,
      searchRank: null,
      productCount: null,
      awarenessScore: null,
      parentSlugs: [],
      childSlugs: [],
    };
  }
};

const attachSearchMetrics = (additives: Additive[]): Additive[] => {
  const totals = new Map<string, number | null>();

  additives.forEach((additive) => {
    const dataset = getSearchVolumeDataset(additive.slug);
    const total =
      typeof dataset?.totalSearchVolume === 'number' &&
      Number.isFinite(dataset.totalSearchVolume) &&
      dataset.totalSearchVolume > 0
        ? dataset.totalSearchVolume
        : null;

    totals.set(additive.slug, total);
  });

  const ranked = Array.from(totals.entries())
    .filter(([, total]) => typeof total === 'number' && (total as number) > 0)
    .sort((a, b) => (b[1]! as number) - (a[1]! as number));

  const rankMap = new Map<string, number>();
  ranked.forEach(([slug], index) => {
    rankMap.set(slug, index + 1);
  });

  return additives.map((additive) => {
    const history = getSearchHistory(additive.slug);
    const sparkline = Array.isArray(history?.sparkline) ? [...history.sparkline] : [];

    return {
      ...additive,
      searchVolume: totals.get(additive.slug) ?? null,
      searchRank: rankMap.get(additive.slug) ?? null,
      searchSparkline: sparkline,
    };
  });
};

const compareBySearchRank = (a: Additive, b: Additive): number => {
  const aRank = typeof a.searchRank === 'number' ? a.searchRank : Number.POSITIVE_INFINITY;
  const bRank = typeof b.searchRank === 'number' ? b.searchRank : Number.POSITIVE_INFINITY;

  if (aRank === bRank) {
    return a.title.localeCompare(b.title);
  }

  return aRank < bRank ? -1 : 1;
};

const compareByProductCount = (a: Additive, b: Additive): number => {
  const aCount = typeof a.productCount === 'number' ? a.productCount : -1;
  const bCount = typeof b.productCount === 'number' ? b.productCount : -1;

  if (aCount === bCount) {
    return compareBySearchRank(a, b);
  }

  return bCount - aCount;
};

const normaliseAwarenessIndex = (value: number | null | undefined): number | null => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null;
  }

  if (value <= 0) {
    return 0;
  }

  return value;
};

const compareByAwarenessScore = (a: Additive, b: Additive): number => {
  const aIndex = normaliseAwarenessIndex(a.awarenessScore?.index ?? null);
  const bIndex = normaliseAwarenessIndex(b.awarenessScore?.index ?? null);

  const aHasScore = aIndex !== null;
  const bHasScore = bIndex !== null;

  if (!aHasScore && !bHasScore) {
    return compareByProductCount(a, b);
  }

  if (aHasScore && !bHasScore) {
    return -1;
  }

  if (!aHasScore && bHasScore) {
    return 1;
  }

  if (aIndex === bIndex) {
    return compareByProductCount(a, b);
  }

  // At this point both indices are non-null numbers. Sort ascending so lower awareness surfaces first.
  return (aIndex as number) - (bIndex as number);
};

interface ENumberSortKey {
  prefix: string;
  numeric: number;
  suffix: string;
  raw: string;
}

const EMPTY_ENUMBER_PREFIX = '\uFFFF';
const EMPTY_ENUMBER_SUFFIX = '\uFFFF';

const createENumberSortKey = (value: string): ENumberSortKey => {
  const raw = typeof value === 'string' ? value.trim().toUpperCase() : '';

  if (!raw) {
    return {
      prefix: EMPTY_ENUMBER_PREFIX,
      numeric: Number.POSITIVE_INFINITY,
      suffix: EMPTY_ENUMBER_SUFFIX,
      raw: '',
    };
  }

  const match = raw.match(/^([A-Z]*?)(\d+)(.*)$/);

  if (!match) {
    const prefix = raw.replace(/[^A-Z]/g, '') || EMPTY_ENUMBER_PREFIX;

    return {
      prefix,
      numeric: Number.POSITIVE_INFINITY,
      suffix: raw.replace(/^[A-Z]*/, '') || EMPTY_ENUMBER_SUFFIX,
      raw,
    };
  }

  const [, prefix = '', digits = '', suffixRaw = ''] = match;
  const numeric = digits ? Number.parseInt(digits, 10) : Number.POSITIVE_INFINITY;
  const suffix = suffixRaw.replace(/[^A-Z0-9]/g, '');

  return {
    prefix: prefix || 'E',
    numeric,
    suffix: suffix || '',
    raw,
  };
};

const compareByENumber = (a: Additive, b: Additive): number => {
  const aKey = createENumberSortKey(a.eNumber);
  const bKey = createENumberSortKey(b.eNumber);

  if (aKey.prefix !== bKey.prefix) {
    return aKey.prefix.localeCompare(bKey.prefix);
  }

  if (aKey.numeric !== bKey.numeric) {
    return aKey.numeric - bKey.numeric;
  }

  if (aKey.suffix !== bKey.suffix) {
    if (!aKey.suffix) {
      return bKey.suffix ? -1 : 0;
    }

    if (!bKey.suffix) {
      return 1;
    }

    return aKey.suffix.localeCompare(bKey.suffix);
  }

  if (aKey.raw !== bKey.raw) {
    return aKey.raw.localeCompare(bKey.raw);
  }

  return compareByProductCount(a, b);
};

export const parseAdditiveSortMode = (
  value: string | string[] | null | undefined,
): AdditiveSortMode => {
  const raw = Array.isArray(value) ? value[0] : value;

  if (typeof raw === 'string') {
    const normalised = raw.trim().toLowerCase();

    if (normalised === 'products' || normalised === 'product-count') {
      return 'product-count';
    }

    if (normalised === 'search-rank' || normalised === 'rank') {
      return 'search-rank';
    }

    if (normalised === 'awareness' || normalised === 'awareness-score') {
      return 'awareness';
    }

    if (normalised === 'e-number' || normalised === 'enumber' || normalised === 'e') {
      return 'e-number';
    }
  }

  return DEFAULT_ADDITIVE_SORT_MODE;
};

export const parseShowClassesParam = (
  value: string | string[] | null | undefined,
): boolean => {
  const raw = Array.isArray(value) ? value[0] : value;

  if (typeof raw !== 'string') {
    return false;
  }

  const normalised = raw.trim().toLowerCase();

  if (!normalised) {
    return false;
  }

  return normalised === '1' || normalised === 'true' || normalised === 'yes' || normalised === 'show';
};

export const sortAdditivesByMode = (items: Additive[], mode: AdditiveSortMode): Additive[] => {
  const copy = [...items];

  switch (mode) {
    case 'product-count': {
      copy.sort(compareByProductCount);
      break;
    }

    case 'awareness': {
      copy.sort(compareByAwarenessScore);
      break;
    }

    case 'e-number': {
      copy.sort(compareByENumber);
      break;
    }

    default: {
      copy.sort(compareBySearchRank);
      break;
    }
  }

  return copy;
};

export const filterAdditivesByClassVisibility = (items: Additive[], showClasses: boolean): Additive[] => {
  if (showClasses) {
    return [...items];
  }

  return items.filter((item) => item.childSlugs.length === 0);
};

const mapAdditives = (): Additive[] => {
  if (!Array.isArray(additivesIndex.additives)) {
    return [];
  }

  const enriched = additivesIndex.additives.map((entry) => {
    const slug = createAdditiveSlug({ eNumber: entry.eNumber, title: entry.title });
    const props = readAdditiveProps(slug, entry);

    return {
      ...props,
      slug,
    };
  });

  const withMetrics = attachSearchMetrics(enriched);

  awarenessEntries = withMetrics.map<AwarenessSourceEntry>((item) => ({
    slug: item.slug,
    searchVolume: typeof item.searchVolume === 'number' ? item.searchVolume : null,
    productCount: typeof item.productCount === 'number' ? item.productCount : null,
  }));

  const defaultAwareness = calculateAwarenessScores(awarenessEntries);
  awarenessResult = defaultAwareness;

  const withAwareness = withMetrics.map<Additive>((item) => ({
    ...item,
    awarenessScore: defaultAwareness.scores.get(item.slug) ?? null,
  }));

  withAwareness.sort(compareBySearchRank);

  return withAwareness;
};

const collectUniqueValues = (items: Additive[], selector: (additive: Additive) => string[]): string[] => {
  const unique = new Set<string>();

  items.forEach((additive) => {
    selector(additive).forEach((value) => {
      const normalized = value.trim();

      if (normalized.length > 0) {
        unique.add(normalized);
      }
    });
  });

  return Array.from(unique.values()).sort((a, b) => a.localeCompare(b));
};

let awarenessEntries: AwarenessSourceEntry[] = [];
let awarenessResult: AwarenessComputationResult | null = null;

type FilterEntry = {
  value: string;
  slug: string;
};

const buildFilterData = (
  values: string[],
): {
  filters: FilterEntry[];
  slugToValue: Map<string, string>;
  slugToValues: Map<string, string[]>;
  valueToSlug: Map<string, string>;
} => {
  const filters: FilterEntry[] = [];
  const slugToValue = new Map<string, string>();
  const slugToValues = new Map<string, string[]>();
  const valueToSlug = new Map<string, string>();

  values.forEach((value) => {
    const slug = createFilterSlug(value);

    if (!slug) {
      return;
    }

    valueToSlug.set(value, slug);

    const variants = slugToValues.get(slug);

    if (variants) {
      variants.push(value);
    } else {
      slugToValues.set(slug, [value]);
    }

    if (slugToValue.has(slug)) {
      return;
    }

    slugToValue.set(slug, value);
    filters.push({ value, slug });
  });

  return { filters, slugToValue, slugToValues, valueToSlug };
};

type AdditiveCacheBundle = {
  additives: Additive[];
  functionFilters: FilterEntry[];
  functionSlugToValue: Map<string, string>;
  functionSlugToValues: Map<string, string[]>;
  functionValueToSlug: Map<string, string>;
  originFilters: FilterEntry[];
  originSlugToValue: Map<string, string>;
  originSlugToValues: Map<string, string[]>;
  originValueToSlug: Map<string, string>;
};

const buildCacheBundle = (): AdditiveCacheBundle => {
  const additives = mapAdditives();
  const functionValues = collectUniqueValues(additives, (item) => item.functions);
  const {
    filters: functionFilters,
    slugToValue: functionSlugToValue,
    slugToValues: functionSlugToValues,
    valueToSlug: functionValueToSlug,
  } = buildFilterData(functionValues);

  const originValues = collectUniqueValues(additives, (item) => item.origin);
  const {
    filters: originFilters,
    slugToValue: originSlugToValue,
    slugToValues: originSlugToValues,
    valueToSlug: originValueToSlug,
  } = buildFilterData(originValues);

  return {
    additives,
    functionFilters,
    functionSlugToValue,
    functionSlugToValues,
    functionValueToSlug,
    originFilters,
    originSlugToValue,
    originSlugToValues,
    originValueToSlug,
  };
};

let cacheBundle: AdditiveCacheBundle | null = null;
let devCacheBundle: { bundle: AdditiveCacheBundle; createdAt: number } | null = null;
const DEV_CACHE_TTL_MS = 5_000;

const getCacheBundle = (): AdditiveCacheBundle => {
  if (isDevelopment) {
    const now = Date.now();

    if (!devCacheBundle || now - devCacheBundle.createdAt > DEV_CACHE_TTL_MS) {
      devCacheBundle = {
        bundle: buildCacheBundle(),
        createdAt: now,
      };
    }

    return devCacheBundle.bundle;
  }

  if (!cacheBundle) {
    cacheBundle = buildCacheBundle();
  }

  return cacheBundle;
};

const ensureAwarenessInitialised = () => {
  if (awarenessEntries.length === 0 || !awarenessResult) {
    getCacheBundle();
  }
};

export const getAdditives = (): Additive[] => getCacheBundle().additives;

export const getAdditivesForSearch = (): AdditiveSearchItem[] =>
  getCacheBundle().additives.map((item) => ({
    slug: item.slug,
    title: item.title,
    eNumber: item.eNumber,
    synonyms: [...item.synonyms],
    searchRank: typeof item.searchRank === 'number' ? item.searchRank : null,
  }));

export const getAdditiveBySlug = (slug: string): Additive | undefined =>
  getCacheBundle().additives.find((item) => item.slug === slug);

export const getAdditiveSlugs = (): string[] =>
  Array.isArray(additivesIndex.additives)
    ? additivesIndex.additives.map((entry) => createAdditiveSlug({
        eNumber: entry.eNumber,
        title: entry.title,
      }))
    : [];

export const getFunctionFilters = () => getCacheBundle().functionFilters;

export const getOriginFilters = () => getCacheBundle().originFilters;

export const getFunctionValueBySlug = (slug: string): string | null =>
  getCacheBundle().functionSlugToValue.get(slug) ?? null;

export const getOriginValueBySlug = (slug: string): string | null =>
  getCacheBundle().originSlugToValue.get(slug) ?? null;

export const getFunctionSlug = (value: string): string | null => {
  const normalized = value.trim();

  if (!normalized) {
    return null;
  }

  return getCacheBundle().functionValueToSlug.get(normalized) ?? null;
};

export const getOriginSlug = (value: string): string | null => {
  const normalized = value.trim();

  if (!normalized) {
    return null;
  }

  return getCacheBundle().originValueToSlug.get(normalized) ?? null;
};

export const getAwarenessScores = (): AwarenessComputationResult => {
  ensureAwarenessInitialised();
  if (!awarenessResult) {
    awarenessResult = calculateAwarenessScores(awarenessEntries);
  }

  return awarenessResult;
};

export const getAwarenessScoreBySlug = (slug: string): AwarenessScoreResult | null => {
  const result = getAwarenessScores();
  return result.scores.get(slug) ?? null;
};

export const getAwarenessSourceEntries = (): AwarenessSourceEntry[] => [...awarenessEntries];

export const getAdditivesByFunctionSlug = (slug: string): Additive[] => {
  const cache = getCacheBundle();
  const values = cache.functionSlugToValues.get(slug);

  if (!values || values.length === 0) {
    return [];
  }

  const valueSet = new Set<string>(values);

  return cache.additives.filter((item) =>
    item.functions.some((value) => valueSet.has(value)),
  );
};

export const getAdditivesByOriginSlug = (slug: string): Additive[] => {
  const cache = getCacheBundle();
  const values = cache.originSlugToValues.get(slug);

  if (!values || values.length === 0) {
    return [];
  }

  const valueSet = new Set<string>(values);

  return cache.additives.filter((item) =>
    item.origin.some((value) => valueSet.has(value)),
  );
};

export type AdditiveGridItem = Pick<
  Additive,
  | 'slug'
  | 'title'
  | 'eNumber'
  | 'functions'
  | 'origin'
  | 'searchSparkline'
  | 'searchVolume'
  | 'searchRank'
  | 'productCount'
  | 'childSlugs'
  | 'awarenessScore'
>;

export const toAdditiveGridItem = (additive: Additive): AdditiveGridItem => ({
  slug: additive.slug,
  title: additive.title,
  eNumber: additive.eNumber,
  functions: [...additive.functions],
  origin: [...additive.origin],
  searchSparkline: [...additive.searchSparkline],
  searchVolume: additive.searchVolume,
  searchRank: additive.searchRank,
  productCount: additive.productCount,
  childSlugs: [...additive.childSlugs],
  awarenessScore: additive.awarenessScore,
});

export const mapAdditivesToGridItems = (items: Additive[]): AdditiveGridItem[] =>
  items.map((item) => toAdditiveGridItem(item));

/**
 * Determines the canonical order for two additives in a comparison.
 * Returns a tuple [primary, secondary] where primary should come first in the URL.
 *
 * Rules:
 * 1. If both have e-numbers, sort by e-number (lower e-number first)
 * 2. If only one has an e-number, it becomes primary
 * 3. If neither has an e-number, sort alphabetically by slug
 */
export const getCanonicalComparisonOrder = (
  first: Pick<Additive, 'eNumber' | 'slug'>,
  second: Pick<Additive, 'eNumber' | 'slug'>,
): [string, string] => {
  const firstHasENumber = first.eNumber && first.eNumber.trim().length > 0;
  const secondHasENumber = second.eNumber && second.eNumber.trim().length > 0;

  // Both have e-numbers: compare using e-number logic
  if (firstHasENumber && secondHasENumber) {
    const firstKey = createENumberSortKey(first.eNumber);
    const secondKey = createENumberSortKey(second.eNumber);

    // Compare prefix
    if (firstKey.prefix !== secondKey.prefix) {
      const comparison = firstKey.prefix.localeCompare(secondKey.prefix);
      return comparison <= 0 ? [first.slug, second.slug] : [second.slug, first.slug];
    }

    // Compare numeric part
    if (firstKey.numeric !== secondKey.numeric) {
      return firstKey.numeric < secondKey.numeric ? [first.slug, second.slug] : [second.slug, first.slug];
    }

    // Compare suffix
    if (firstKey.suffix !== secondKey.suffix) {
      if (!firstKey.suffix) {
        return [first.slug, second.slug];
      }
      if (!secondKey.suffix) {
        return [second.slug, first.slug];
      }
      const comparison = firstKey.suffix.localeCompare(secondKey.suffix);
      return comparison <= 0 ? [first.slug, second.slug] : [second.slug, first.slug];
    }

    // E-numbers are identical, fall back to slug comparison
    const slugComparison = first.slug.localeCompare(second.slug);
    return slugComparison <= 0 ? [first.slug, second.slug] : [second.slug, first.slug];
  }

  // Only first has e-number: first is primary
  if (firstHasENumber && !secondHasENumber) {
    return [first.slug, second.slug];
  }

  // Only second has e-number: second is primary
  if (!firstHasENumber && secondHasENumber) {
    return [second.slug, first.slug];
  }

  // Neither has e-number: sort alphabetically by slug
  const slugComparison = first.slug.localeCompare(second.slug);
  return slugComparison <= 0 ? [first.slug, second.slug] : [second.slug, first.slug];
};
