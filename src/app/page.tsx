import Link from 'next/link';
import { Box, Typography, Link as MuiLink } from '@mui/material';

import { AdditiveGrid } from '../components/AdditiveGrid';
import { FilterPanel } from '../components/FilterPanel';
import {
  getAdditives,
  getFunctionFilters,
  getOriginFilters,
  filterAdditivesByClassVisibility,
  parseAdditiveSortMode,
  parseShowClassesParam,
  sortAdditivesByMode,
} from '../lib/additives';
import { formatFilterLabel } from '../lib/text';
import { formatFunctionLabel } from '../lib/additive-format';
import { getSearchVolumeDataset } from '../lib/search-volume';

const additives = getAdditives();
const functionOptions = getFunctionFilters().map(({ slug, value }) => ({
  slug,
  label: formatFunctionLabel(value),
}));
const originOptions = getOriginFilters().map(({ slug, value }) => ({
  slug,
  label: formatFilterLabel(value),
}));

const numberFormatter = new Intl.NumberFormat('en-US');

const additiveCount = additives.length;

const keywordCount = (() => {
  const seen = new Set<string>();

  additives.forEach((additive) => {
    const dataset = getSearchVolumeDataset(additive.slug);

    dataset?.keywords.forEach(({ keyword }) => {
      const normalised = keyword.trim().toLowerCase();

      if (normalised) {
        seen.add(normalised);
      }
    });
  });

  return seen.size;
})();

interface FunctionSummary {
  value: string;
  label: string;
  count: number;
}

const topFunctionSummaries: FunctionSummary[] = (() => {
  const counts = new Map<string, number>();

  additives.forEach((additive) => {
    additive.functions.forEach((fn) => {
      const normalised = fn.trim();

      if (!normalised) {
        return;
      }

      counts.set(normalised, (counts.get(normalised) ?? 0) + 1);
    });
  });

  return Array.from(counts.entries())
    .sort((a, b) => {
      if (b[1] !== a[1]) {
        return b[1] - a[1];
      }

      return a[0].localeCompare(b[0]);
    })
    .slice(0, 2)
    .map(([value, count]) => ({
      value,
      label: formatFunctionLabel(value),
      count,
    }));
})();

const formattedProductCount = numberFormatter.format(817_713);

interface HomePageProps {
  searchParams?: Promise<{ sort?: string | string[]; classes?: string | string[] }>;
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const sortMode = parseAdditiveSortMode(resolvedSearchParams?.sort ?? null);
  const showClasses = parseShowClassesParam(resolvedSearchParams?.classes ?? null);
  const filteredAdditives = filterAdditivesByClassVisibility(additives, showClasses);
  const sortedAdditives = sortAdditivesByMode(filteredAdditives, sortMode);

  const formattedAdditiveCount = numberFormatter.format(additiveCount);
  const formattedKeywordCount = numberFormatter.format(keywordCount);

  return (
    <Box component="section" display="flex" flexDirection="column" gap={4}>
      <Box
        display="grid"
        gridTemplateColumns={{ xs: '1fr', md: 'minmax(0, 3fr) minmax(0, 1fr)' }}
        gap={{ xs: 3, md: 4 }}
        alignItems={{ md: 'start' }}
      >
        <Box display="flex" flexDirection="column" gap={2} maxWidth={{ xs: '100%', md: 720 }}>
          <Typography component="h1" variant="h1" sx={{ display: { xs: 'block', md: 'none' } }}>
            Food additives
          </Typography>
          <Typography variant="body1" color="text.secondary" lineHeight={1.6}>
            Compare data on {formattedAdditiveCount} common food additives we found after analyzing {formattedProductCount}
            {' '}products, {formattedKeywordCount} keywords in the U.S. from 28+ billion keywords via{' '}
            <MuiLink href="https://ahrefs.com" target="_blank" rel="noopener noreferrer">
              Ahrefs
            </MuiLink>
            .
          </Typography>
        </Box>

        <Link href="/function" style={{ textDecoration: 'none', color: 'inherit' }}>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', md: 'auto 1fr' },
              justifyItems: { xs: 'start', md: 'stretch' },
              alignItems: { xs: 'start', md: 'start' },
              gap: { xs: 1.5, md: 2 },
            }}
          >
            <Typography
              variant="subtitle2"
              sx={{
                textTransform: 'uppercase',
                letterSpacing: '0.12em',
                fontWeight: 600,
                textAlign: { xs: 'left', md: 'right' },
                color: 'text.secondary',
              }}
            >
              Explore
            </Typography>
            <Box display="flex" flexDirection="column" gap={0.5}>
              {topFunctionSummaries.map((entry) => (
                <Typography key={entry.value} variant="body1" fontWeight={600}>
                  {numberFormatter.format(entry.count)} {entry.label}
                </Typography>
              ))}
              <Typography
                variant="body2"
                sx={{
                  backgroundImage: 'linear-gradient(90deg, rgba(66,66,66,0.9) 0%, rgba(66,66,66,0) 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  color: 'transparent',
                  fontWeight: 600,
                }}
              >
                and more
              </Typography>
            </Box>
          </Box>
        </Link>
      </Box>

      <FilterPanel
        functionOptions={functionOptions}
        originOptions={originOptions}
        currentSortMode={sortMode}
        currentShowClasses={showClasses}
      />
      <AdditiveGrid items={sortedAdditives} sortMode={sortMode} />
    </Box>
  );
}
