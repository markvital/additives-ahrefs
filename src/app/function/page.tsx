import type { Metadata } from 'next';
import { Box, Typography } from '@mui/material';

import { getAdditives, getFunctionFilters, getFunctionSlug } from '../../lib/additives';
import { formatFilterLabel, normalizeFilterValue } from '../../lib/text';
import functionsData from '../../../data/functions.json';
import InfoList from '../../components/InfoList';
import { absoluteUrl } from '../../lib/site';

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

const functionInfoMap = new Map<string, { title: string; description: string | null }>();
const functionsSource = (functionsData as FunctionsData).functions ?? [];
const overview = (functionsData as FunctionsData).overview?.trim();

functionsSource.forEach((entry) => {
  if (!entry?.name) {
    return;
  }

  const title = entry.name.trim();
  const description = entry.description?.trim() ?? null;
  functionInfoMap.set(normalizeFilterValue(entry.name), { title, description });
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
    const info = functionInfoMap.get(normalizeFilterValue(value));

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

const functionPageTitle = 'Food additive functions';
const functionPageDescription =
  'Browse every function used to classify food additives, including descriptions and usage counts.';
const functionCanonicalPath = '/function';
const gridSocialImage = absoluteUrl('/img/grid-screenshot.png');
const functionCanonicalUrl = absoluteUrl(functionCanonicalPath);

export const metadata: Metadata = {
  title: functionPageTitle,
  description: functionPageDescription,
  alternates: {
    canonical: functionCanonicalPath,
  },
  openGraph: {
    title: functionPageTitle,
    description: functionPageDescription,
    url: functionCanonicalUrl,
    images: [
      {
        url: gridSocialImage,
        alt: 'Screenshot of the food additives grid.',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: functionPageTitle,
    description: functionPageDescription,
    images: [gridSocialImage],
  },
};

export default function FunctionIndexPage() {
  return (
    <Box component="section" display="flex" flexDirection="column" gap={4}>
      <Box className="page-hero">
        <Box className="page-hero-content" display="flex" flexDirection="column" gap={1.5} maxWidth={660}>
          <Typography component="h1" variant="h1">
            Food additive functions
          </Typography>
          <Typography variant="body1" className="page-hero-subtitle">
            {overview}
          </Typography>
        </Box>
      </Box>

      <InfoList items={functionItems} />
    </Box>
  );
}
