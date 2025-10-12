import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Box, Typography } from '@mui/material';

import {
  getAdditivesByOriginSlug,
  getFunctionFilters,
  getOriginFilters,
  getOriginValueBySlug,
  filterAdditivesByClassVisibility,
  parseAdditiveSortMode,
  parseShowClassesParam,
  sortAdditivesByMode,
} from '../../../lib/additives';
import { formatFilterLabel } from '../../../lib/text';
import { AdditiveGrid } from '../../../components/AdditiveGrid';
import { FilterPanel } from '../../../components/FilterPanel';

interface OriginPageProps {
  params: Promise<{ originSlug: string }>;
  searchParams?: Promise<{ sort?: string | string[]; classes?: string | string[] }>;
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

  return {
    title: `${label} origin additives`,
    description: `Explore food additives that originate from ${originValue}.`,
    alternates: {
      canonical: `/origin/${originSlug}`,
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
  const label = formatFilterLabel(originValue);

  return (
    <Box component="section" display="flex" flexDirection="column" gap={4}>
      <Box display="flex" flexDirection="column" gap={1.5} maxWidth={720}>
        <Typography component="h1" variant="h1">
          Origin: {label}
        </Typography>
        <Typography variant="body1" color="text.secondary">
          {formatCountLabel(filteredAdditives.length)}
        </Typography>
      </Box>

      <FilterPanel
        functionOptions={functionOptions}
        originOptions={originOptions}
        currentOriginSlug={originSlug}
        currentSortMode={sortMode}
        currentShowClasses={showClasses}
      />
      <AdditiveGrid
        items={sortedAdditives}
        sortMode={sortMode}
        emptyMessage="No additives found for this origin."
      />
    </Box>
  );
}
