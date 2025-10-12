import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Box, Typography } from '@mui/material';

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
import { AdditiveGrid } from '../../../components/AdditiveGrid';
import { FilterPanel } from '../../../components/FilterPanel';

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
  label: formatFilterLabel(value),
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
  const label = formatFilterLabel(functionValue);

  return (
    <Box component="section" display="flex" flexDirection="column" gap={4}>
      <Box display="flex" flexDirection="column" gap={1.5} maxWidth={720}>
        <Typography component="h1" variant="h1">
          Function: {label}
        </Typography>
        <Typography variant="body1" color="text.secondary">
          {formatCountLabel(filteredAdditives.length)}
        </Typography>
      </Box>

      <FilterPanel
        functionOptions={functionOptions}
        originOptions={originOptions}
        currentFunctionSlug={functionSlug}
        currentSortMode={sortMode}
        currentShowClasses={showClasses}
      />
      <AdditiveGrid
        items={sortedAdditives}
        sortMode={sortMode}
        emptyMessage="No additives found for this function."
      />
    </Box>
  );
}
