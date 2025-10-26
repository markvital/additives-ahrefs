import fs from 'fs';
import path from 'path';

import additivesIndex from '../data/additives.json';
import { createAdditiveSlug } from './additive-slug';
import { getSearchVolumeDataset } from './search-volume';
import { getSearchHistory } from './search-history';

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
  parentSlugs: string[];
  childSlugs: string[];
}

export type AdditiveSortMode = 'search-rank' | 'product-count';

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

  if (mode === 'product-count') {
    copy.sort(compareByProductCount);
    return copy;
  }

  copy.sort(compareBySearchRank);
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

  withMetrics.sort(compareBySearchRank);

  return withMetrics;
};

const additiveCache = mapAdditives();

const collectUniqueValues = (selector: (additive: Additive) => string[]): string[] => {
  const unique = new Set<string>();

  additiveCache.forEach((additive) => {
    selector(additive).forEach((value) => {
      const normalized = value.trim();

      if (normalized.length > 0) {
        unique.add(normalized);
      }
    });
  });

  return Array.from(unique.values()).sort((a, b) => a.localeCompare(b));
};

type FilterEntry = {
  value: string;
  slug: string;
};

const buildFilterData = (
  values: string[],
): {
  filters: FilterEntry[];
  slugToValue: Map<string, string>;
  valueToSlug: Map<string, string>;
} => {
  const filters: FilterEntry[] = [];
  const slugToValue = new Map<string, string>();
  const valueToSlug = new Map<string, string>();

  values.forEach((value) => {
    const slug = createFilterSlug(value);

    if (!slug) {
      return;
    }

    valueToSlug.set(value, slug);

    if (slugToValue.has(slug)) {
      return;
    }

    slugToValue.set(slug, value);
    filters.push({ value, slug });
  });

  return { filters, slugToValue, valueToSlug };
};

const functionValues = collectUniqueValues((item) => item.functions);
const {
  filters: functionFilters,
  slugToValue: functionSlugToValue,
  valueToSlug: functionValueToSlug,
} = buildFilterData(functionValues);

const originValues = collectUniqueValues((item) => item.origin);
const {
  filters: originFilters,
  slugToValue: originSlugToValue,
  valueToSlug: originValueToSlug,
} = buildFilterData(originValues);

export const getAdditives = (): Additive[] => additiveCache;

export const getAdditiveBySlug = (slug: string): Additive | undefined =>
  additiveCache.find((item) => item.slug === slug);

export const getAdditiveSlugs = (): string[] =>
  Array.isArray(additivesIndex.additives)
    ? additivesIndex.additives.map((entry) => createAdditiveSlug({
        eNumber: entry.eNumber,
        title: entry.title,
      }))
    : [];

export const getFunctionFilters = () => functionFilters;

export const getOriginFilters = () => originFilters;

export const getFunctionValueBySlug = (slug: string): string | null => functionSlugToValue.get(slug) ?? null;

export const getOriginValueBySlug = (slug: string): string | null => originSlugToValue.get(slug) ?? null;

export const getFunctionSlug = (value: string): string | null => {
  const normalized = value.trim();

  if (!normalized) {
    return null;
  }

  return functionValueToSlug.get(normalized) ?? null;
};

export const getOriginSlug = (value: string): string | null => {
  const normalized = value.trim();

  if (!normalized) {
    return null;
  }

  return originValueToSlug.get(normalized) ?? null;
};

export const getAdditivesByFunctionSlug = (slug: string): Additive[] => {
  const value = getFunctionValueBySlug(slug);

  if (!value) {
    return [];
  }

  return additiveCache.filter((item) => item.functions.includes(value));
};

export const getAdditivesByOriginSlug = (slug: string): Additive[] => {
  const value = getOriginValueBySlug(slug);

  if (!value) {
    return [];
  }

  return additiveCache.filter((item) => item.origin.includes(value));
};
