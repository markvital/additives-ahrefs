'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Autocomplete,
  Box,
  Button,
  Chip,
  Stack,
  TextField,
  Typography,
  createFilterOptions,
} from '@mui/material';
import type { Additive } from '../lib/additives';
import { formatAdditiveDisplayName, formatOriginLabel } from '../lib/additive-format';
import { extractArticleSummary, splitArticlePreview } from '../lib/article';
import { formatMonthlyVolume, getCountryFlagEmoji, getCountryLabel } from '../lib/format';
import type { SearchHistoryDataset } from '../lib/search-history';
import { MarkdownArticle } from './MarkdownArticle';
import { SearchHistoryChart } from './SearchHistoryChart';

interface ComparisonAdditive extends Additive {
  searchHistory: SearchHistoryDataset | null;
}

interface AdditiveComparisonProps {
  additives: ComparisonAdditive[];
  initialSelection: [string | null, string | null];
}

interface SelectionState {
  left: ComparisonAdditive | null;
  right: ComparisonAdditive | null;
}

const createOptionFilter = createFilterOptions<ComparisonAdditive>({
  stringify: (option) => {
    const synonymString = option.synonyms.join(' ');

    return [option.eNumber, option.title, synonymString].filter(Boolean).join(' ');
  },
});

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
        <Chip key={synonym} label={synonym} variant="outlined" size="small" />
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
        <Chip key={fn} label={fn} variant="outlined" size="small" />
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

  const keyword = dataset.keyword?.trim();
  if (!keyword) {
    return null;
  }

  const countryCode = dataset.country?.trim();
  const flag = countryCode ? getCountryFlagEmoji(countryCode) : null;
  const countryLabel = countryCode ? getCountryLabel(countryCode) ?? countryCode.toUpperCase() : null;
  const countryText = countryLabel ? `${countryLabel}` : null;

  if (!countryText) {
    return `Interest over time for “${keyword}” during the last 10 years.`;
  }

  return `Interest over time for “${keyword}” in ${countryText} during the last 10 years.`;
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

const renderSearchHistory = (additive: ComparisonAdditive | null) => {
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
      <SearchHistoryChart metrics={dataset.metrics} />
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

export function AdditiveComparison({ additives, initialSelection }: AdditiveComparisonProps) {
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
      key: 'search-metrics',
      label: 'Search rank & volume',
      render: renderSearchMetrics,
    },
    {
      key: 'search-history',
      label: 'Search volume over time',
      render: renderSearchHistory,
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

  return (
    <Stack spacing={4}>
      <Typography component="h1" variant="h1">
        {leftDisplayName && rightDisplayName
          ? `Comparing ${leftDisplayName} vs ${rightDisplayName}`
          : 'Compare additives'}
      </Typography>

      <Box
        sx={{
          display: 'grid',
          gap: { xs: 2, md: 3 },
          gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' },
        }}
      >
        <Autocomplete
          options={additives}
          value={selection.left}
          onChange={(_, value) => setSelection((prev) => ({ ...prev, left: value }))}
          getOptionLabel={(option) => formatAdditiveDisplayName(option.eNumber, option.title)}
          filterOptions={createOptionFilter}
          renderInput={(params) => <TextField {...params} label="Select first additive" placeholder="Type additive to compare" />}
          isOptionEqualToValue={(option, value) => option.slug === value.slug}
          getOptionDisabled={(option) => option.slug === selection.right?.slug}
          clearOnBlur={false}
          autoHighlight
        />
        <Autocomplete
          options={additives}
          value={selection.right}
          onChange={(_, value) => setSelection((prev) => ({ ...prev, right: value }))}
          getOptionLabel={(option) => formatAdditiveDisplayName(option.eNumber, option.title)}
          filterOptions={createOptionFilter}
          renderInput={(params) => <TextField {...params} label="Select second additive" placeholder="Type additive to compare" />}
          isOptionEqualToValue={(option, value) => option.slug === value.slug}
          getOptionDisabled={(option) => option.slug === selection.left?.slug}
          clearOnBlur={false}
          autoHighlight
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
  );
}
