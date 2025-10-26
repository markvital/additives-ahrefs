import fs from 'fs';
import path from 'path';

export interface SearchVolumeKeyword {
  keyword: string;
  volume: number;
}

export interface SearchKeywordConfig {
  included: string[];
  supplementary: string[];
  excluded: string[];
}

export interface SearchVolumeDataset {
  totalSearchVolume: number;
  keywords: SearchVolumeKeyword[];
  keywordConfig?: SearchKeywordConfig;
}

const cache = new Map<string, SearchVolumeDataset | null>();

const getVolumePath = (slug: string): string =>
  path.join(process.cwd(), 'data', 'additive', slug, 'searchVolume.json');

const normaliseKeyword = (entry: unknown): SearchVolumeKeyword | null => {
  if (!entry || typeof entry !== 'object') {
    return null;
  }

  const value = entry as { keyword?: unknown; volume?: unknown };
  const keyword = typeof value.keyword === 'string' ? value.keyword.trim() : '';
  if (!keyword) {
    return null;
  }

  const volume =
    typeof value.volume === 'number' && Number.isFinite(value.volume)
      ? Math.max(0, value.volume)
      : 0;

  return { keyword, volume };
};

const normaliseKeywordList = (source: unknown): string[] => {
  if (!Array.isArray(source)) {
    return [];
  }

  const seen = new Set<string>();
  const result: string[] = [];

  source.forEach((value) => {
    if (typeof value !== 'string') {
      return;
    }

    const trimmed = value.trim();
    if (!trimmed) {
      return;
    }

    const key = trimmed.toLowerCase();
    if (seen.has(key)) {
      return;
    }

    seen.add(key);
    result.push(trimmed);
  });

  return result;
};

const mapDataset = (parsed: any): SearchVolumeDataset => {
  const keywordsRaw: unknown[] = Array.isArray(parsed?.keywords) ? parsed.keywords : [];
  const keywords = keywordsRaw
    .map((entry: unknown) => normaliseKeyword(entry))
    .filter((entry): entry is SearchVolumeKeyword => entry !== null);

  const seen = new Set<string>();
  const deduped = keywords.filter((entry) => {
    const key = entry.keyword.toLowerCase();
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });

  const totalFromFile =
    typeof parsed?.totalSearchVolume === 'number' && Number.isFinite(parsed.totalSearchVolume)
      ? Math.max(0, parsed.totalSearchVolume)
      : 0;

  const computedTotal = deduped.reduce((acc, entry) => acc + entry.volume, 0);
  const totalSearchVolume = totalFromFile > 0 ? totalFromFile : computedTotal;

  deduped.sort((a, b) => {
    if (a.volume === b.volume) {
      return a.keyword.localeCompare(b.keyword);
    }
    return b.volume - a.volume;
  });

  const keywordConfigSource = parsed?.keywordConfig;
  let keywordConfig: SearchKeywordConfig | undefined;
  if (keywordConfigSource && typeof keywordConfigSource === 'object') {
    const included = normaliseKeywordList((keywordConfigSource as any).included);
    const supplementary = normaliseKeywordList((keywordConfigSource as any).supplementary);
    const excluded = normaliseKeywordList((keywordConfigSource as any).excluded);

    if (included.length > 0 || supplementary.length > 0 || excluded.length > 0) {
      keywordConfig = { included, supplementary, excluded };
    }
  }

  return {
    totalSearchVolume,
    keywords: deduped,
    keywordConfig,
  };
};

export const getSearchVolumeDataset = (slug: string): SearchVolumeDataset | null => {
  if (cache.has(slug)) {
    return cache.get(slug) ?? null;
  }

  const filePath = getVolumePath(slug);
  if (!fs.existsSync(filePath)) {
    cache.set(slug, null);
    return null;
  }

  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    const dataset = mapDataset(parsed);
    cache.set(slug, dataset);
    return dataset;
  } catch (error) {
    console.error(`Failed to parse search volume for ${slug}:`, error);
    cache.set(slug, null);
    return null;
  }
};
