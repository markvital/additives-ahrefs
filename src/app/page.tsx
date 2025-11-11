import { Suspense } from 'react';
import type { Metadata } from 'next';
import NextLink from 'next/link';
import { Box, Link as MuiLink, Typography } from '@mui/material';

import { AdditiveGridInfinite } from '../components/AdditiveGridInfinite';
import { FilterPanel } from '../components/FilterPanel';
import { FeaturedWidget } from '../components/FeaturedWidget';
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
import { absoluteUrl } from '../lib/site';

const gridSocialImage = absoluteUrl('/img/grid-screenshot.png');
const homePageTitle = 'Food Additives Catalogue';
const homePageDescription =
  'Browse essential information about food additives, including synonyms, functions, and links to additional resources.';

export const metadata: Metadata = {
  title: homePageTitle,
  description: homePageDescription,
  openGraph: {
    title: homePageTitle,
    description: homePageDescription,
    images: [
      {
        url: gridSocialImage,
        alt: 'Screenshot of the food additives grid.',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: homePageTitle,
    description: homePageDescription,
    images: [gridSocialImage],
  },
};

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

const highlightNumberSx = { fontWeight: 600, color: '#ffffff' } as const;

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

  const formattedTopFunctions = topFunctions.map(({ slug, label, count }) => {
    const lowerLabel = label.toLowerCase();
    const pluralLabel = lowerLabel.endsWith('s') ? lowerLabel : `${lowerLabel}s`;

    return {
      slug,
      count,
      pluralLabel,
      summary: `${numberFormatter.format(count)} ${pluralLabel}`,
    };
  });

  const exploreSummary = formattedTopFunctions.map(({ summary }) => summary).join(', ');

  return (
    <Box component="section" display="flex" flexDirection="column" gap={4}>
      <Box className="page-hero">
        <Box
          className="page-hero-content homepage-hero-content"
          display="flex"
          flexDirection={{ xs: 'column', md: 'row' }}
          gap={{ xs: 3, md: '30px', lg: '30px' }}
          alignItems={{ xs: 'flex-start', md: 'stretch' }}
        >
          <Box
            flex={{ md: 1 }}
            display="flex"
            flexDirection="column"
            gap={2}
          >
            <Typography
              component="h1"
              variant="h1"
              sx={{ display: { xs: 'block', md: 'none' }, textAlign: { xs: 'center', md: 'left' } }}
            >
              Food additives
            </Typography>
            <Typography
              component="h2"
              variant="h3"
              sx={{
                fontWeight: 700,
                fontSize: { xs: '1.5rem', md: '1.75rem' },
                lineHeight: 1.3,
                color: '#ffffff',
                mb: 1,
              }}
            >
              Compare additives. Raise awareness.
            </Typography>
            <Typography
              variant="body1"
              className="page-hero-subtitle"
              sx={{ fontSize: { xs: '1.05rem', md: '1.15rem' } }}
            >
              Discover data on{' '}
              <Box component="span" sx={highlightNumberSx}>
                {numberFormatter.format(additiveCount)}
              </Box>{' '}
              additives—built from{' '}
              <Box component="span" sx={highlightNumberSx}>
                {numberFormatter.format(817_713)}
              </Box>{' '}
              products and{' '}
              <Box component="span" sx={highlightNumberSx}>
                {numberFormatter.format(keywordCount)}
              </Box>{' '}
              U.S. keywords (
              <MuiLink
                component={NextLink}
                href="https://ahrefs.com"
                target="_blank"
                rel="noopener noreferrer"
                underline="hover"
                sx={{
                  fontWeight: 550,
                  color: '#ffffff',
                  textDecorationColor: 'rgba(255, 255, 255, 0.7)',
                  '&:hover': {
                    color: '#ffffff',
                    textDecorationColor: '#ffffff',
                  },
                }}
              >
                Ahrefs
              </MuiLink>
              &apos; <Box component="span" sx={highlightNumberSx}>
                28B+
              </Box>{' '}
              database).
            </Typography>
          </Box>
          <Box
            flex={{ md: 1 }}
            width="100%"
            display={{ xs: 'none', md: 'flex' }}
            alignItems="flex-end"
            flexDirection="column"
          >
            <FeaturedWidget />
          </Box>
        </Box>

        <Box display={{ xs: 'flex', md: 'none' }} sx={{ mt: '40px', alignItems: 'flex-start' }}>
          <FeaturedWidget />
        </Box>
      </Box>

      <Box className="page-hero" sx={{ display: { xs: 'none', md: 'none' } }}>
        <Box className="page-hero-content">
          <Box flex={{ md: '0 0 33.3333%' }} maxWidth={{ md: '33.3333%' }} width="100%">
            <Box
              display={{ xs: 'none', md: 'flex' }}
              flexDirection="row"
              alignItems="stretch"
              justifyContent="space-between"
              gap={2.5}
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
                  fontSize: { md: '1.05rem' },
                  color: '#ffffff',
                  '&:hover': { color: 'rgba(255, 255, 255, 0.85)' },
                }}
              >
                Explore
              </MuiLink>
              <Box display="flex" flexDirection="column" gap={0.5} flex={1} minWidth={0}>
                {formattedTopFunctions.map(({ slug, count, pluralLabel }) => (
                  <MuiLink
                    key={slug}
                    component={NextLink}
                    href={functionsHref}
                    underline="none"
                    sx={{
                      display: 'inline-flex',
                      alignItems: 'baseline',
                      gap: 1,
                      color: '#ffffff',
                      fontWeight: 600,
                      '&:hover': { color: 'rgba(255, 255, 255, 0.85)' },
                    }}
                  >
                    <Typography
                      component="span"
                      variant="h6"
                      sx={{ fontWeight: 700, lineHeight: 1.1, color: 'inherit' }}
                    >
                      {numberFormatter.format(count)}
                    </Typography>
                    <Typography
                      component="span"
                      variant="body1"
                      sx={{ fontWeight: 500, lineHeight: 1.1, color: 'inherit' }}
                    >
                      {pluralLabel}
                    </Typography>
                  </MuiLink>
                ))}
                <MuiLink
                  component={NextLink}
                  href={functionsHref}
                  underline="none"
                  className="explore-more-text"
                  sx={{ fontWeight: 600, color: '#ffffff', '&:hover': { color: 'rgba(255, 255, 255, 0.85)' } }}
                >
                  and more
                </MuiLink>
              </Box>
            </Box>

            <MuiLink
              component={NextLink}
              href={functionsHref}
              underline="none"
              sx={{
                display: { xs: 'flex', md: 'none' },
                alignItems: 'center',
                gap: 1,
                width: '100%',
                color: '#ffffff',
                textTransform: 'none',
                '&:hover': { color: 'rgba(255, 255, 255, 0.85)' },
              }}
            >
              <Typography
                component="span"
                sx={{
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  flexShrink: 0,
                }}
              >
                Explore
              </Typography>
              <Typography
                component="span"
                sx={{
                  fontWeight: 600,
                  letterSpacing: 'normal',
                  textTransform: 'none',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  color: 'inherit',
                  flex: 1,
                }}
              >
                {exploreSummary ? `${exploreSummary} and more` : 'Discover more'}
              </Typography>
            </MuiLink>
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
