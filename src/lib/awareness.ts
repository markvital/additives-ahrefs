export interface AwarenessSourceEntry {
  slug: string;
  searchVolume: number | null;
  productCount: number | null;
}

export interface AwarenessComputationOptions {
  alpha?: number;
  useLog?: boolean;
}

export interface AwarenessScoreResult {
  slug: string;
  baseline: number;
  smoothedSearch: number;
  smoothedProduct: number;
  ratio: number;
  index: number;
  logValue: number | null;
  normalized: number;
  colorScore: number;
}

export interface AwarenessComputationResult {
  alpha: number;
  useLog: boolean;
  baseline: number;
  percentileRange: { p5: number; p95: number } | null;
  scores: Map<string, AwarenessScoreResult>;
}

export const DEFAULT_AWARENESS_ALPHA = 5;
export const DEFAULT_AWARENESS_USE_LOG = true;

const clamp = (value: number, min: number, max: number): number => {
  if (value < min) {
    return min;
  }

  if (value > max) {
    return max;
  }

  return value;
};

const toFiniteNumber = (value: unknown): number | null => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null;
  }

  return value;
};

const resolvePercentile = (values: number[], percentile: number): number | null => {
  if (values.length === 0) {
    return null;
  }

  if (values.length === 1) {
    return values[0];
  }

  const sorted = [...values].sort((a, b) => a - b);
  const rank = clamp(percentile, 0, 100) / 100;
  const index = (sorted.length - 1) * rank;
  const lowerIndex = Math.floor(index);
  const upperIndex = Math.ceil(index);

  if (lowerIndex === upperIndex) {
    return sorted[lowerIndex];
  }

  const lowerWeight = upperIndex - index;
  const upperWeight = index - lowerIndex;

  return sorted[lowerIndex] * lowerWeight + sorted[upperIndex] * upperWeight;
};

export const calculateAwarenessScores = (
  entries: AwarenessSourceEntry[],
  options: AwarenessComputationOptions = {},
): AwarenessComputationResult => {
  const alphaRaw = toFiniteNumber(options.alpha);
  const alpha = typeof alphaRaw === 'number' && alphaRaw >= 0 ? alphaRaw : DEFAULT_AWARENESS_ALPHA;
  const useLog = options.useLog ?? DEFAULT_AWARENESS_USE_LOG;

  const validEntries = entries.filter((entry) => {
    const hasSearchVolume = typeof entry.searchVolume === 'number' && entry.searchVolume > 0;
    const hasProductCount = typeof entry.productCount === 'number' && entry.productCount > 0;

    return hasSearchVolume && hasProductCount;
  });

  const totalSearchVolume = validEntries.reduce((acc, entry) => acc + (entry.searchVolume ?? 0), 0);
  const totalProductCount = validEntries.reduce((acc, entry) => acc + (entry.productCount ?? 0), 0);

  if (totalSearchVolume <= 0 || totalProductCount <= 0 || validEntries.length === 0) {
    return {
      alpha,
      useLog,
      baseline: 0,
      percentileRange: null,
      scores: new Map(),
    };
  }

  const baseline = totalSearchVolume / totalProductCount;

  const scaleValues: number[] = [];
  const scores = new Map<string, AwarenessScoreResult>();

  validEntries.forEach((entry) => {
    const searchVolume = entry.searchVolume ?? 0;
    const productCount = entry.productCount ?? 0;
    const smoothedSearch = searchVolume + alpha * baseline;
    const smoothedProduct = productCount + alpha;
    const ratio = smoothedProduct > 0 ? smoothedSearch / smoothedProduct : 0;
    const index = baseline > 0 ? ratio / baseline : 0;
    const logValue = index > 0 ? Math.log10(index) : null;
    const scaleValue = useLog ? logValue ?? 0 : index;

    if (Number.isFinite(scaleValue)) {
      scaleValues.push(scaleValue);
    }

    scores.set(entry.slug, {
      slug: entry.slug,
      baseline,
      smoothedSearch,
      smoothedProduct,
      ratio,
      index,
      logValue,
      normalized: 0.5,
      colorScore: 50,
    });
  });

  const p5 = resolvePercentile(scaleValues, 5);
  const p95 = resolvePercentile(scaleValues, 95);
  const percentileRange = p5 !== null && p95 !== null ? { p5, p95 } : null;

  scores.forEach((score, slug) => {
    const scaleValue = useLog ? score.logValue ?? 0 : score.index;
    const denominator = percentileRange ? percentileRange.p95 - percentileRange.p5 : 0;
    let normalized = 0.5;

    if (percentileRange && denominator > 0) {
      const raw = (scaleValue - percentileRange.p5) / denominator;
      normalized = clamp(raw, 0, 1);
    }

    const colorScore = Math.round(normalized * 100);

    scores.set(slug, {
      ...score,
      normalized,
      colorScore,
    });
  });

  return {
    alpha,
    useLog,
    baseline,
    percentileRange,
    scores,
  };
};

const parseFirstValue = (value: string | string[] | null | undefined): string | null => {
  if (Array.isArray(value)) {
    return typeof value[0] === 'string' ? value[0] : null;
  }

  return typeof value === 'string' ? value : null;
};

export const parseAwarenessAlphaParam = (value: string | string[] | null | undefined): number | null => {
  const raw = parseFirstValue(value);

  if (!raw) {
    return null;
  }

  const parsed = Number.parseFloat(raw);

  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }

  return parsed;
};

export const parseAwarenessUseLogParam = (value: string | string[] | null | undefined): boolean | null => {
  const raw = parseFirstValue(value);

  if (!raw) {
    return null;
  }

  const normalized = raw.trim().toLowerCase();

  if (!normalized) {
    return null;
  }

  if (normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'log' || normalized === 'on') {
    return true;
  }

  if (normalized === '0' || normalized === 'false' || normalized === 'no' || normalized === 'linear' || normalized === 'off') {
    return false;
  }

  return null;
};

export const resolveAwarenessOptionsFromSearchParams = (
  searchParams?: { [key: string]: string | string[] | undefined } | null,
): AwarenessComputationOptions => {
  if (!searchParams) {
    return {};
  }

  const alphaParam = parseAwarenessAlphaParam(searchParams.awAlpha ?? null);
  const useLogParam = parseAwarenessUseLogParam(searchParams.awLog ?? null);

  return {
    alpha: alphaParam ?? undefined,
    useLog: useLogParam ?? undefined,
  };
};
