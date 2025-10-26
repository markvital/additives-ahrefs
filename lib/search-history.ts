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
  sparkline: Array<number | null>;
}

const historyCache = new Map<string, SearchHistoryDataset | null>();

const getHistoryPath = (slug: string): string =>
  path.join(process.cwd(), 'data', 'additive', slug, 'searchHistory.json');

const getFullHistoryPath = (slug: string): string =>
  path.join(process.cwd(), 'data', 'additive', slug, 'searchHistoryFull.json');

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

const normaliseSparkline = (value: unknown): Array<number | null> => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((entry) => {
    if (typeof entry === 'number' && Number.isFinite(entry)) {
      return entry;
    }

    if (entry === null) {
      return null;
    }

    return null;
  });
};

const buildSparklineFromMetrics = (data: SearchHistoryMetric[]): Array<number | null> => {
  if (data.length === 0) {
    return [];
  }

  const now = new Date();
  const startYear = now.getUTCFullYear() - 9;
  const endYear = now.getUTCFullYear();
  const result: Array<number | null> = [];

  for (let year = startYear; year <= endYear; year += 1) {
    const yearly = data.filter((entry) => new Date(entry.date).getUTCFullYear() === year);
    if (yearly.length === 0) {
      result.push(null);
      continue;
    }

    const sum = yearly.reduce((acc, entry) => acc + entry.volume, 0);
    result.push(Math.round(sum / yearly.length));
  }

  return result;
};

const mapDataset = (aggregated: any, full?: any): SearchHistoryDataset => {
  const keywordsRaw: unknown[] = Array.isArray(full?.keywords)
    ? full!.keywords
    : Array.isArray(aggregated?.keywords)
    ? aggregated.keywords
    : [];

  const keywords = keywordsRaw
    .map((entry: unknown) => normaliseKeywordHistory(entry))
    .filter((entry): entry is KeywordHistoryEntry => entry !== null);

  if (keywords.length === 0 && typeof aggregated?.keyword === 'string') {
    const keyword = aggregated.keyword.trim();
    if (keyword) {
      keywords.push({ keyword, metrics: normaliseMetrics(aggregated?.metrics) });
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

  let metrics = normaliseMetrics(aggregated?.metrics);
  if (metrics.length === 0) {
    metrics = aggregateMetricsFromKeywords(deduped);
  }

  let sparkline = normaliseSparkline(aggregated?.sparkline);
  if (sparkline.length === 0) {
    sparkline = buildSparklineFromMetrics(metrics);
  }

  return {
    country: typeof aggregated?.country === 'string'
      ? aggregated.country
      : typeof full?.country === 'string'
      ? full.country
      : '',
    fetchedAt: typeof aggregated?.fetchedAt === 'string'
      ? aggregated.fetchedAt
      : typeof full?.fetchedAt === 'string'
      ? full.fetchedAt
      : '',
    metrics,
    keywords: deduped,
    sparkline,
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
    const aggregatedRaw = fs.readFileSync(filePath, 'utf8');
    const aggregated = JSON.parse(aggregatedRaw);

    let full: any = null;
    const fullPath = getFullHistoryPath(slug);
    if (fs.existsSync(fullPath)) {
      try {
        const fullRaw = fs.readFileSync(fullPath, 'utf8');
        full = JSON.parse(fullRaw);
      } catch (error) {
        console.error(`Failed to parse full search history for ${slug}:`, error);
      }
    }

    const dataset = mapDataset(aggregated, full ?? undefined);
    historyCache.set(slug, dataset);
    return dataset;
  } catch (error) {
    console.error(`Failed to parse search history for ${slug}:`, error);
    historyCache.set(slug, null);
    return null;
  }
};
