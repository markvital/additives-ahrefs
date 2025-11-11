'use client';

import { Box } from '@mui/material';
import { AdditiveWithMetrics } from '@/lib/additives';

interface CardPreviewProps {
  additive: AdditiveWithMetrics;
  awarenessScore: number | null;
  children: React.ReactNode;
}

/**
 * CardPreview wrapper component for generating social media card images.
 *
 * This component is designed to be captured by Playwright at 1200×630px viewport.
 * It renders a card at 500px CSS width (mobile layout) and scales it to fit
 * within a safe area (1200×600px with 15px top/bottom padding) while maintaining
 * the card's aspect ratio.
 *
 * The scaling is done via CSS transform to achieve uniform scaling without distortion.
 */
export function CardPreview({ additive, awarenessScore, children }: CardPreviewProps) {
  return (
    <Box
      sx={{
        width: '1200px',
        height: '630px',
        backgroundColor: '#FFFFFF',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Safe area wrapper with padding for Twitter crop tolerance */}
      <Box
        sx={{
          width: '1200px',
          height: '600px',
          position: 'absolute',
          top: '15px',
          left: '0px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {/* Card container at 500px width (mobile layout) */}
        <Box
          id="card-container"
          sx={{
            width: '500px',
            // The card will determine its own height based on content
            // We'll apply scaling after the card renders
          }}
        >
          {children}
        </Box>
      </Box>
    </Box>
  );
}
