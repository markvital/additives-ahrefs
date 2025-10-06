import { Box, Typography } from '@mui/material';

import { AdditiveGrid } from '../components/AdditiveGrid';
import { FilterPanel } from '../components/FilterPanel';
import { getAdditives, getFunctionFilters, getOriginFilters } from '../lib/additives';
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

export default function HomePage() {
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

      <FilterPanel functionOptions={functionOptions} originOptions={originOptions} />
      <AdditiveGrid items={additives} />
    </Box>
  );
}
