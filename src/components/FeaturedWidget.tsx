import { Box, Typography } from '@mui/material';

import { FeaturedCard } from './FeaturedCard';
import { getFeaturedConfig } from '../lib/featured';
import { getAdditiveBySlug, toAdditiveGridItem, getAwarenessScores } from '../lib/additives';

export function FeaturedWidget() {
  const config = getFeaturedConfig();

  if (!config) {
    return null;
  }

  const additive = getAdditiveBySlug(config.featuredSlug);

  if (!additive) {
    return null;
  }

  const gridItem = toAdditiveGridItem(additive);
  const awarenessResult = getAwarenessScores();
  const awarenessScore = awarenessResult.scores.get(additive.slug) ?? additive.awarenessScore ?? null;

  return (
    <Box
      display="flex"
      flexDirection="column"
      gap={2}
      sx={{
        width: '100%',
        maxWidth: { xs: '460px', lg: '460px' },
      }}
    >
      <Typography
        component="h2"
        sx={{
          textAlign: { xs: 'left', md: 'center' },
          fontWeight: 700,
          fontSize: { xs: '1.5rem', md: '1.75rem' },
          lineHeight: 1.3,
          color: '#ffffff',
          mb: 1,
        }}
      >
        Featured Additive
      </Typography>

      <Box
        display="flex"
        flexDirection={{ xs: 'column', sm: 'column', md: 'column', lg: 'row' }}
        gap="10px"
        alignItems={{ xs: 'flex-start', sm: 'flex-start', md: 'flex-end', lg: 'flex-start' }}
        justifyContent="space-between"
      >
        <Typography
          variant="body1"
          sx={{
            textAlign: 'left',
            fontSize: '1rem',
            fontWeight: 400,
            lineHeight: 1.4,
            color: '#ffffff',
            flex: { xs: 'none', sm: 'none', md: 'none', lg: '1' },
            maxWidth: { xs: '100%', sm: '100%', md: '100%', lg: '240px' },
          }}
        >
          {config.description}
        </Typography>

        <Box sx={{ flex: 'none' }}>
          <FeaturedCard additive={gridItem} awarenessScore={awarenessScore} />
        </Box>
      </Box>
    </Box>
  );
}
