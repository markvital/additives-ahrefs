import { Suspense } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import NextLink from 'next/link';
import { Box, Link as MuiLink, Typography } from '@mui/material';

import {
  getAdditivesByOriginSlug,
  getFunctionFilters,
  getOriginFilters,
  getOriginValueBySlug,
  filterAdditivesByClassVisibility,
  parseAdditiveSortMode,
  parseShowClassesParam,
  sortAdditivesByMode,
  mapAdditivesToGridItems,
  getAwarenessScores,
} from '../../../lib/additives';
import { formatFilterLabel } from '../../../lib/text';
import { getOriginHeroIcon } from '../../../lib/origin-icons';
import { getOriginDescription } from '../../../lib/origins';
import { AdditiveGrid } from '../../../components/AdditiveGrid';
import { AdditiveGridInfinite } from '../../../components/AdditiveGridInfinite';
import { FilterPanel } from '../../../components/FilterPanel';
import { buildShowClassesHref } from '../../../lib/url';
import { ReportMistakeName } from '../../../components/ReportMistakeContext';
import { absoluteUrl } from '../../../lib/site';

const gridSocialImage = absoluteUrl('/img/grid-screenshot.png');

interface OriginPageProps {
  params: Promise<{ originSlug: string }>;
  searchParams?: Promise<{
    sort?: string | string[];
    classes?: string | string[];
  }>;
}

const formatCountLabel = (count: number): string =>
  count === 1 ? '1 additive has this origin.' : `${count} additives have this origin.`;

const originFilters = getOriginFilters();
const functionFilters = getFunctionFilters();

const originOptions = originFilters.map(({ slug, value }) => ({
  slug,
  label: formatFilterLabel(value),
}));
const functionOptions = functionFilters.map(({ slug, value }) => ({
  slug,
  label: formatFilterLabel(value),
}));

export async function generateStaticParams() {
  return originFilters.map(({ slug }) => ({ originSlug: slug }));
}

export async function generateMetadata({ params }: OriginPageProps): Promise<Metadata> {
  const { originSlug } = await params;
  const originValue = getOriginValueBySlug(originSlug);

  if (!originValue) {
    return {
      title: 'Origin not found',
    };
  }

  const label = formatFilterLabel(originValue);
  const title = `${label} origin additives`;
  const originDescription = getOriginDescription(originSlug);
  const description =
    originDescription ?? `Explore food additives that originate from ${originValue}.`;
  const canonical = `/origin/${originSlug}`;

  return {
    title,
    description,
    alternates: {
      canonical,
    },
    openGraph: {
      title,
      description,
      url: absoluteUrl(canonical),
      images: [
        {
          url: gridSocialImage,
          alt: 'Screenshot of the food additives grid.',
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [gridSocialImage],
    },
  };
}

export default async function OriginPage({ params, searchParams }: OriginPageProps) {
  const { originSlug } = await params;
  const originValue = getOriginValueBySlug(originSlug);

  if (!originValue) {
    notFound();
  }

  const additives = getAdditivesByOriginSlug(originSlug);
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const sortMode = parseAdditiveSortMode(resolvedSearchParams?.sort ?? null);
  const showClasses = parseShowClassesParam(resolvedSearchParams?.classes ?? null);
  const filteredAdditives = filterAdditivesByClassVisibility(additives, showClasses);
  const sortedAdditives = sortAdditivesByMode(filteredAdditives, sortMode);
  const awarenessResult = getAwarenessScores();
  const hiddenAdditivesCount = showClasses ? 0 : additives.length - filteredAdditives.length;
  const showHiddenCountLink = hiddenAdditivesCount > 0 && !showClasses;
  const hiddenAdditivesHref = showHiddenCountLink
    ? buildShowClassesHref(`/origin/${originSlug}`, resolvedSearchParams)
    : null;
  const label = formatFilterLabel(originValue);
  const reportMistakeName = label ? `Origin - ${label}` : null;
  const originDescription =
    getOriginDescription(originSlug) ?? getOriginDescription(originValue);
  const originHeroIcon =
    getOriginHeroIcon(originValue) ?? getOriginHeroIcon(originSlug) ?? null;
  const chunkSize = 100;
  const totalCount = sortedAdditives.length;
  const useInfiniteScroll = totalCount > chunkSize;
  const initialItems = mapAdditivesToGridItems(
    sortedAdditives.slice(0, useInfiniteScroll ? chunkSize : totalCount),
  );

  return (
    <>
      <ReportMistakeName value={reportMistakeName} />
      <Box component="section" display="flex" flexDirection="column" gap={4}>
        <Box className="page-hero">
          <Box className="page-hero-content" display="flex" flexDirection="column" gap={1.5} maxWidth={720}>
            <Box display="flex" alignItems="center" gap={2}>
              {originHeroIcon && (
                <Image
                  src={originHeroIcon}
                  alt={`${label} origin icon`}
                  width={128}
                  height={128}
                  style={{ height: 40, width: 'auto' }}
                  priority
                />
              )}
              <Typography
                component="h1"
                variant="h1"
                sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
              >
                <Box
                  component={Link}
                  href="/origin"
                  sx={{
                    color: 'inherit',
                    textDecoration: 'none',
                    '&:hover': { textDecoration: 'underline' },
                    '&:focus-visible': { textDecoration: 'underline' },
                  }}
                >
                  Origin
                </Box>
                <Box component="span" aria-hidden="true">
                  &gt;
                </Box>
                {label}
              </Typography>
            </Box>
            {originDescription && (
              <Typography variant="body1" className="page-hero-subtitle">
                {originDescription}
              </Typography>
            )}
            <Typography variant="body1" className="page-hero-subtitle">
              {showHiddenCountLink && hiddenAdditivesHref ? (
                <>
                  {formatCountLabel(filteredAdditives.length).replace(/\.$/, '')}
                  {' ('}
                  <MuiLink
                    component={NextLink}
                    href={hiddenAdditivesHref}
                    underline="hover"
                    sx={{ fontWeight: 500, color: 'inherit' }}
                  >
                    +{hiddenAdditivesCount} hidden
                  </MuiLink>
                  {')'}
                </>
              ) : (
                formatCountLabel(filteredAdditives.length)
              )}
            </Typography>
          </Box>
        </Box>

        <Suspense fallback={null}>
          <FilterPanel
            functionOptions={functionOptions}
            originOptions={originOptions}
            currentFilter={{ type: 'origin', slug: originSlug }}
            currentSortMode={sortMode}
            currentShowClasses={showClasses}
          />
        </Suspense>
        {useInfiniteScroll ? (
          <AdditiveGridInfinite
            initialItems={initialItems}
            totalCount={totalCount}
            sortMode={sortMode}
            showClasses={showClasses}
            chunkSize={chunkSize}
            filter={{ type: 'origin', slug: originSlug }}
            awarenessScores={awarenessResult.scores}
          />
        ) : (
          <AdditiveGrid
            items={initialItems}
            sortMode={sortMode}
            emptyMessage="No additives found for this origin."
            awarenessScores={awarenessResult.scores}
          />
        )}
      </Box>
    </>
  );
}
