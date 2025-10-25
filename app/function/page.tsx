import type { Metadata } from 'next';
import Link from 'next/link';
import { Box, Typography } from '@mui/material';

import { getAdditives, getFunctionFilters, getFunctionSlug } from '../../lib/additives';
import { formatFilterLabel } from '../../lib/text';
import functionsData from '../../data/functions.json';

type FunctionDataEntry = {
  name?: string;
  description?: string;
};

interface FunctionSummary {
  slug: string;
  title: string;
  description: string | null;
  count: number;
}

const normalize = (value: string): string => value.trim().toLowerCase();

const functionInfoMap = new Map<string, { title: string; description: string | null }>();

(functionsData as FunctionDataEntry[]).forEach((entry) => {
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
          Discover the roles food additives play across the industry. Each function below includes a short
          definition and the number of additives that use it.
        </Typography>
      </Box>

      <Box component="ul" sx={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        {functions.map(({ slug, title, description, count }) => (
          <Box key={slug} component="li">
            <Box
              component={Link}
              href={`/function/${slug}`}
              sx={{
                display: 'flex',
                flexDirection: 'column',
                gap: 0.75,
                textDecoration: 'none',
                color: 'text.primary',
                transition: 'color 0.2s ease',
                '&:hover': {
                  textDecoration: 'underline',
                },
                '&:focus-visible': {
                  textDecoration: 'underline',
                },
              }}
            >
              <Typography component="h2" variant="h5">
                {title}
              </Typography>
              {description ? (
                <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 660 }}>
                  {description}
                </Typography>
              ) : null}
              <Typography variant="body2" color="text.secondary">
                <Box component="span" fontWeight={600}>
                  {count}
                </Box>{' '}
                {count === 1 ? 'additive uses this function.' : 'additives use this function.'}
              </Typography>
            </Box>
          </Box>
        ))}
      </Box>
    </Box>
  );
}
