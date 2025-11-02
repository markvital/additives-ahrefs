'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Box, Button, Chip, Stack, Typography } from '@mui/material';
import type { Additive } from '../lib/additives';
import { formatAdditiveDisplayName, formatFunctionLabel, formatOriginLabel } from '../lib/additive-format';
import { extractArticleSummary, splitArticlePreview } from '../lib/article';
import { formatMonthlyVolume, formatProductCount, getCountryFlagEmoji, getCountryLabel } from '../lib/format';
import type { SearchHistoryDataset } from '../lib/search-history';
import { MarkdownArticle } from './MarkdownArticle';
import { AdditiveLookup } from './AdditiveLookup';
import { SearchHistoryChart } from './SearchHistoryChart';
import type { AwarenessScoreResult } from '../lib/awareness';
import { AwarenessScoreChip } from './AwarenessScoreChip';

export interface ComparisonAdditive extends Additive {
  searchHistory: SearchHistoryDataset | null;
}

interface AdditiveComparisonProps {
  additives: ComparisonAdditive[];
  initialSelection: [string | null, string | null];
  awarenessScores: Record<string, AwarenessScoreResult>;
}

interface SelectionState {
  left: ComparisonAdditive | null;
  right: ComparisonAdditive | null;
}

const functionChipSx = {
  borderRadius: '7.5px',
  bgcolor: '#f4f4f4',
  color: '#787878',
  border: 'none',
  textTransform: 'none',
  whiteSpace: 'nowrap',
  '& .MuiChip-label': {
    px: '5px',
    py: '3px',
    color: '#787878',
  },
} as const;

const renderSynonymContent = (additive: ComparisonAdditive | null) => {
  if (!additive) {
    return null;
  }

  if (additive.synonyms.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        No synonyms available.
      </Typography>
    );
  }

  const synonyms = additive.synonyms.filter((value, index, list) => list.indexOf(value) === index);

  return (
    <Stack direction="row" spacing={1} flexWrap="wrap">
      {synonyms.map((synonym) => (
        <Chip
          key={synonym}
          label={synonym}
          variant="outlined"
          size="small"
        />
      ))}
    </Stack>
  );
};

const renderFunctionContent = (additive: ComparisonAdditive | null) => {
  if (!additive) {
    return null;
  }

  if (additive.functions.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        Not specified.
      </Typography>
    );
  }

  const functions = additive.functions.filter((value, index, list) => list.indexOf(value) === index);

  return (
    <Stack direction="row" spacing={1} flexWrap="wrap">
      {functions.map((fn) => (
        <Chip
          key={fn}
          label={formatFunctionLabel(fn)}
          variant="filled"
          size="small"
          sx={functionChipSx}
        />
      ))}
    </Stack>
  );
};

const renderOriginContent = (additive: ComparisonAdditive | null) => {
  if (!additive) {
    return null;
  }

  if (additive.origin.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        Not specified.
      </Typography>
    );
  }

  const origins = additive.origin.filter((value, index, list) => list.indexOf(value) === index);

  return (
    <Stack direction="row" spacing={1} flexWrap="wrap">
      {origins.map((origin) => (
        <Chip key={origin} label={formatOriginLabel(origin)} variant="outlined" size="small" />
      ))}
    </Stack>
  );
};

const getSearchInterestLabel = (dataset: SearchHistoryDataset | null) => {
  if (!dataset) {
    return null;
  }

  const keywords = Array.isArray(dataset.keywords) ? dataset.keywords : [];
  const firstKeyword = keywords[0]?.keyword?.trim();

  let keywordText: string | null = null;
  if (keywords.length === 1 && firstKeyword) {
    keywordText = `“${firstKeyword}”`;
  } else if (keywords.length > 1) {
    keywordText = `${keywords.length} keywords`;
  }

  if (!keywordText) {
    return null;
  }

  const countryCode = dataset.country?.trim();
  const countryLabel = countryCode ? getCountryLabel(countryCode) ?? countryCode.toUpperCase() : null;
  const countryText = countryLabel ? `${countryLabel}` : null;

  if (!countryText) {
    return `Interest over time for ${keywordText} during the last 10 years.`;
  }

  return `Interest over time for ${keywordText} in ${countryText} during the last 10 years.`;
};

const renderSearchMetrics = (additive: ComparisonAdditive | null) => {
  if (!additive) {
    return null;
  }

  const hasRank = typeof additive.searchRank === 'number';
  const hasVolume = typeof additive.searchVolume === 'number';
  const countryCode = additive.searchHistory?.country;
  const flag = countryCode ? getCountryFlagEmoji(countryCode) : null;
  const countryLabel = countryCode ? getCountryLabel(countryCode) ?? countryCode.toUpperCase() : null;

  if (!hasRank && !hasVolume && !flag) {
    return (
      <Typography variant="body2" color="text.secondary">
        Search metrics are not available.
      </Typography>
    );
  }

  return (
    <Stack direction="row" alignItems="center" spacing={1.5} flexWrap="wrap">
      {hasRank && (
        <Typography component="span" variant="body1" fontWeight={600} sx={{ fontVariantNumeric: 'tabular-nums' }}>
          #{additive.searchRank}
        </Typography>
      )}
      {hasVolume && (
        <Typography component="span" variant="body1" sx={{ fontVariantNumeric: 'tabular-nums' }}>
          {formatMonthlyVolume(additive.searchVolume!)} / mo
        </Typography>
      )}
      {flag && (
        <Typography component="span" variant="body1" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75 }}>
          <Box component="span" role="img" aria-label={countryLabel ?? undefined} sx={{ fontSize: 18 }}>
            {flag}
          </Box>
          {countryLabel}
        </Typography>
      )}
    </Stack>
  );
};

interface SearchHistoryDomain {
  min: number;
  max: number;
}

const renderSearchHistory = (additive: ComparisonAdditive | null, domain?: SearchHistoryDomain | null) => {
  if (!additive) {
    return null;
  }

  const dataset = additive.searchHistory;

  if (!dataset || !Array.isArray(dataset.metrics) || dataset.metrics.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        Search history data is not available.
      </Typography>
    );
  }

  const label = getSearchInterestLabel(dataset);

  return (
    <Stack spacing={2} sx={{ width: '100%' }}>
      <SearchHistoryChart
        metrics={dataset.metrics}
        domain={domain ?? undefined}
      />
      {label && (
        <Typography variant="body2" color="text.secondary" textAlign="center">
          {label}
        </Typography>
      )}
    </Stack>
  );
};

const LARGE_BUTTON_STYLES = {
  fontSize: '1.1rem',
  px: 4,
  py: 1.75,
} as const;

const renderDetailLink = (additive: ComparisonAdditive | null) => {
  if (!additive) {
    return null;
  }

  return (
    <Box sx={{ display: 'flex', justifyContent: 'center' }}>
      <Button
        component={Link}
        href={`/${additive.slug}`}
        variant="contained"
        color="primary"
        sx={LARGE_BUTTON_STYLES}
      >
        Read more
      </Button>
    </Box>
  );
};

const renderArticlePreview = (additive: ComparisonAdditive | null) => {
  if (!additive) {
    return null;
  }

  const { preview, hasMore } = splitArticlePreview(additive.article, 20);

  if (!preview) {
    return (
      <Typography variant="body2" color="text.secondary">
        Article content is not available for this additive.
      </Typography>
    );
  }

  return (
    <Stack spacing={2} sx={{ width: '100%' }}>
      <MarkdownArticle content={preview} />
      {hasMore ? (
        <Typography variant="body2" color="text.secondary">
          Preview truncated. Visit the additive page to read the full article.
        </Typography>
      ) : null}
      <Box sx={{ display: 'flex', justifyContent: 'center' }}>
        <Typography
          component={Link}
          href={`/${additive.slug}`}
          variant="h5"
          sx={{
            color: 'primary.main',
            fontWeight: 600,
            textDecoration: 'none',
            '&:hover': { textDecoration: 'underline' },
          }}
        >
          Read more
        </Typography>
      </Box>
    </Stack>
  );
};

export function AdditiveComparison({ additives, initialSelection, awarenessScores }: AdditiveComparisonProps) {
  const router = useRouter();
  const pathname = usePathname();

  const additiveMap = useMemo(() => new Map(additives.map((additive) => [additive.slug, additive])), [additives]);

  const [initialLeft, initialRight] = initialSelection;

  const [selection, setSelection] = useState<SelectionState>(() => ({
    left: initialLeft ? additiveMap.get(initialLeft) ?? null : null,
    right: initialRight ? additiveMap.get(initialRight) ?? null : null,
  }));

  useEffect(() => {
    setSelection((prev) => {
      const nextLeft = initialLeft ? additiveMap.get(initialLeft) ?? null : null;
      const nextRight = initialRight ? additiveMap.get(initialRight) ?? null : null;

      if (prev.left?.slug === nextLeft?.slug && prev.right?.slug === nextRight?.slug) {
        return prev;
      }

      return {
        left: nextLeft,
        right: nextRight,
      };
    });
  }, [additiveMap, initialLeft, initialRight]);

  useEffect(() => {
    const leftSlug = selection.left?.slug;
    const rightSlug = selection.right?.slug;

    const nextPath = leftSlug && rightSlug ? `/compare/${leftSlug}-vs-${rightSlug}` : '/compare';

    if (pathname !== nextPath) {
      router.replace(nextPath);
    }
  }, [pathname, router, selection.left?.slug, selection.right?.slug]);

  const leftDisplayName = selection.left
    ? formatAdditiveDisplayName(selection.left.eNumber, selection.left.title)
    : null;
  const rightDisplayName = selection.right
    ? formatAdditiveDisplayName(selection.right.eNumber, selection.right.title)
    : null;

  const leftMetrics = selection.left?.searchHistory?.metrics ?? null;
  const rightMetrics = selection.right?.searchHistory?.metrics ?? null;

  const searchHistoryDomain = useMemo<SearchHistoryDomain | null>(() => {
    const metricsSets = [leftMetrics, rightMetrics].filter(
      (metrics): metrics is Array<{ date: string; volume: number }> => Array.isArray(metrics) && metrics.length > 0,
    );

    if (metricsSets.length === 0) {
      return null;
    }

    let maxVolume = 0;

    metricsSets.forEach((metrics) => {
      metrics.forEach((point) => {
        if (typeof point.volume === 'number' && Number.isFinite(point.volume)) {
          maxVolume = Math.max(maxVolume, point.volume);
        }
      });
    });

    const paddedMax = maxVolume > 0 ? maxVolume * 1.05 : 1;

    return {
      min: 0,
      max: paddedMax,
    };
  }, [leftMetrics, rightMetrics]);

  const renderProductMetrics = useCallback(
    (additive: ComparisonAdditive | null) => {
      if (!additive) {
        return null;
      }

      const productCount = typeof additive.productCount === 'number' ? additive.productCount : null;
      const awarenessScore = awarenessScores[additive.slug] ?? null;

      if (productCount === null) {
        return (
          <Stack spacing={1}>
            <Typography variant="body2" color="text.secondary">
              Product data is not available.
            </Typography>
            {awarenessScore ? (
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
              >
                <Box component="span" sx={{ fontWeight: 600 }}>
                  Awareness:
                </Box>
                <AwarenessScoreChip score={awarenessScore} />
              </Typography>
            ) : null}
          </Stack>
        );
      }

      const productLabel = formatProductCount(productCount);

      return (
        <Stack spacing={1}>
          <Typography variant="body1" color="text.secondary" sx={{ fontVariantNumeric: 'tabular-nums' }}>
            Found in <Box component="span" sx={{ fontWeight: 600 }}>
              {productLabel} products
            </Box>
          </Typography>
          {awarenessScore ? (
            <Typography
              variant="body1"
              color="text.secondary"
              sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
            >
              <Box component="span" sx={{ fontWeight: 600 }}>
                Awareness:
              </Box>
              <AwarenessScoreChip score={awarenessScore} />
            </Typography>
          ) : null}
        </Stack>
      );
    },
    [awarenessScores],
  );

  const overviewSummary = (additive: ComparisonAdditive | null) => {
    if (!additive) {
      return null;
    }

    const summary = extractArticleSummary(additive.article) ?? additive.description;

    return (
      <Stack spacing={1.5}>
        <Typography
          component={Link}
          href={`/${additive.slug}`}
          variant="h4"
          sx={{
            color: 'text.primary',
            textDecoration: 'none',
            '&:hover': { textDecoration: 'underline' },
          }}
        >
          {formatAdditiveDisplayName(additive.eNumber, additive.title)}
        </Typography>
        {summary ? (
          <Typography variant="body1" color="text.secondary" whiteSpace="pre-line">
            {summary}
          </Typography>
        ) : null}
      </Stack>
    );
  };

  const sectionItems = [
    {
      key: 'overview',
      label: 'Overview',
      render: overviewSummary,
    },
    {
      key: 'synonyms',
      label: 'Synonyms',
      render: renderSynonymContent,
    },
    {
      key: 'functions',
      label: 'Functions',
      render: renderFunctionContent,
    },
    {
      key: 'origin',
      label: 'Origin',
      render: renderOriginContent,
    },
    {
      key: 'products',
      label: 'Products',
      render: renderProductMetrics,
    },
    {
      key: 'search-metrics',
      label: 'Search rank & volume',
      render: renderSearchMetrics,
    },
    {
      key: 'search-history',
      label: 'Search volume over time',
      render: (additive: ComparisonAdditive | null) => renderSearchHistory(additive, searchHistoryDomain),
    },
    {
      key: 'detail-link',
      label: null,
      render: renderDetailLink,
    },
    {
      key: 'article',
      label: 'Article preview',
      render: renderArticlePreview,
    },
  ];

  const comparisonHeading =
    leftDisplayName && rightDisplayName
      ? `Comparing ${leftDisplayName} vs ${rightDisplayName}`
      : 'Compare additives';

  return (
    <Box component="section" display="flex" flexDirection="column" gap={4}>
      <Box className="page-hero">
        <Box
          className="page-hero-content"
          display="flex"
          flexDirection="column"
          alignItems="center"
          textAlign="center"
          gap={1}
          sx={{ width: '100%', maxWidth: 760, margin: '0 auto' }}
        >
          <Typography
            component="h1"
            variant="h1"
            sx={{ color: 'inherit', whiteSpace: { xs: 'normal', md: 'nowrap' } }}
          >
            {comparisonHeading}
          </Typography>
        </Box>
      </Box>

      <Stack spacing={4}>
      <Box
        sx={{
          display: 'grid',
          gap: { xs: 2, md: 3 },
          gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' },
        }}
      >
        <AdditiveLookup
          additives={additives}
          value={selection.left}
          onChange={(value) => setSelection((prev) => ({ ...prev, left: value }))}
          label="Select first additive"
          placeholder="Type additive to compare"
          disabledSlugs={selection.right ? [selection.right.slug] : undefined}
        />
        <AdditiveLookup
          additives={additives}
          value={selection.right}
          onChange={(value) => setSelection((prev) => ({ ...prev, right: value }))}
          label="Select second additive"
          placeholder="Type additive to compare"
          disabledSlugs={selection.left ? [selection.left.slug] : undefined}
        />
      </Box>

      <Box
        sx={{
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 3,
          backgroundColor: 'background.paper',
          overflow: 'hidden',
        }}
      >
        <Stack spacing={0}>
          {sectionItems.map((section, index) => (
            <Box
              key={section.key}
              sx={{
                display: 'grid',
                gap: { xs: 2, sm: 3 },
                columnGap: { md: 0 },
                gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' },
                alignItems: 'flex-start',
                px: { xs: 2, sm: 3, md: 4 },
                py: { xs: 2.5, sm: 3 },
                borderTop: index === 0 ? 'none' : '1px solid',
                borderColor: 'divider',
                backgroundColor: index % 2 === 0 ? 'grey.50' : 'background.paper',
              }}
            >
              {section.label ? (
                <Typography
                  variant="subtitle2"
                  color="text.secondary"
                  sx={{
                    gridColumn: '1 / -1',
                    textTransform: 'uppercase',
                    letterSpacing: 1,
                  }}
                >
                  {section.label}
                </Typography>
              ) : null}
              <Box
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 1.5,
                  pr: { md: 4 },
                }}
              >
                {section.render(selection.left)}
              </Box>
              <Box
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 1.5,
                  borderLeft: { md: '1px solid' },
                  borderColor: { md: 'divider' },
                  pl: { md: 4 },
                }}
              >
                {section.render(selection.right)}
              </Box>
            </Box>
          ))}
        </Stack>
      </Box>
      </Stack>
    </Box>
  );
}
