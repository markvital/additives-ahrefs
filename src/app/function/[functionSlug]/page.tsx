import { Suspense } from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import NextLink from 'next/link';
import { Box, Link as MuiLink, Typography } from '@mui/material';

import {
  getAdditivesByFunctionSlug,
  getFunctionFilters,
  getOriginFilters,
  getFunctionValueBySlug,
  filterAdditivesByClassVisibility,
  DEFAULT_ADDITIVE_SORT_MODE,
  sortAdditivesByMode,
  mapAdditivesToGridItems,
  getAwarenessScores,
} from '../../../lib/additives';
import { formatFilterLabel } from '../../../lib/text';
import { formatFunctionLabel } from '../../../lib/additive-format';
import { getFunctionInfo, formatUsedAsList } from '../../../lib/function-details';
import { AdditiveGridInfinite } from '../../../components/AdditiveGridInfinite';
import { FilterPanel } from '../../../components/FilterPanel';
import { buildShowClassesHref } from '../../../lib/url';
import { ReportMistakeName } from '../../../components/ReportMistakeContext';
import { absoluteUrl } from '../../../lib/site';
import { trimDescription, trimTitle } from '../../../lib/seo';

const gridSocialImage = absoluteUrl('/img/grid-screenshot.png');

interface FunctionPageProps {
  params: Promise<{ functionSlug: string }>;
}

const formatCountLabel = (count: number): string =>
  count === 1 ? '1 additive uses this function.' : `${count} additives use this function.`;

const functionFilters = getFunctionFilters();
const originFilters = getOriginFilters();

const functionOptions = functionFilters.map(({ slug, value }) => ({
  slug,
  label: formatFunctionLabel(value),
}));
const originOptions = originFilters.map(({ slug, value }) => ({
  slug,
  label: formatFilterLabel(value),
}));

export const dynamic = 'force-static';
export const revalidate = 86400;

export async function generateStaticParams() {
  return functionFilters.map(({ slug }) => ({ functionSlug: slug }));
}

export async function generateMetadata({ params }: FunctionPageProps): Promise<Metadata> {
  const { functionSlug } = await params;
  const functionValue = getFunctionValueBySlug(functionSlug);

  if (!functionValue) {
    return {
      title: 'Function not found',
    };
  }

  const label = formatFilterLabel(functionValue);
  const title = `${label} food additives`;
  const functionInfo = getFunctionInfo(functionValue);
  const description =
    functionInfo?.description ?? `Browse food additives that function as ${functionValue}.`;
  const canonical = `/function/${functionSlug}`;
  const trimmedTitle = trimTitle(title);
  const trimmedDescription = trimDescription(description);

  return {
    title: trimmedTitle,
    description: trimmedDescription,
    alternates: {
      canonical,
    },
    openGraph: {
      title: trimmedTitle,
      description: trimmedDescription,
      url: absoluteUrl(canonical),
      type: 'website',
      images: [
        {
          url: gridSocialImage,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: trimmedTitle,
      description: trimmedDescription,
      images: [gridSocialImage],
    },
  };
}

export default async function FunctionPage({ params }: FunctionPageProps) {
  const { functionSlug } = await params;
  const functionValue = getFunctionValueBySlug(functionSlug);

  if (!functionValue) {
    notFound();
  }

  const additives = getAdditivesByFunctionSlug(functionSlug);
  const initialSortMode = DEFAULT_ADDITIVE_SORT_MODE;
  const initialShowClasses = false;
  const filteredAdditives = filterAdditivesByClassVisibility(additives, initialShowClasses);
  const sortedAdditives = sortAdditivesByMode(filteredAdditives, initialSortMode);
  const awarenessResult = getAwarenessScores();
  const hiddenAdditivesCount = additives.length - filteredAdditives.length;
  const showHiddenCountLink = hiddenAdditivesCount > 0;
  const hiddenAdditivesHref = showHiddenCountLink
    ? buildShowClassesHref(`/function/${functionSlug}`, undefined)
    : null;
  const functionLabelRaw = formatFunctionLabel(functionValue);
  const functionHeading = functionLabelRaw
    ? functionLabelRaw.charAt(0).toUpperCase() + functionLabelRaw.slice(1)
    : formatFilterLabel(functionValue);
  const functionInfo = getFunctionInfo(functionValue);
  const reportMistakeName = functionHeading ? `Function - ${functionHeading}` : null;
  const usedAsLine =
    functionInfo && functionInfo.usedAs.length > 0
      ? `In the food industry, such additives serve roles as ${formatUsedAsList(functionInfo.usedAs)}.`
      : null;
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
            <Typography
              component="h1"
              variant="h1"
              sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
            >
              <Box
                component={NextLink}
                href="/function"
                sx={{
                  color: 'inherit',
                  textDecoration: 'none',
                  '&:hover': { textDecoration: 'underline' },
                  '&:focus-visible': { textDecoration: 'underline' },
                }}
              >
                Function
              </Box>
              <Box component="span" aria-hidden="true">
                &gt;
              </Box>
              {functionHeading}
            </Typography>
            {functionInfo?.description ? (
              <Typography variant="body1" className="page-hero-subtitle">
                {functionInfo.description}
              </Typography>
            ) : null}
            {usedAsLine ? (
              <Typography variant="body1" className="page-hero-subtitle">
                {usedAsLine}
              </Typography>
            ) : null}
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
            currentFilter={{ type: 'function', slug: functionSlug }}
            currentSortMode={initialSortMode}
            currentShowClasses={initialShowClasses}
          />
        </Suspense>
        <AdditiveGridInfinite
          initialItems={initialItems}
          totalCount={totalCount}
          initialSortMode={initialSortMode}
          initialShowClasses={initialShowClasses}
          chunkSize={chunkSize}
          filter={{ type: 'function', slug: functionSlug }}
          awarenessScores={awarenessResult.scores}
        />
      </Box>
    </>
  );
}
