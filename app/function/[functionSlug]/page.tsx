import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Box, Typography } from '@mui/material';

import {
  getAdditivesByFunctionSlug,
  getFunctionFilters,
  getFunctionValueBySlug,
} from '../../../lib/additives';
import { formatFilterLabel } from '../../../lib/text';
import { AdditiveGrid } from '../../../components/AdditiveGrid';

interface FunctionPageProps {
  params: Promise<{ functionSlug: string }>;
}

const formatCountLabel = (count: number): string =>
  count === 1 ? '1 additive uses this function.' : `${count} additives use this function.`;

export async function generateStaticParams() {
  return getFunctionFilters().map(({ slug }) => ({ functionSlug: slug }));
}

export async function generateMetadata({ params }: FunctionPageProps): Promise<Metadata> {
  const { functionSlug } = await params;
  const functionValue = getFunctionValueBySlug(functionSlug);

  if (!functionValue) {
    return {
      title: 'Function not found',
    };
  }

  const label = formatFilterLabel(functionValue);

  return {
    title: `${label} food additives`,
    description: `Browse food additives that function as ${functionValue}.`,
    alternates: {
      canonical: `/function/${functionSlug}`,
    },
  };
}

export default async function FunctionPage({ params }: FunctionPageProps) {
  const { functionSlug } = await params;
  const functionValue = getFunctionValueBySlug(functionSlug);

  if (!functionValue) {
    notFound();
  }

  const additives = getAdditivesByFunctionSlug(functionSlug);
  const label = formatFilterLabel(functionValue);

  return (
    <Box component="section" display="flex" flexDirection="column" gap={4}>
      <Box display="flex" flexDirection="column" gap={1.5} maxWidth={720}>
        <Typography component="h1" variant="h1">
          Function: {label}
        </Typography>
        <Typography variant="body1" color="text.secondary">
          {formatCountLabel(additives.length)}
        </Typography>
      </Box>

      <AdditiveGrid items={additives} emptyMessage="No additives found for this function." />
    </Box>
  );
}
