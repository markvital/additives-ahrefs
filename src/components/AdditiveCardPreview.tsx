'use client';

import { Box } from '@mui/material';

import type { AdditiveGridItem, AdditiveSortMode } from '../lib/additives';
import type { AwarenessScoreResult } from '../lib/awareness';
import { AdditiveCard } from './AdditiveCard';

interface AdditiveCardPreviewProps {
  item: AdditiveGridItem;
  sortMode: AdditiveSortMode;
  awarenessScore?: AwarenessScoreResult | null;
}

export function AdditiveCardPreview({ item, sortMode, awarenessScore }: AdditiveCardPreviewProps) {
  return (
    <Box
      data-card-preview="frame"
      sx={{
        width: 512,
        height: 512,
        borderRadius: '50%',
        overflow: 'hidden',
        bgcolor: 'background.paper',
        display: 'flex',
        alignItems: 'stretch',
        justifyContent: 'stretch',
        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.2)',
      }}
    >
      <AdditiveCard
        item={item}
        sortMode={sortMode}
        awarenessScore={awarenessScore}
        linkHref={null}
        cardSx={{
          width: '100%',
          height: '100%',
          borderRadius: '50%',
          overflow: 'hidden',
          boxShadow: 'none',
          bgcolor: 'background.paper',
        }}
        contentSx={{
          justifyContent: 'space-between',
          gap: 2,
        }}
      />
    </Box>
  );
}
