import { Box, Typography } from '@mui/material';

import { getAdditives } from '../lib/additives';
import { AdditiveGrid } from '../components/AdditiveGrid';

const additives = getAdditives();

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

      <AdditiveGrid items={additives} />
    </Box>
  );
}
