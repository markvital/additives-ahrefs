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
      }}
    >
      <Typography
        component="h2"
        variant="h6"
        sx={{
          textAlign: 'center',
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          fontWeight: 700,
          fontSize: { xs: '0.95rem', md: '1.05rem' },
          color: '#ffffff',
        }}
      >
        Featured Additive
      </Typography>

      <Box
        display="flex"
        flexDirection={{ xs: 'column', md: 'row' }}
        gap={2}
        alignItems="center"
      >
        <Typography
          variant="body1"
          sx={{
            textAlign: { xs: 'center', md: 'left' },
            fontSize: { xs: '1rem', md: '1.1rem' },
            fontWeight: 500,
            lineHeight: 1.4,
            color: '#ffffff',
            flex: { xs: 'none', md: '0 0 auto' },
            maxWidth: { xs: '100%', md: '45%' },
          }}
        >
          {config.description}
        </Typography>

        <FeaturedCard additive={gridItem} awarenessScore={awarenessScore} />
      </Box>
    </Box>
  );
}
