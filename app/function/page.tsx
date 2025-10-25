import type { Metadata } from 'next';
import { Box, Typography } from '@mui/material';

import { getAdditives, getFunctionFilters, getFunctionSlug } from '../../lib/additives';
import { formatFilterLabel } from '../../lib/text';
import functionsData from '../../data/functions.json';
import InfoList from '../../components/InfoList';

type FunctionDataEntry = {
  name?: string;
  description?: string;
};

interface FunctionsData {
  overview?: string;
  functions?: FunctionDataEntry[];
}

interface FunctionSummary {
  slug: string;
  title: string;
  description: string | null;
  count: number;
}

const normalize = (value: string): string => value.trim().toLowerCase();

const functionInfoMap = new Map<string, { title: string; description: string | null }>();
const functionsSource = (functionsData as FunctionsData).functions ?? [];
const overview = (functionsData as FunctionsData).overview?.trim();

functionsSource.forEach((entry) => {
  if (!entry?.name) {
    return;
  }

  const title = entry.name.trim();
  const description = entry.description?.trim() ?? null;
  functionInfoMap.set(normalize(entry.name), { title, description });
});

const additives = getAdditives();
const functionFilters = getFunctionFilters();

const functionCounts = new Map<string, number>();

additives.forEach((additive) => {
  additive.functions.forEach((value) => {
    const slug = getFunctionSlug(value);

    if (!slug) {
      return;
    }

    functionCounts.set(slug, (functionCounts.get(slug) ?? 0) + 1);
  });
});

const functions: FunctionSummary[] = functionFilters
  .map(({ slug, value }) => {
    const info = functionInfoMap.get(normalize(value));

    return {
      slug,
      title: info?.title ?? formatFilterLabel(value),
      description: info?.description ?? null,
      count: functionCounts.get(slug) ?? 0,
    };
  })
  .sort((a, b) => {
    if (a.count !== b.count) {
      return b.count - a.count;
    }

    return a.title.localeCompare(b.title);
  });

const functionItems = functions.map(({ slug, title, description, count }) => ({
  key: slug,
  href: `/function/${slug}`,
  title,
  description,
  count,
  countSuffix: count === 1 ? 'additive uses this function.' : 'additives use this function.',
}));

export const metadata: Metadata = {
  title: 'Food additive functions',
  description: 'Browse every function used to classify food additives, including descriptions and usage counts.',
  alternates: {
    canonical: '/function',
  },
};

export default function FunctionIndexPage() {
  return (
    <Box component="section" display="flex" flexDirection="column" gap={4}>
      <Box display="flex" flexDirection="column" gap={1.5} maxWidth={660}>
        <Typography component="h1" variant="h1">
          Food additive functions
        </Typography>
        <Typography variant="body1" color="text.secondary">
          {overview}
        </Typography>
      </Box>

      <InfoList items={functionItems} />
    </Box>
  );
}
