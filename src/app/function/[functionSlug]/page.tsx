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
  parseAdditiveSortMode,
  parseShowClassesParam,
  sortAdditivesByMode,
} from '../../../lib/additives';
import { formatFilterLabel } from '../../../lib/text';
import { formatFunctionLabel } from '../../../lib/additive-format';
import { getFunctionInfo, formatUsedAsList } from '../../../lib/function-details';
import { AdditiveGrid } from '../../../components/AdditiveGrid';
import { FilterPanel } from '../../../components/FilterPanel';
import { buildShowClassesHref } from '../../../lib/url';
import { ReportMistakeName } from '../../../components/ReportMistakeContext';

interface FunctionPageProps {
  params: Promise<{ functionSlug: string }>;
  searchParams?: Promise<{ sort?: string | string[]; classes?: string | string[] }>;
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

  return {
    title: `${label} food additives`,
    description: `Browse food additives that function as ${functionValue}.`,
    alternates: {
      canonical: `/function/${functionSlug}`,
    },
  };
}

export default async function FunctionPage({ params, searchParams }: FunctionPageProps) {
  const { functionSlug } = await params;
  const functionValue = getFunctionValueBySlug(functionSlug);

  if (!functionValue) {
    notFound();
  }

  const additives = getAdditivesByFunctionSlug(functionSlug);
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const sortMode = parseAdditiveSortMode(resolvedSearchParams?.sort ?? null);
  const showClasses = parseShowClassesParam(resolvedSearchParams?.classes ?? null);
  const filteredAdditives = filterAdditivesByClassVisibility(additives, showClasses);
  const sortedAdditives = sortAdditivesByMode(filteredAdditives, sortMode);
  const hiddenAdditivesCount = showClasses ? 0 : additives.length - filteredAdditives.length;
  const showHiddenCountLink = hiddenAdditivesCount > 0 && !showClasses;
  const hiddenAdditivesHref = showHiddenCountLink
    ? buildShowClassesHref(`/function/${functionSlug}`, resolvedSearchParams)
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

  return (
    <>
      <ReportMistakeName value={reportMistakeName} />
      <Box component="section" display="flex" flexDirection="column" gap={4}>
        <Box display="flex" flexDirection="column" gap={1.5} maxWidth={720}>
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
          <Typography variant="body1" color="text.secondary">
            {functionInfo.description}
          </Typography>
        ) : null}
        {usedAsLine ? (
          <Typography variant="body1" color="text.secondary">
            {usedAsLine}
          </Typography>
        ) : null}
        <Typography variant="body1" color="text.secondary">
          {showHiddenCountLink && hiddenAdditivesHref ? (
            <>
              {formatCountLabel(filteredAdditives.length).replace(/\.$/, '')}
              {' ('}
              <MuiLink
                component={NextLink}
                href={hiddenAdditivesHref}
                color="text.secondary"
                underline="hover"
                sx={{ fontWeight: 500 }}
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

      <FilterPanel
        functionOptions={functionOptions}
        originOptions={originOptions}
        currentFilter={{ type: 'function', slug: functionSlug }}
        currentSortMode={sortMode}
        currentShowClasses={showClasses}
      />
      <AdditiveGrid
        items={sortedAdditives}
        sortMode={sortMode}
        emptyMessage="No additives found for this function."
      />
    </Box>
    </>
  );
}
