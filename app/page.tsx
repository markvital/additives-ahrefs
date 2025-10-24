import { Box, Typography } from '@mui/material';

import { AdditiveGrid } from '../components/AdditiveGrid';
import { FilterPanel } from '../components/FilterPanel';
import {
  getAdditives,
  getFunctionFilters,
  getOriginFilters,
  filterAdditivesByClassVisibility,
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
  const filteredAdditives = filterAdditivesByClassVisibility(additives, showClasses);
  const sortedAdditives = sortAdditivesByMode(filteredAdditives, sortMode);

  return (
    <Box component="section" display="flex" flexDirection="column" gap={4}>
      <Box display="flex" flexDirection="column" gap={1.5} maxWidth={720}>
        <Typography component="h1" variant="h1">
          Skin care ingredients
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Explore the hero actives behind modern skin care. Compare their benefits, learn how to pair them,
          and build routines that match your skin goals.
        </Typography>
      </Box>

      <FilterPanel
        functionOptions={functionOptions}
        originOptions={originOptions}
        currentSortMode={sortMode}
        currentShowClasses={showClasses}
      />
      <AdditiveGrid items={sortedAdditives} sortMode={sortMode} />
    </Box>
  );
}
