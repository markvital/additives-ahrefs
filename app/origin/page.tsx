import type { Metadata } from 'next';
import Link from 'next/link';
import { Box, Typography } from '@mui/material';

import { getAdditives, getOriginFilters, getOriginSlug } from '../../lib/additives';
import { formatFilterLabel } from '../../lib/text';
import originsData from '../../data/origins.json';

type OriginDataEntry = {
  name?: string;
  description?: string;
};

interface OriginsData {
  origins?: OriginDataEntry[];
}

interface OriginSummary {
  slug: string;
  title: string;
  description: string | null;
  count: number;
}

const normalize = (value: string): string => value.trim().toLowerCase();

const originInfoMap = new Map<string, { title: string; description: string | null }>();

((originsData as OriginsData).origins ?? []).forEach((entry) => {
  if (!entry?.name) {
    return;
  }

  const title = formatFilterLabel(entry.name);
  const description = entry.description?.trim() ?? null;
  originInfoMap.set(normalize(entry.name), { title, description });
});

const additives = getAdditives();
const originFilters = getOriginFilters();

const originCounts = new Map<string, number>();

additives.forEach((additive) => {
  additive.origin.forEach((value) => {
    const slug = getOriginSlug(value);

    if (!slug) {
      return;
    }

    originCounts.set(slug, (originCounts.get(slug) ?? 0) + 1);
  });
});

const origins: OriginSummary[] = originFilters
  .map(({ slug, value }) => {
    const info = originInfoMap.get(normalize(value));

    return {
      slug,
      title: info?.title ?? formatFilterLabel(value),
      description: info?.description ?? null,
      count: originCounts.get(slug) ?? 0,
    };
  })
  .sort((a, b) => {
    if (a.count !== b.count) {
      return b.count - a.count;
    }

    return a.title.localeCompare(b.title);
  });

const formatCountLabel = (count: number): string =>
  count === 1 ? '1 additive has this origin.' : `${count} additives have this origin.`;

export const metadata: Metadata = {
  title: 'Food additive origins',
  description: 'Review every origin category for food additives, complete with descriptions and additive counts.',
  alternates: {
    canonical: '/origin',
  },
};

export default function OriginIndexPage() {
  return (
    <Box component="section" display="flex" flexDirection="column" gap={4}>
      <Box display="flex" flexDirection="column" gap={1.5} maxWidth={720}>
        <Typography component="h1" variant="h1">
          Food additive origins
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Explore where food additives come from. Each origin entry summarises the source and lists how many
          additives share it.
        </Typography>
      </Box>

      <Box component="ul" sx={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
        {origins.map(({ slug, title, description, count }) => (
          <Box key={slug} component="li">
            <Box
              component={Link}
              href={`/origin/${slug}`}
              sx={{
                display: 'flex',
                flexDirection: 'column',
                gap: 1,
                p: 2,
                borderRadius: 2,
                border: '1px solid',
                borderColor: 'divider',
                textDecoration: 'none',
                color: 'inherit',
                backgroundColor: 'background.paper',
                transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
                '&:hover': {
                  borderColor: 'text.primary',
                  boxShadow: 4,
                },
              }}
            >
              <Typography component="h2" variant="h5">
                {title}
              </Typography>
              {description ? (
                <Typography variant="body1" color="text.secondary">
                  {description}
                </Typography>
              ) : null}
              <Typography variant="body2" color="text.secondary">
                {formatCountLabel(count)}
              </Typography>
            </Box>
          </Box>
        ))}
      </Box>
    </Box>
  );
}
