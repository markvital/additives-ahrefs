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
        maxWidth: { sm: '460px' },
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
        flexDirection={{ xs: 'column', sm: 'row' }}
        gap="10px"
        alignItems={{ xs: 'center', sm: 'flex-start' }}
        justifyContent="space-between"
      >
        <Typography
          variant="body1"
          sx={{
            textAlign: { xs: 'center', sm: 'left' },
            fontSize: '1rem',
            fontWeight: 400,
            lineHeight: 1.4,
            color: '#ffffff',
            flex: { xs: 'none', sm: '1' },
            maxWidth: { xs: '100%', sm: '240px' },
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
