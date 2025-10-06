import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Box, Typography } from '@mui/material';

import {
  getAdditivesByOriginSlug,
  getOriginFilters,
  getOriginValueBySlug,
} from '../../../lib/additives';
import { formatFilterLabel } from '../../../lib/text';
import { AdditiveGrid } from '../../../components/AdditiveGrid';

interface OriginPageProps {
  params: Promise<{ originSlug: string }>;
}

const formatCountLabel = (count: number): string =>
  count === 1 ? '1 additive has this origin.' : `${count} additives have this origin.`;

export async function generateStaticParams() {
  return getOriginFilters().map(({ slug }) => ({ originSlug: slug }));
}

export async function generateMetadata({ params }: OriginPageProps): Promise<Metadata> {
  const { originSlug } = await params;
  const originValue = getOriginValueBySlug(originSlug);

  if (!originValue) {
    return {
      title: 'Origin not found',
    };
  }

  const label = formatFilterLabel(originValue);

  return {
    title: `${label} origin additives`,
    description: `Explore food additives that originate from ${originValue}.`,
    alternates: {
      canonical: `/origin/${originSlug}`,
    },
  };
}

export default async function OriginPage({ params }: OriginPageProps) {
  const { originSlug } = await params;
  const originValue = getOriginValueBySlug(originSlug);

  if (!originValue) {
    notFound();
  }

  const additives = getAdditivesByOriginSlug(originSlug);
  const label = formatFilterLabel(originValue);

  return (
    <Box component="section" display="flex" flexDirection="column" gap={4}>
      <Box display="flex" flexDirection="column" gap={1.5} maxWidth={720}>
        <Typography component="h1" variant="h1">
          Origin: {label}
        </Typography>
        <Typography variant="body1" color="text.secondary">
          {formatCountLabel(additives.length)}
        </Typography>
      </Box>

      <AdditiveGrid items={additives} emptyMessage="No additives found for this origin." />
    </Box>
  );
}
