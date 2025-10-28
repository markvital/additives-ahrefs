import { Suspense } from 'react';
import NextLink from 'next/link';
import { Box, Link as MuiLink, Typography } from '@mui/material';

import { AdditiveGridInfinite } from '../components/AdditiveGridInfinite';
import { FilterPanel } from '../components/FilterPanel';
import {
  getAdditives,
  getFunctionFilters,
  getOriginFilters,
  filterAdditivesByClassVisibility,
  getFunctionSlug,
  parseAdditiveSortMode,
  parseShowClassesParam,
  sortAdditivesByMode,
  mapAdditivesToGridItems,
  getAwarenessScores,
} from '../lib/additives';
import { formatFilterLabel } from '../lib/text';
import { formatFunctionLabel } from '../lib/additive-format';
import { getSearchVolumeDataset } from '../lib/search-volume';

const additives = getAdditives();
const functionFilters = getFunctionFilters();
const functionOptions = functionFilters.map(({ slug, value }) => ({
  slug,
  label: formatFunctionLabel(value),
}));
const originOptions = getOriginFilters().map(({ slug, value }) => ({
  slug,
  label: formatFilterLabel(value),
}));

const numberFormatter = new Intl.NumberFormat('en-US');

const additiveCount = additives.length;

const keywordCount = (() => {
  const uniqueKeywords = new Set<string>();

  additives.forEach((additive) => {
    const dataset = getSearchVolumeDataset(additive.slug);

    dataset?.keywords.forEach(({ keyword }) => {
      const normalized = keyword.trim().toLowerCase();

      if (normalized) {
        uniqueKeywords.add(normalized);
      }
    });
  });

  return uniqueKeywords.size;
})();

const functionLabelMap = new Map<string, string>();
functionOptions.forEach(({ slug, label }) => {
  functionLabelMap.set(slug, label);
});

const functionCountMap = new Map<string, number>();

additives.forEach((additive) => {
  additive.functions.forEach((value) => {
    const slug = getFunctionSlug(value);

    if (!slug) {
      return;
    }

    functionCountMap.set(slug, (functionCountMap.get(slug) ?? 0) + 1);
  });
});

const topFunctions = Array.from(functionCountMap.entries())
  .map(([slug, count]) => ({
    slug,
    count,
    label: functionLabelMap.get(slug) ?? slug,
  }))
  .filter((entry) => entry.count > 0)
  .sort((a, b) => {
    if (a.count !== b.count) {
      return b.count - a.count;
    }

    return a.label.localeCompare(b.label);
  })
  .slice(0, 2);

const functionsHref = '/function';

const highlightNumberSx = { fontWeight: 700, color: 'text.primary' } as const;

interface HomePageProps {
  searchParams?: Promise<{
    sort?: string | string[];
    classes?: string | string[];
  }>;
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const sortMode = parseAdditiveSortMode(resolvedSearchParams?.sort ?? null);
  const showClasses = parseShowClassesParam(resolvedSearchParams?.classes ?? null);
  const filteredAdditives = filterAdditivesByClassVisibility(additives, showClasses);
  const sortedAdditives = sortAdditivesByMode(filteredAdditives, sortMode);
  const chunkSize = 50;
  const totalCount = sortedAdditives.length;
  const awarenessResult = getAwarenessScores();
  const initialItems = mapAdditivesToGridItems(sortedAdditives.slice(0, chunkSize));

  return (
    <Box component="section" display="flex" flexDirection="column" gap={4}>
      <Box
        display="flex"
        flexDirection={{ xs: 'column', md: 'row' }}
        gap={{ xs: 3, md: 6 }}
        alignItems={{ xs: 'flex-start', md: 'stretch' }}
      >
        <Box
          flex={{ md: '0 0 66.6667%' }}
          maxWidth={{ md: '66.6667%' }}
          display="flex"
          flexDirection="column"
          gap={2}
        >
          <Typography component="h1" variant="h1" sx={{ display: { xs: 'block', md: 'none' } }}>
            Food additives
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ fontSize: { xs: '1.05rem', md: '1.15rem' } }}>
            Compare data on{' '}
            <Box component="span" sx={highlightNumberSx}>
              {numberFormatter.format(additiveCount)}
            </Box>{' '}
            common food additives we found after analyzing{' '}
            <Box component="span" sx={highlightNumberSx}>
              {numberFormatter.format(817_713)}
            </Box>{' '}
            products from OFF and{' '}
            <Box component="span" sx={highlightNumberSx}>
              {numberFormatter.format(keywordCount)}
            </Box>{' '}
            keywords in the U.S. from{' '}
            <Box component="span" sx={highlightNumberSx}>
              28+ billion
            </Box>{' '}
            keywords via{' '}
            <MuiLink
              component={NextLink}
              href="https://ahrefs.com"
              target="_blank"
              rel="noopener noreferrer"
              underline="hover"
              sx={{ fontWeight: 600 }}
            >
              Ahrefs
            </MuiLink>
            .
          </Typography>
        </Box>
        <Box flex={{ md: '0 0 33.3333%' }} maxWidth={{ md: '33.3333%' }} width="100%">
          <Box
            display="flex"
            flexDirection={{ xs: 'column', md: 'row' }}
            alignItems={{ xs: 'flex-start', md: 'stretch' }}
            justifyContent={{ md: 'space-between' }}
            gap={{ xs: 1.5, md: 2.5 }}
            width="100%"
          >
            <MuiLink
              component={NextLink}
              href={functionsHref}
              underline="none"
              sx={{
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                fontWeight: 700,
                fontSize: { xs: '1rem', md: '1.05rem' },
                textAlign: { xs: 'left', md: 'right' },
                color: 'text.primary',
                '&:hover': { color: 'primary.main' },
              }}
            >
              Explore
            </MuiLink>
            <Box display="flex" flexDirection="column" gap={0.5} flex={1} minWidth={0}>
              {topFunctions.map(({ slug, label, count }) => {
                const lowerLabel = label.toLowerCase();
                const pluralLabel = lowerLabel.endsWith('s') ? lowerLabel : `${lowerLabel}s`;

                return (
                  <MuiLink
                    key={slug}
                    component={NextLink}
                    href={functionsHref}
                    underline="none"
                    sx={{
                      display: 'inline-flex',
                      alignItems: 'baseline',
                      gap: 1,
                      color: 'text.primary',
                      fontWeight: 600,
                      '&:hover': { color: 'primary.main' },
                    }}
                  >
                    <Typography component="span" variant="h6" sx={{ fontWeight: 700, lineHeight: 1.1 }}>
                      {numberFormatter.format(count)}
                    </Typography>
                    <Typography component="span" variant="body1" sx={{ fontWeight: 500, lineHeight: 1.1 }}>
                      {pluralLabel}
                    </Typography>
                  </MuiLink>
                );
              })}
              <MuiLink
                component={NextLink}
                href={functionsHref}
                underline="none"
                className="explore-more-text"
                sx={{ fontWeight: 600, '&:hover': { color: 'primary.main' } }}
              >
                and more
              </MuiLink>
            </Box>
          </Box>
        </Box>
      </Box>

      <Suspense fallback={null}>
        <FilterPanel
          functionOptions={functionOptions}
          originOptions={originOptions}
          currentSortMode={sortMode}
          currentShowClasses={showClasses}
        />
      </Suspense>
      <AdditiveGridInfinite
        initialItems={initialItems}
        totalCount={totalCount}
        sortMode={sortMode}
        showClasses={showClasses}
        chunkSize={chunkSize}
        awarenessScores={awarenessResult.scores}
      />
    </Box>
  );
}
