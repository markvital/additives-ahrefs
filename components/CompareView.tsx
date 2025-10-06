'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Autocomplete,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { createFilterOptions } from '@mui/material/Autocomplete';

import { SearchHistoryChart, type SearchHistoryPoint } from './SearchHistoryChart';
import { MarkdownArticle } from './MarkdownArticle';
import { formatMonthlyVolume, getCountryFlagEmoji } from '../lib/format';

export interface ComparisonOption {
  slug: string;
  label: string;
  eNumber: string;
  title: string;
  synonyms: string[];
}

export interface ComparisonAdditiveData {
  slug: string;
  displayName: string;
  eNumber: string;
  title: string;
  synonyms: string[];
  functions: string[];
  origin: string[];
  description: string;
  articleSummary: string | null;
  articlePreview: string;
  articleRemainder: string;
  searchRank: number | null;
  searchVolume: number | null;
  searchKeyword: string | null;
  searchCountryCode: string | null;
  searchCountryLabel: string | null;
  searchMetrics: SearchHistoryPoint[];
}

interface CompareViewProps {
  options: ComparisonOption[];
  additives: Record<string, ComparisonAdditiveData>;
  initialSelection: string[];
}

const filterOptions = createFilterOptions<ComparisonOption>({
  stringify: (option) =>
    [option.label, option.eNumber, option.title, option.synonyms.join(' ')].filter(Boolean).join(' '),
});

const getOptionMap = (options: ComparisonOption[]) => {
  const map = new Map<string, ComparisonOption>();

  options.forEach((option) => {
    map.set(option.slug, option);
  });

  return map;
};

const parseSelectionFromPathname = (path: string): [string | null, string | null] => {
  if (!path.startsWith('/compare')) {
    return [null, null];
  }

  const remainder = path.slice('/compare'.length);

  if (!remainder || remainder === '/') {
    return [null, null];
  }

  const trimmed = remainder.replace(/^\/+/, '');

  if (!trimmed) {
    return [null, null];
  }

  const segments = trimmed.split('/');

  if (segments.length !== 1) {
    return [null, null];
  }

  const pairSegment = segments[0];
  const parts = pairSegment.split('-vs-');

  if (parts.length !== 2) {
    return [null, null];
  }

  const [first, second] = parts.map((segment) => segment.trim());

  if (!first || !second) {
    return [null, null];
  }

  return [first, second];
};

const ComparisonField = ({ title, children }: { title: string; children: ReactNode }) => (
  <Box display="flex" flexDirection="column" gap={1.25}>
    <Typography variant="overline" color="text.secondary" letterSpacing={1.2}>
      {title}
    </Typography>
    <Box display="flex" flexDirection="column" gap={1}>{children}</Box>
  </Box>
);

const PlaceholderCard = ({ message }: { message: string }) => (
  <Card variant="outlined" sx={{ height: '100%' }}>
    <CardContent sx={{ minHeight: 320, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Typography variant="body1" color="text.secondary" textAlign="center">
        {message}
      </Typography>
    </CardContent>
  </Card>
);

const ArticlePreview = ({ preview, remainder }: { preview: string; remainder: string }) => {
  if (!preview && !remainder) {
    return (
      <Typography variant="body1" color="text.secondary">
        Article preview is not available for this additive.
      </Typography>
    );
  }

  return (
    <Stack spacing={2}>
      {preview && <MarkdownArticle content={preview} />}
      {remainder && (
        <Box
          sx={{
            position: 'relative',
            borderRadius: 2,
            overflow: 'hidden',
            border: (theme) => `1px solid ${theme.palette.divider}`,
            backgroundColor: (theme) => theme.palette.background.paper,
          }}
        >
          <Box
            sx={{
              filter: 'blur(6px)',
              pointerEvents: 'none',
              userSelect: 'none',
              transform: 'scale(1.02)',
              transformOrigin: 'top',
            }}
          >
            <MarkdownArticle content={remainder} />
          </Box>
          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              background: (theme) =>
                `linear-gradient(to bottom, rgba(255,255,255,0) 0%, ${theme.palette.background.paper} 70%)`,
            }}
          />
        </Box>
      )}
    </Stack>
  );
};

const renderChipList = (items: string[]) => {
  if (items.length === 0) {
    return (
      <Typography variant="body1" color="text.secondary">
        Not available.
      </Typography>
    );
  }

  return (
    <Stack direction="row" flexWrap="wrap" gap={1}>
      {items.map((item) => (
        <Chip key={item} label={item} variant="outlined" />
      ))}
    </Stack>
  );
};

const ComparisonCard = ({ additive }: { additive: ComparisonAdditiveData | null }) => {
  if (!additive) {
    return <PlaceholderCard message="Select an additive to see detailed information." />;
  }

  const flagEmoji = additive.searchCountryCode ? getCountryFlagEmoji(additive.searchCountryCode) : null;
  const hasSearchMetrics = additive.searchMetrics.length > 0 && additive.searchKeyword;
  const summaryText = (additive.articleSummary ?? '').trim() || additive.description.trim();

  return (
    <Card variant="outlined" sx={{ height: '100%' }}>
      <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <Stack spacing={1.5}>
          <Typography component="h2" variant="h3">
            {additive.displayName}
          </Typography>
          <Typography variant="body1" color="text.secondary" whiteSpace="pre-line">
            {summaryText || 'Description is not available for this additive yet.'}
          </Typography>
        </Stack>

        <Divider />

        <Stack spacing={3}>
          <ComparisonField title="Synonyms">{renderChipList(additive.synonyms)}</ComparisonField>

          <ComparisonField title="Functions">{renderChipList(additive.functions)}</ComparisonField>

          <ComparisonField title="Origin">{renderChipList(additive.origin)}</ComparisonField>

          <ComparisonField title="Search rank and volume">
            {additive.searchRank === null && additive.searchVolume === null ? (
              <Typography variant="body1" color="text.secondary">
                Search metrics are not available.
              </Typography>
            ) : (
              <Stack direction="row" spacing={2} flexWrap="wrap">
                {additive.searchRank !== null && (
                  <Typography variant="body1" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                    #{additive.searchRank}
                  </Typography>
                )}
                {additive.searchVolume !== null && (
                  <Typography variant="body1" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                    {formatMonthlyVolume(additive.searchVolume)} / mo
                  </Typography>
                )}
                {flagEmoji && (
                  <Typography variant="body1" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Box component="span" role="img" aria-label={additive.searchCountryLabel ?? undefined}>
                      {flagEmoji}
                    </Box>
                    {additive.searchCountryLabel ?? additive.searchCountryCode?.toUpperCase()}
                  </Typography>
                )}
              </Stack>
            )}
          </ComparisonField>

          <ComparisonField title="Search volume over time">
            {hasSearchMetrics && additive.searchKeyword ? (
              <Stack spacing={1.5}>
                <SearchHistoryChart metrics={additive.searchMetrics} />
                <Typography variant="body2" color="text.secondary" textAlign="center">
                  Interest over time on &ldquo;{additive.searchKeyword}&rdquo;
                  {additive.searchCountryLabel ? ` in ${additive.searchCountryLabel}` : ''} for the last 10 years
                </Typography>
              </Stack>
            ) : (
              <Typography variant="body1" color="text.secondary">
                We don&rsquo;t have enough data to display the search history for this additive.
              </Typography>
            )}
          </ComparisonField>

          <ComparisonField title="Article preview">
            <ArticlePreview preview={additive.articlePreview} remainder={additive.articleRemainder} />
            <Box>
              <Button component={Link} href={`/${additive.slug}`} variant="contained">
                Read more
              </Button>
            </Box>
          </ComparisonField>
        </Stack>
      </CardContent>
    </Card>
  );
};

export function CompareView({ options, additives, initialSelection }: CompareViewProps) {
  const router = useRouter();
  const pathname = usePathname();
  const initialLeft = initialSelection[0] ?? null;
  const initialRight = initialSelection[1] ?? null;

  const [leftSlug, setLeftSlug] = useState<string | null>(initialLeft);
  const [rightSlug, setRightSlug] = useState<string | null>(initialRight);

  const optionMap = useMemo(() => getOptionMap(options), [options]);
  const [pathLeft, pathRight] = useMemo(() => parseSelectionFromPathname(pathname), [pathname]);

  useEffect(() => {
    setLeftSlug(initialLeft);
    setRightSlug(initialRight);
  }, [initialLeft, initialRight]);

  useEffect(() => {
    if (pathLeft !== leftSlug) {
      setLeftSlug(pathLeft);
    }
    if (pathRight !== rightSlug) {
      setRightSlug(pathRight);
    }
  }, [pathLeft, pathRight, leftSlug, rightSlug]);

  useEffect(() => {
    const left = leftSlug;
    const right = rightSlug;

    if (left && right) {
      const nextPath = `/compare/${left}-vs-${right}`;
      if (pathname !== nextPath) {
        router.replace(nextPath);
      }
      return;
    }

    if (!left || !right) {
      if (pathname !== '/compare') {
        router.replace('/compare');
      }
    }
  }, [leftSlug, rightSlug, pathname, router]);

  const leftOption = leftSlug ? optionMap.get(leftSlug) ?? null : null;
  const rightOption = rightSlug ? optionMap.get(rightSlug) ?? null : null;

  const leftAdditive = leftSlug ? additives[leftSlug] ?? null : null;
  const rightAdditive = rightSlug ? additives[rightSlug] ?? null : null;

  return (
    <Stack spacing={4}>
      <Typography component="h1" variant="h1">
        Compare additives
      </Typography>

      <Box
        display="grid"
        gap={{ xs: 2, sm: 3 }}
        sx={{
          gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' },
        }}
      >
        <Autocomplete
          options={options}
          value={leftOption}
          onChange={(_, option) => setLeftSlug(option?.slug ?? null)}
          filterOptions={filterOptions}
          getOptionLabel={(option) => option.label}
          renderInput={(params) => <TextField {...params} label="Choose additive" placeholder="Type additive to compare" />}
          renderOption={(props, option) => (
            <Box component="li" {...props} sx={{ display: 'flex', flexDirection: 'column' }}>
              <Typography variant="body2" color="text.secondary">
                {option.eNumber}
              </Typography>
              <Typography variant="body1" color="text.primary">
                {option.title}
              </Typography>
            </Box>
          )}
          clearOnBlur={false}
          isOptionEqualToValue={(option, value) => option.slug === value.slug}
        />

        <Autocomplete
          options={options}
          value={rightOption}
          onChange={(_, option) => setRightSlug(option?.slug ?? null)}
          filterOptions={filterOptions}
          getOptionLabel={(option) => option.label}
          renderInput={(params) => <TextField {...params} label="Choose additive" placeholder="Type additive to compare" />}
          renderOption={(props, option) => (
            <Box component="li" {...props} sx={{ display: 'flex', flexDirection: 'column' }}>
              <Typography variant="body2" color="text.secondary">
                {option.eNumber}
              </Typography>
              <Typography variant="body1" color="text.primary">
                {option.title}
              </Typography>
            </Box>
          )}
          clearOnBlur={false}
          isOptionEqualToValue={(option, value) => option.slug === value.slug}
        />
      </Box>

      <Box
        display="grid"
        gap={{ xs: 3, md: 4 }}
        sx={{ gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' } }}
      >
        <ComparisonCard additive={leftAdditive} />
        <ComparisonCard additive={rightAdditive} />
      </Box>
    </Stack>
  );
}
