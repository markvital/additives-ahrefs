import fs from 'fs';
import path from 'path';

import additivesIndex from '../data/additives.json';
import { createAdditiveSlug } from './additive-slug';

export interface AdditivePropsFile {
  title?: string;
  eNumber?: string;
  synonyms?: unknown;
  functions?: unknown;
  origin?: unknown;
  description?: unknown;
  wikipedia?: unknown;
  wikidata?: unknown;
  searchSparkline?: unknown;
  searchVolume?: unknown;
  searchRank?: unknown;
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
}

interface AdditiveIndexEntry {
  title?: string;
  eNumber?: string;
}

const dataDir = path.join(process.cwd(), 'data');

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

const toSparkline = (value: unknown): Array<number | null> => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((item) => {
    if (typeof item === 'number' && Number.isFinite(item)) {
      return item;
    }

    if (item === null) {
      return null;
    }

    return null;
  });
};

const toOptionalNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  return null;
};

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
      searchSparkline: toSparkline(parsed.searchSparkline),
      searchVolume: toOptionalNumber(parsed.searchVolume),
      searchRank: toOptionalNumber(parsed.searchRank),
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
    };
  }
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

  enriched.sort((a, b) => {
    const aHasRank = typeof a.searchRank === 'number';
    const bHasRank = typeof b.searchRank === 'number';

    if (aHasRank && bHasRank) {
      if (a.searchRank === b.searchRank) {
        return a.title.localeCompare(b.title);
      }
      return (a.searchRank ?? 0) - (b.searchRank ?? 0);
    }

    if (aHasRank) {
      return -1;
    }

    if (bHasRank) {
      return 1;
    }

    return a.title.localeCompare(b.title);
  });

  return enriched;
};

const additiveCache = mapAdditives();

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
