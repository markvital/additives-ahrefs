import { notFound } from 'next/navigation';
import { getAdditiveBySlug, getAwarenessScores } from '../../../lib/additives';
import { CardPreviewClient } from '../../../components/CardPreviewClient';

interface PreviewPageProps {
  params: Promise<{
    slug: string;
  }>;
}

/**
 * Preview page for generating card images for social media.
 *
 * This page renders a single additive card at 1200×630px (Meta's recommended dimensions)
 * with a white background. The card is rendered at 500px CSS width (mobile layout) and
 * scaled to fit within a safe area to maintain proper aspect ratio.
 *
 * This route is accessed by the Playwright script to generate JPEG screenshots.
 */
export default async function PreviewPage({ params }: PreviewPageProps) {
  const { slug } = await params;
  const additive = getAdditiveBySlug(slug);

  if (!additive) {
    notFound();
  }

  const awarenessResult = getAwarenessScores();
  const awarenessScore = awarenessResult.scores.get(additive.slug) ?? additive.awarenessScore ?? null;

  return <CardPreviewClient additive={additive} awarenessScore={awarenessScore} />;
}

// Disable static generation for this route
export const dynamic = 'force-dynamic';
