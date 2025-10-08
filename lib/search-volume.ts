import fs from 'fs';
import path from 'path';

export interface SearchVolumeKeywordShare {
  keyword: string;
  volume: number;
}

export interface SearchVolumeDataset {
  keywords: SearchVolumeKeywordShare[];
  totalSearchVolume: number;
  country: string;
  fetchedAt: string;
}

const datasetCache = new Map<string, SearchVolumeDataset | null>();

const getDatasetPath = (slug: string): string =>
  path.join(process.cwd(), 'data', slug, 'searchVolume.json');

const normaliseKeyword = (value: unknown): string => {
  if (typeof value !== 'string') {
    return '';
  }
  return value.trim();
};

const normaliseVolume = (value: unknown): number => {
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
    return Math.round(value);
  }
  return 0;
};

export const getSearchVolume = (slug: string): SearchVolumeDataset | null => {
  if (datasetCache.has(slug)) {
    return datasetCache.get(slug) ?? null;
  }

  const filePath = getDatasetPath(slug);

  if (!fs.existsSync(filePath)) {
    datasetCache.set(slug, null);
    return null;
  }

  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw) as Partial<SearchVolumeDataset>;

    const keywordsArray = Array.isArray(parsed.keywords) ? parsed.keywords : [];
    const keywords: SearchVolumeKeywordShare[] = [];
    const seen = new Set<string>();

    keywordsArray.forEach((entry) => {
      if (!entry || typeof entry !== 'object') {
        return;
      }
      const keyword = normaliseKeyword((entry as SearchVolumeKeywordShare).keyword);
      if (!keyword) {
        return;
      }
      const normalisedKey = keyword.toLowerCase();
      if (seen.has(normalisedKey)) {
        return;
      }
      seen.add(normalisedKey);
      keywords.push({
        keyword,
        volume: normaliseVolume((entry as SearchVolumeKeywordShare).volume),
      });
    });

    const totalSearchVolume = normaliseVolume(parsed.totalSearchVolume);
    const dataset: SearchVolumeDataset = {
      keywords,
      totalSearchVolume,
      country: typeof parsed.country === 'string' ? parsed.country : '',
      fetchedAt: typeof parsed.fetchedAt === 'string' ? parsed.fetchedAt : '',
    };

    datasetCache.set(slug, dataset);
    return dataset;
  } catch (error) {
    console.error(`Failed to parse search volume for ${slug}:`, error);
    datasetCache.set(slug, null);
    return null;
  }
};
