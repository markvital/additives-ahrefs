import Image from 'next/image';
import Link from 'next/link';
import { Avatar, Box, Card, CardActionArea, CardContent, Stack, Tooltip, Typography } from '@mui/material';

import type { Additive, AdditiveSortMode } from '../lib/additives';
import { DEFAULT_ADDITIVE_SORT_MODE } from '../lib/additives';
import { formatOriginLabel } from '../lib/additive-format';
import { formatMonthlyVolume, formatProductCount } from '../lib/format';
import { getOriginAbbreviation, getOriginIcon } from '../lib/origin-icons';
import { SearchSparkline } from './SearchSparkline';
import { theme } from '../lib/theme';
import { FunctionChipList } from './FunctionChipList';

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
  items: Additive[];
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
      {items.map((additive) => {
        const hasSparkline =
          Array.isArray(additive.searchSparkline) &&
          additive.searchSparkline.some((value) => value !== null);
        const hasSearchMetrics =
          typeof additive.searchRank === 'number' && typeof additive.searchVolume === 'number';
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

        return (
          <Card key={additive.slug} sx={{ display: 'flex', flexDirection: 'column' }}>
            <CardActionArea
              component={Link}
              href={`/${additive.slug}`}
              sx={{ flexGrow: 1, display: 'flex', alignItems: 'stretch' }}
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
                    <Typography variant="overline" color="text.secondary" letterSpacing={1.2}>
                      {additive.eNumber}
                    </Typography>
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
                    ) : (
                      <Box sx={{ minHeight: 28, minWidth: 28 }} />
                    )}
                  </Box>

                  <Typography
                    component="h2"
                    variant="h2"
                    lang="en"
                    sx={{
                      display: '-webkit-box',
                      WebkitBoxOrient: 'vertical',
                      WebkitLineClamp: 3,
                      overflow: 'hidden',
                      width: '100%',
                      lineHeight: 1.2,
                      fontSize: titleFontSize,
                      overflowWrap: showSoftHyphenation ? 'anywhere' : 'break-word',
                      wordBreak: 'break-word',
                      hyphens: 'auto',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {displayTitle}
                  </Typography>

                  {additive.functions.length > 0 ? (
                    <FunctionChipList functions={additive.functions} sx={{ maxWidth: '100%' }} />
                  ) : (
                    <Box sx={{ minHeight: 28 }} />
                  )}
                </Stack>

                {showSearchSection ? (
                  <Stack
                    direction="row"
                    alignItems="center"
                    spacing={1.5}
                    sx={{ mt: 1.5, opacity: searchSectionOpacity }}
                  >
                    {hasSearchMetrics ? (
                      <Stack direction="row" alignItems="baseline" spacing={1} flexShrink={0}>
                        <Typography component="span" variant="subtitle1" fontWeight={600}>
                          #{additive.searchRank}
                        </Typography>
                        <Typography component="span" variant="body2" color="text.secondary">
                          {formatMonthlyVolume(additive.searchVolume!)} / mo
                        </Typography>
                      </Stack>
                    ) : (
                      <Box sx={{ minWidth: 0 }} />
                    )}
                    {hasSparkline ? (
                      <Box sx={{ flexGrow: 1, minWidth: 96, pr: 3 }}>
                        <SearchSparkline values={additive.searchSparkline ?? []} />
                      </Box>
                    ) : (
                      <Box sx={{ flexGrow: 1, height: 40 }} />
                    )}
                  </Stack>
                ) : (
                  <Box sx={{ height: 40, mt: 1.5 }} />
                )}
              </CardContent>
            </CardActionArea>
            {showProductCount && productCountLabel ? (
              <Box
                sx={{
                  px: 3,
                  py: 2,
                  bgcolor: highlightProducts ? 'grey.50' : 'background.paper',
                }}
              >
                <Typography
                  variant="body2"
                  color={highlightProducts ? 'text.primary' : 'text.secondary'}
                  sx={{ fontWeight: highlightProducts ? 600 : 400 }}
                >
                  Found in <Box component="span" sx={{ fontWeight: highlightProducts ? 600 : 500 }}>
                    {productCountLabel} products
                  </Box>
                </Typography>
              </Box>
            ) : null}
          </Card>
        );
      })}
    </Box>
  );
}
