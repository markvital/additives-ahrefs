import type { Metadata } from 'next';
import Image from 'next/image';
import { Box, Typography } from '@mui/material';

import { getAdditives, getOriginFilters, getOriginSlug } from '../../lib/additives';
import { formatFilterLabel, normalizeFilterValue } from '../../lib/text';
import originsData from '../../../data/origins.json';
import { getOriginIcon } from '../../lib/origin-icons';
import InfoList from '../../components/InfoList';
import { absoluteUrl } from '../../lib/site';

type OriginDataEntry = {
  name?: string;
  description?: string;
};

interface OriginsData {
  overview?: string;
  origins?: OriginDataEntry[];
}

interface OriginSummary {
  slug: string;
  title: string;
  description: string | null;
  count: number;
}

const originInfoMap = new Map<string, { title: string; description: string | null }>();

((originsData as OriginsData).origins ?? []).forEach((entry) => {
  if (!entry?.name) {
    return;
  }

  const title = formatFilterLabel(entry.name);
  const description = entry.description?.trim() ?? null;
  originInfoMap.set(normalizeFilterValue(entry.name), { title, description });
});

const additives = getAdditives();
const originFilters = getOriginFilters();
const overview = (originsData as OriginsData).overview?.trim();

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
    const info = originInfoMap.get(normalizeFilterValue(value));

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

const originItems = origins.map(({ slug, title, description, count }) => {
  const icon = getOriginIcon(slug);

  return {
    key: slug,
    href: `/origin/${slug}`,
    title,
    description,
    count,
    countSuffix: count === 1 ? 'additive has this origin.' : 'additives have this origin.',
    icon: icon ? (
      <Image
        src={icon}
        alt={`${title} origin icon`}
        width={36}
        height={36}
        style={{ width: '1.75rem', height: '1.75rem', objectFit: 'contain' }}
      />
    ) : undefined,
  };
});

const originPageTitle = 'Food additive origins';
const originPageDescription =
  'Review every origin category for food additives, complete with descriptions and additive counts.';
const originCanonicalPath = '/origin';
const gridSocialImage = absoluteUrl('/img/grid-screenshot.png');
const originCanonicalUrl = absoluteUrl(originCanonicalPath);

export const metadata: Metadata = {
  title: originPageTitle,
  description: originPageDescription,
  alternates: {
    canonical: originCanonicalPath,
  },
  openGraph: {
    title: originPageTitle,
    description: originPageDescription,
    url: originCanonicalUrl,
    images: [
      {
        url: gridSocialImage,
        alt: 'Screenshot of the food additives grid.',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: originPageTitle,
    description: originPageDescription,
    images: [gridSocialImage],
  },
};

export default function OriginIndexPage() {
  return (
    <Box component="section" display="flex" flexDirection="column" gap={4}>
      <Box className="page-hero">
        <Box className="page-hero-content" display="flex" flexDirection="column" gap={1.5} maxWidth={660}>
          <Typography component="h1" variant="h1">
            Food additive origins
          </Typography>
          <Typography variant="body1" className="page-hero-subtitle">
            {overview}
          </Typography>
        </Box>
      </Box>

      <InfoList items={originItems} />
    </Box>
  );
}
