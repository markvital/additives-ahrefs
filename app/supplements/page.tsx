import type { Metadata } from 'next';
import Link from 'next/link';
import { Box, Button, Typography } from '@mui/material';

import { SupplementFilterPanel } from '../../components/SupplementFilterPanel';
import { SupplementGrid } from '../../components/SupplementGrid';
import {
  filterSupplementAdditives,
  getSupplementFormatFilters,
  getSupplementRoleFilters,
  parseSupplementSortMode,
} from '../../lib/supplement-additives';
import { formatFilterLabel } from '../../lib/text';
import { parseShowClassesParam } from '../../lib/additives';

const roleOptions = getSupplementRoleFilters().map(({ slug, value }) => ({
  slug,
  label: formatFilterLabel(value),
}));

const formatOptions = getSupplementFormatFilters().map(({ slug, value }) => ({
  slug,
  label: formatFilterLabel(value),
}));

const toSingleValue = (value: string | string[] | undefined): string | null => {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return typeof value === 'string' ? value : null;
};

export const metadata: Metadata = {
  title: 'Supplement additive comparison',
  description:
    'Explore excipients and sweeteners used in food supplements. Compare their roles, formats, and regulatory context to choose the best fit for your formulation.',
  alternates: {
    canonical: '/supplements',
  },
};

interface SupplementsPageProps {
  searchParams?: Promise<{ [key: string]: string | string[] }>;
}

export default async function SupplementsPage({ searchParams }: SupplementsPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const roleSlug = toSingleValue(resolvedSearchParams?.role);
  const formatSlug = toSingleValue(resolvedSearchParams?.format);
  const sortMode = parseSupplementSortMode(resolvedSearchParams?.sort);
  const showClasses = parseShowClassesParam(resolvedSearchParams?.classes ?? null);
  const items = filterSupplementAdditives(roleSlug, formatSlug, sortMode, showClasses);

  return (
    <Box component="section" display="flex" flexDirection="column" gap={4}>
      <Box display="flex" flexDirection="column" gap={1.5} maxWidth={780}>
        <Typography component="h1" variant="h1">
          Food supplement additives
        </Typography>
        <Typography variant="body1" color="text.secondary">
          A focused catalogue of excipients, sweeteners, and processing aids tailored to dietary supplements. Compare
          how each additive performs, the delivery formats it supports, and any safety or regulatory notes before
          choosing what to include in your next formulation.
        </Typography>
        <Box>
          <Button component={Link} href="/supplements/compare" variant="outlined" size="small">
            Compare additives
          </Button>
        </Box>
      </Box>

      <SupplementFilterPanel
        roleOptions={roleOptions}
        formatOptions={formatOptions}
        currentRoleSlug={roleSlug}
        currentFormatSlug={formatSlug}
        currentSortMode={sortMode}
        showClasses={showClasses}
      />

      <SupplementGrid items={items} sortMode={sortMode} />
    </Box>
  );
}
