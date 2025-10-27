"use client";

import { useMemo, type CSSProperties } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Avatar, Box, Card, CardActionArea, CardContent, Stack, Tooltip, Typography } from '@mui/material';

import { formatOriginLabel } from '../lib/additive-format';
import { formatMonthlyVolume, formatProductCount } from '../lib/format';
import { getOriginAbbreviation, getOriginIcon } from '../lib/origin-icons';
import { SearchSparkline } from './SearchSparkline';
import { theme } from '../lib/theme';
import { FunctionChipList } from './FunctionChipList';
import { useCompareDraggable } from './CompareWidget/useCompareDraggable';

type AdditiveSortMode = 'search-rank' | 'product-count';

interface AdditiveCard {
  slug: string;
  title: string;
  eNumber: string;
  functions: string[];
  origin: string[];
  searchSparkline: Array<number | null>;
  searchRank: number | null;
  searchVolume: number | null;
  productCount: number | null;
  childSlugs: string[];
}

const DEFAULT_ADDITIVE_SORT_MODE: AdditiveSortMode = 'product-count';

const resolveTypographySize = (value: string | number | undefined, fallback = '1.5rem') => {
  if (typeof value === 'number') {
    return `${value}px`;
  }

  if (typeof value === 'string' && value.trim().length > 0) {
    return value;
  }

  return fallback;
};

const baseTitleFontSize = resolveTypographySize(theme.typography.h2?.fontSize);
const SOFT_HYPHEN = '\u00ad';

const hyphenateLongWords = (text: string) =>
  text.replace(/[A-Za-z]{12,}/g, (word) => {
    let result = '';

    for (let index = 0; index < word.length; index += 6) {
      const sliceEnd = Math.min(word.length, index + 6);
      result += word.slice(index, sliceEnd);

      if (sliceEnd < word.length) {
        result += SOFT_HYPHEN;
      }
    }

    return result;
  });

interface AdditiveGridProps {
  items: AdditiveCard[];
  emptyMessage?: string;
  sortMode?: AdditiveSortMode;
}

export function AdditiveGrid({
  items,
  emptyMessage = 'No additives found.',
  sortMode = DEFAULT_ADDITIVE_SORT_MODE,
}: AdditiveGridProps) {
  if (items.length === 0) {
    return (
      <Typography variant="body1" color="text.secondary">
        {emptyMessage}
      </Typography>
    );
  }

  return (
    <Box
      display="grid"
      gap={{ xs: 2, sm: 3 }}
      sx={{
        gridTemplateColumns: {
          xs: '1fr',
          sm: 'repeat(2, 1fr)',
          md: 'repeat(3, 1fr)',
          lg: 'repeat(4, 1fr)',
        },
        '@media (min-width: 1600px)': {
          gridTemplateColumns: 'repeat(6, 1fr)',
        },
      }}
    >
      {items.map((additive, index) => (
        <AdditiveGridCard key={additive.slug} additive={additive} index={index} sortMode={sortMode} />
      ))}
    </Box>
  );
}

interface AdditiveGridCardProps {
  additive: AdditiveCard;
  index: number;
  sortMode: AdditiveSortMode;
}

function AdditiveGridCard({ additive, index, sortMode }: AdditiveGridCardProps) {
  const draggableAdditive = useMemo(
    () => ({ slug: additive.slug, eNumber: additive.eNumber, title: additive.title }),
    [additive.slug, additive.eNumber, additive.title],
  );
  const { attributes, listeners, setNodeRef, style, isDragging, isEnabled } =
    useCompareDraggable(draggableAdditive);
  const hasSparkline =
    Array.isArray(additive.searchSparkline) &&
    additive.searchSparkline.some((value) => value !== null);
  const searchVolumeValue =
    typeof additive.searchVolume === 'number' ? additive.searchVolume : null;
  const hasSearchMetrics = typeof additive.searchRank === 'number' && searchVolumeValue !== null;
  const searchVolumeLabel =
    searchVolumeValue !== null ? formatMonthlyVolume(searchVolumeValue) : '';
  const showSearchSection = hasSparkline || hasSearchMetrics;
  const origins = additive.origin.filter((origin) => origin.trim().length > 0);
  const highlightProducts = sortMode === 'product-count';
  const searchSectionOpacity = highlightProducts ? 0.6 : 1;
  const productCountValue =
    typeof additive.productCount === 'number' ? Math.max(0, additive.productCount) : null;
  const showProductCount = typeof productCountValue === 'number' && productCountValue > 0;
  const productCountLabel = showProductCount ? formatProductCount(productCountValue) : null;
  const normalizedTitle = additive.title.replace(/\s+/g, ' ').trim();
  const words = normalizedTitle.split(/\s+/);
  const longestWordLength = words.reduce((max, word) => Math.max(max, word.replace(/[^A-Za-z]/g, '').length), 0);
  const titleLength = normalizedTitle.length;
  let titleFontScale = 1;

  if (titleLength > 72 || longestWordLength > 32) {
    titleFontScale = 0.78;
  } else if (titleLength > 58 || longestWordLength > 26) {
    titleFontScale = 0.84;
  } else if (titleLength > 42 || longestWordLength > 22) {
    titleFontScale = 0.9;
  } else if (titleLength > 28 || longestWordLength > 18) {
    titleFontScale = 0.96;
  }

  const titleFontSize =
    titleFontScale === 1 ? undefined : `calc(${baseTitleFontSize} * ${titleFontScale})`;
  const showSoftHyphenation = longestWordLength > 18;
  const displayTitle = showSoftHyphenation ? hyphenateLongWords(normalizedTitle) : normalizedTitle;
  const childCount = additive.childSlugs.length;
  const isFamily = childCount > 0;
  const familyTooltip = `additive family has ${childCount} additive${childCount === 1 ? '' : 's'}`;

  return (
    <Card
      data-additive-card-index={index}
      ref={setNodeRef}
      {...attributes}
      sx={{
        display: 'flex',
        flexDirection: 'column',
        cursor: isEnabled ? 'grab' : undefined,
        position: isDragging ? 'relative' : 'static',
        zIndex: isDragging ? 1400 : 'auto',
        boxShadow: isDragging ? '0px 12px 24px rgba(0,0,0,0.2)' : undefined,
      }}
      style={style as CSSProperties | undefined}
    >
      <CardActionArea
        component={Link}
        href={`/${additive.slug}`}
        {...(isEnabled ? listeners : undefined)}
        sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', alignItems: 'stretch', height: '100%' }}
      >
        <CardContent
          sx={{
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            width: '100%',
            boxSizing: 'border-box',
            px: 1.25,
            pt: 1.875,
            pb: 1.875,
            '&:last-child': { pb: 1.875 },
          }}
        >
          <Stack spacing={1.5} sx={{ flexGrow: 1 }}>
            <Box display="flex" justifyContent="space-between" alignItems="flex-start">
              <Stack direction="row" spacing={1} alignItems="center">
                <Typography variant="overline" color="text.secondary" letterSpacing={1.2}>
                  {additive.eNumber}
                </Typography>
                {isFamily ? (
                  <Tooltip title={familyTooltip} arrow>
                    <Typography
                      component="span"
                      variant="overline"
                      sx={{
                        color: '#AAAAAA',
                        letterSpacing: 1.2,
                        textTransform: 'uppercase',
                      }}
                    >
                      family
                    </Typography>
                  </Tooltip>
                ) : null}
              </Stack>
              {origins.length > 0 ? (
                <Stack direction="row" spacing={0.5}>
                  {origins.map((origin) => {
                    const icon = getOriginIcon(origin);
                    const abbreviation = getOriginAbbreviation(origin);
                    const label = formatOriginLabel(origin);

                    return (
                      <Tooltip key={origin} title={label} arrow>
                        <Avatar
                          variant="circular"
                          sx={{
                            width: 28,
                            height: 28,
                            bgcolor: 'grey.100',
                            color: 'text.primary',
                            fontSize: 12,
                            fontWeight: 600,
                            p: 0.5,
                          }}
                        >
                          {icon ? (
                            <Image
                              src={icon}
                              alt={`${label} origin icon`}
                              width={20}
                              height={20}
                              style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                            />
                          ) : (
                            abbreviation
                          )}
                        </Avatar>
                      </Tooltip>
                    );
                  })}
                </Stack>
              ) : null}
            </Box>

            <Stack spacing={1}>
              <Typography
                component="h2"
                variant="h2"
                sx={{
                  fontSize: titleFontSize,
                  lineHeight: 1.1,
                  '& .soft-hyphen': {
                    position: 'relative',
                    '&::after': {
                      content: "'\u00AD'",
                    },
                  },
                }}
              >
                {displayTitle}
              </Typography>
              <FunctionChipList functions={additive.functions} sx={{ maxWidth: '100%' }} />
            </Stack>

            {showProductCount || showSearchSection ? (
              <Stack spacing={1} sx={{ mt: 'auto' }}>
                {showProductCount ? (
                  <Typography
                    variant="body2"
                    color={highlightProducts ? 'text.primary' : 'text.secondary'}
                    sx={{
                      display: 'flex',
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 0.5,
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    Found in
                    <Box component="span" sx={{ fontWeight: 600, color: 'text.primary' }}>
                      {' '}
                      {productCountLabel}
                    </Box>
                    products
                  </Typography>
                ) : null}
                {showSearchSection ? (
                  <Box sx={{ opacity: searchSectionOpacity }}>
                    {hasSparkline ? <SearchSparkline values={additive.searchSparkline ?? []} /> : null}
                    {hasSearchMetrics ? (
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ display: 'flex', gap: 0.5, alignItems: 'center', mt: hasSparkline ? 0.5 : 0 }}
                      >
                        <Box component="span">#{additive.searchRank}</Box>
                        <Box component="span">{searchVolumeLabel}</Box>
                        <Box component="span">/ mo</Box>
                      </Typography>
                    ) : null}
                  </Box>
                ) : null}
              </Stack>
            ) : null}
          </Stack>
        </CardContent>
      </CardActionArea>
    </Card>
  );
}
