'use client';

import { useEffect } from 'react';
import { Box } from '@mui/material';
import { AdditiveCardStandalone } from './AdditiveCardStandalone';
import type { AdditiveGridItem, AwarenessScoreResult } from '../lib/additives';

interface CardPreviewClientProps {
  additive: AdditiveGridItem;
  awarenessScore: AwarenessScoreResult | null | undefined;
}

/**
 * Client component that handles card scaling for preview generation.
 * This component scales the card to fit within the 1200×630 viewport
 * while maintaining aspect ratio.
 */
export function CardPreviewClient({ additive, awarenessScore }: CardPreviewClientProps) {
  useEffect(() => {
    // Scale the card after it renders
    const scaleCard = () => {
      const wrapper = document.getElementById('card-wrapper');
      if (!wrapper) return;

      // Get the actual rendered dimensions of the card
      const rect = wrapper.getBoundingClientRect();
      const cardWidth = rect.width;
      const cardHeight = rect.height;

      // Target dimensions (safe area)
      const targetWidth = 1200;
      const targetHeight = 600;

      // Calculate uniform scale to fit within safe area
      const scale = Math.min(targetWidth / cardWidth, targetHeight / cardHeight);

      // Apply the scale transform
      wrapper.style.transform = `scale(${scale})`;

      // Signal that scaling is complete (for Playwright)
      wrapper.setAttribute('data-scaled', 'true');
    };

    // Run scaling after a short delay to ensure the card is fully rendered
    const timeoutId = setTimeout(scaleCard, 100);

    return () => clearTimeout(timeoutId);
  }, []);

  return (
    <Box
      id="preview-container"
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
      {/* Safe area with 15px top/bottom padding for Twitter crop tolerance */}
      <Box
        id="safe-area"
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
        {/* Card wrapper at 500px width (mobile layout) */}
        <Box
          id="card-wrapper"
          sx={{
            width: '500px',
            transformOrigin: 'center center',
          }}
        >
          <AdditiveCardStandalone additive={additive} awarenessScore={awarenessScore} />
        </Box>
      </Box>
    </Box>
  );
}
