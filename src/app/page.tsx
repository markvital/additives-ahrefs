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
  getAwarenessScores,
} from '../lib/additives';
import { formatFilterLabel } from '../lib/text';
import { formatFunctionLabel } from '../lib/additive-format';
import { resolveAwarenessOptionsFromSearchParams } from '../lib/awareness';

const additives = getAdditives();
const functionOptions = getFunctionFilters().map(({ slug, value }) => ({
  slug,
  label: formatFunctionLabel(value),
}));
const originOptions = getOriginFilters().map(({ slug, value }) => ({
  slug,
  label: formatFilterLabel(value),
}));

interface HomePageProps {
  searchParams?: Promise<{
    sort?: string | string[];
    classes?: string | string[];
    awAlpha?: string | string[];
    awLog?: string | string[];
  }>;
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const sortMode = parseAdditiveSortMode(resolvedSearchParams?.sort ?? null);
  const showClasses = parseShowClassesParam(resolvedSearchParams?.classes ?? null);
  const filteredAdditives = filterAdditivesByClassVisibility(additives, showClasses);
  const sortedAdditives = sortAdditivesByMode(filteredAdditives, sortMode);
  const awarenessOptions = resolveAwarenessOptionsFromSearchParams(resolvedSearchParams ?? null);
  const awarenessResult = getAwarenessScores(awarenessOptions);

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
        currentAwarenessAlpha={awarenessResult.alpha}
        currentAwarenessUseLog={awarenessResult.useLog}
      />
      <AdditiveGrid items={sortedAdditives} sortMode={sortMode} awarenessScores={awarenessResult.scores} />
    </Box>
  );
}
