import fs from 'fs';
import path from 'path';

export interface SearchHistoryMetric {
  date: string;
  volume: number;
}

export interface SearchHistoryDataset {
  keywords: string[];
  country: string;
  fetchedAt: string;
  metrics: SearchHistoryMetric[];
}

const historyCache = new Map<string, SearchHistoryDataset | null>();

const getHistoryPath = (slug: string): string =>
  path.join(process.cwd(), 'data', slug, 'searchHistory.json');

export const getSearchHistory = (slug: string): SearchHistoryDataset | null => {
  if (historyCache.has(slug)) {
    return historyCache.get(slug) ?? null;
  }

  const filePath = getHistoryPath(slug);
  if (!fs.existsSync(filePath)) {
    historyCache.set(slug, null);
    return null;
  }

  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw) as Partial<SearchHistoryDataset & { keyword?: string }>;

    const keywordList = Array.isArray(parsed.keywords)
      ? parsed.keywords
          .map((value) => (typeof value === 'string' ? value.trim() : ''))
          .filter((value, index, list) => value.length > 0 && list.indexOf(value) === index)
      : [];

    if (keywordList.length === 0 && typeof parsed.keyword === 'string') {
      const fallback = parsed.keyword.trim();
      if (fallback) {
        keywordList.push(fallback);
      }
    }

    const metrics = Array.isArray(parsed.metrics)
      ? parsed.metrics
          .map((entry) => ({
            date: typeof entry.date === 'string' ? entry.date : '',
            volume: typeof entry.volume === 'number' ? entry.volume : 0,
          }))
          .filter((entry) => entry.date.length > 0)
      : [];

    const dataset: SearchHistoryDataset = {
      keywords: keywordList,
      country: typeof parsed.country === 'string' ? parsed.country : '',
      fetchedAt: typeof parsed.fetchedAt === 'string' ? parsed.fetchedAt : '',
      metrics,
    };

    historyCache.set(slug, dataset);
    return dataset;
  } catch (error) {
    console.error(`Failed to parse search history for ${slug}:`, error);
    historyCache.set(slug, null);
    return null;
  }
};
