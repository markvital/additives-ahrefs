import { notFound } from 'next/navigation';
import { Box } from '@mui/material';
import { getAdditiveBySlug, getAwarenessScores, mapAdditivesToGridItems } from '../../../lib/additives';
import { AdditiveGrid } from '../../../components/AdditiveGrid';

interface PreviewPageProps {
  params: Promise<{
    slug: string;
  }>;
}

/**
 * Preview page for generating card images for social media.
 *
 * This page renders a single additive card at 500px width with gradient background.
 * The Playwright script captures this at 1200×630px resolution.
 *
 * Key design decisions:
 * - Uses the existing AdditiveGrid component to ensure consistency
 * - Renders at 500px width (mobile layout)
 * - Gradient background matches hero section via shared CSS variable
 * - No layout/header/footer (isolated via layout.tsx)
 */
export default async function PreviewPage({ params }: PreviewPageProps) {
  const { slug } = await params;
  const additive = getAdditiveBySlug(slug);

  if (!additive) {
    notFound();
  }

  const awarenessResult = getAwarenessScores();
  const awarenessScores = awarenessResult.scores;

  // Convert to grid item format
  const gridItems = mapAdditivesToGridItems([additive]);

  return (
    <Box
      id="preview-container"
      sx={{
        width: '100vw',
        height: '100vh',
        background: 'var(--page-hero-gradient)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}
    >
      <Box sx={{ width: '100%', maxWidth: '500px', padding: '0 16px' }}>
        <AdditiveGrid
          items={gridItems}
          sortMode="product-count"
          awarenessScores={awarenessScores}
        />
      </Box>
    </Box>
  );
}

// Disable static generation for this route
export const dynamic = 'force-dynamic';
