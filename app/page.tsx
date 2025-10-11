import { Box, Typography } from '@mui/material';

import { AdditiveGrid } from '../components/AdditiveGrid';
import { FilterPanel } from '../components/FilterPanel';
import {
  filterAdditivesByClassVisibility,
  getAdditives,
  getFunctionFilters,
  getOriginFilters,
  parseAdditiveSortMode,
  parseShowClassesParam,
  sortAdditivesByMode,
} from '../lib/additives';
import { formatFilterLabel } from '../lib/text';

const additives = getAdditives();
const functionOptions = getFunctionFilters().map(({ slug, value }) => ({
  slug,
  label: formatFilterLabel(value),
}));
const originOptions = getOriginFilters().map(({ slug, value }) => ({
  slug,
  label: formatFilterLabel(value),
}));

interface HomePageProps {
  searchParams?: Promise<{ sort?: string | string[]; classes?: string | string[] }>;
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const sortMode = parseAdditiveSortMode(resolvedSearchParams?.sort ?? null);
  const showClasses = parseShowClassesParam(resolvedSearchParams?.classes ?? null);
  const sortedAdditives = sortAdditivesByMode(additives, sortMode);
  const visibleAdditives = filterAdditivesByClassVisibility(sortedAdditives, showClasses);

  return (
    <Box component="section" display="flex" flexDirection="column" gap={4}>
      <Box display="flex" flexDirection="column" gap={1.5} maxWidth={720}>
        <Typography component="h1" variant="h1">
          Food additives
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Explore the essential information behind common food additives. Compare their purposes and quickly
          access in-depth resources to make informed decisions about what goes into your food.
        </Typography>
      </Box>

      <FilterPanel
        functionOptions={functionOptions}
        originOptions={originOptions}
        currentSortMode={sortMode}
        currentShowClasses={showClasses}
      />
      <AdditiveGrid items={visibleAdditives} sortMode={sortMode} />
    </Box>
  );
}
