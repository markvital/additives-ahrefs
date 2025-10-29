import { notFound } from 'next/navigation';
import { Box } from '@mui/material';

import {
  DEFAULT_ADDITIVE_SORT_MODE,
  getAdditiveBySlug,
  toAdditiveGridItem,
  getAwarenessScores,
} from '../../../../lib/additives';
import { AdditiveCardPreview } from '../../../../components/AdditiveCardPreview';

interface CardPreviewPageProps {
  params: Promise<{ slug: string }>;
}

export default async function CardPreviewPage({ params }: CardPreviewPageProps) {
  const { slug } = await params;

  if (!slug) {
    notFound();
  }

  const additive = getAdditiveBySlug(slug);

  if (!additive) {
    notFound();
  }

  const awareness = getAwarenessScores();
  const awarenessScore = awareness.scores.get(additive.slug) ?? additive.awarenessScore ?? null;
  const item = toAdditiveGridItem(additive);

  return (
    <Box
      component="main"
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        background: 'radial-gradient(circle at top, #f1f1f1, #cfcfcf 55%, #bdbdbd)',
        p: { xs: 2, md: 4 },
      }}
    >
      <AdditiveCardPreview
        item={item}
        sortMode={DEFAULT_ADDITIVE_SORT_MODE}
        awarenessScore={awarenessScore}
      />
    </Box>
  );
}
