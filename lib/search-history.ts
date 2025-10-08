import fs from 'fs';
import path from 'path';

export interface SearchHistoryMetric {
  date: string;
  volume: number;
}

export interface KeywordHistoryEntry {
  keyword: string;
  metrics: SearchHistoryMetric[];
}

export interface SearchHistoryDataset {
  country: string;
  fetchedAt: string;
  metrics: SearchHistoryMetric[];
  keywords: KeywordHistoryEntry[];
}

const historyCache = new Map<string, SearchHistoryDataset | null>();

const getHistoryPath = (slug: string): string =>
  path.join(process.cwd(), 'data', slug, 'searchHistory.json');

const normaliseMetric = (entry: unknown): SearchHistoryMetric | null => {
  if (!entry || typeof entry !== 'object') {
    return null;
  }

  const value = entry as { date?: unknown; volume?: unknown };
  const date = typeof value.date === 'string' ? value.date.trim() : '';
  if (!date) {
    return null;
  }

  const parsedDate = new Date(date);
  if (Number.isNaN(parsedDate.getTime())) {
    return null;
  }

  const volume =
    typeof value.volume === 'number' && Number.isFinite(value.volume)
      ? Math.max(0, value.volume)
      : 0;

  return { date, volume };
};

const normaliseMetrics = (source: unknown): SearchHistoryMetric[] => {
  if (!Array.isArray(source)) {
    return [];
  }

  const mapped = source
    .map((entry) => normaliseMetric(entry))
    .filter((entry): entry is SearchHistoryMetric => entry !== null);

  mapped.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  return mapped;
};

const normaliseKeywordHistory = (entry: unknown): KeywordHistoryEntry | null => {
  if (!entry || typeof entry !== 'object') {
    return null;
  }

  const value = entry as { keyword?: unknown; metrics?: unknown };
  const keyword = typeof value.keyword === 'string' ? value.keyword.trim() : '';
  if (!keyword) {
    return null;
  }

  const metrics = normaliseMetrics(value.metrics);

  return { keyword, metrics };
};

const aggregateMetricsFromKeywords = (keywords: KeywordHistoryEntry[]): SearchHistoryMetric[] => {
  if (!keywords.length) {
    return [];
  }

  const dateMap = new Map<string, number>();

  keywords.forEach((entry) => {
    entry.metrics.forEach((metric) => {
      const current = dateMap.get(metric.date) ?? 0;
      dateMap.set(metric.date, current + metric.volume);
    });
  });

  return Array.from(dateMap.entries())
    .map(([date, volume]) => ({ date, volume }))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
};

const mapDataset = (parsed: any): SearchHistoryDataset => {
  const keywordsRaw: unknown[] = Array.isArray(parsed?.keywords) ? parsed.keywords : [];

  const keywords = keywordsRaw
    .map((entry: unknown) => normaliseKeywordHistory(entry))
    .filter((entry): entry is KeywordHistoryEntry => entry !== null);

  if (keywords.length === 0 && typeof parsed?.keyword === 'string') {
    const keyword = parsed.keyword.trim();
    if (keyword) {
      keywords.push({ keyword, metrics: normaliseMetrics(parsed?.metrics) });
    }
  }

  const deduped: KeywordHistoryEntry[] = [];
  const seen = new Set<string>();
  keywords.forEach((entry) => {
    const key = entry.keyword.toLowerCase();
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    deduped.push(entry);
  });

  let metrics = normaliseMetrics(parsed?.metrics);
  if (metrics.length === 0) {
    metrics = aggregateMetricsFromKeywords(deduped);
  }

  return {
    country: typeof parsed?.country === 'string' ? parsed.country : '',
    fetchedAt: typeof parsed?.fetchedAt === 'string' ? parsed.fetchedAt : '',
    metrics,
    keywords: deduped,
  };
};

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
    const parsed = JSON.parse(raw);
    const dataset = mapDataset(parsed);
    historyCache.set(slug, dataset);
    return dataset;
  } catch (error) {
    console.error(`Failed to parse search history for ${slug}:`, error);
    historyCache.set(slug, null);
    return null;
  }
};
