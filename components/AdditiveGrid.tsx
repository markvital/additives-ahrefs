'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Avatar,
  Box,
  Card,
  CardActionArea,
  CardContent,
  Chip,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Typography,
  Link as MuiLink,
} from '@mui/material';
import type { SelectChangeEvent } from '@mui/material/Select';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import LaunchIcon from '@mui/icons-material/Launch';

import type { Additive } from '../lib/additives';
import { formatMonthlyVolume, formatProductCount } from '../lib/format';
import { getFdcProductSearchUrl } from '../lib/products';
import { SearchSparkline } from './SearchSparkline';
import { theme } from '../lib/theme';

type SortField = 'searchRank' | 'products';

type SortOrder = 'asc' | 'desc';

const getOriginLabel = (origin: string) => {
  const letters = origin.replace(/[^A-Za-z]/g, '');

  if (letters.length === 0) {
    return '';
  }

  const first = letters.charAt(0).toUpperCase();
  const second = letters.charAt(1);

  return `${first}${second ? second.toLowerCase() : ''}`;
};

const getTitleMinHeight = (muiTheme: typeof theme) => {
  const toRem = (value: string | number) => {
    if (typeof value === 'number') {
      return value / muiTheme.typography.htmlFontSize;
    }

    if (value.endsWith('rem')) {
      return parseFloat(value);
    }

    if (value.endsWith('px')) {
      return parseFloat(value) / muiTheme.typography.htmlFontSize;
    }

    return parseFloat(value);
  };

  const parseLineHeight = (value: string | number) => {
    if (typeof value === 'number') {
      return value;
    }

    if (value.endsWith('%')) {
      return parseFloat(value) / 100;
    }

    return parseFloat(value);
  };

  const fontSize = toRem(muiTheme.typography.h2.fontSize ?? 0);
  const lineHeight = parseLineHeight(muiTheme.typography.h2.lineHeight ?? 0);

  const safeFontSize = Number.isFinite(fontSize) && fontSize > 0 ? fontSize : 1;
  const safeLineHeight = Number.isFinite(lineHeight) && lineHeight > 0 ? lineHeight : 1.2;

  return `${safeFontSize * safeLineHeight * 2}rem`;
};

const titleMinHeight = getTitleMinHeight(theme);

interface AdditiveGridProps {
  items: Additive[];
  emptyMessage?: string;
}

const sortAdditives = (items: Additive[], field: SortField, order: SortOrder): Additive[] => {
  const copy = [...items];

  if (field === 'products') {
    copy.sort((a, b) => {
      const aHas = typeof a.productCount === 'number';
      const bHas = typeof b.productCount === 'number';

      if (aHas && bHas) {
        const diff = (a.productCount ?? 0) - (b.productCount ?? 0);
        return order === 'asc' ? diff : -diff;
      }

      if (aHas && !bHas) {
        return -1;
      }

      if (!aHas && bHas) {
        return 1;
      }

      return a.title.localeCompare(b.title);
    });

    return copy;
  }

  copy.sort((a, b) => {
    const aHas = typeof a.searchRank === 'number';
    const bHas = typeof b.searchRank === 'number';

    if (aHas && bHas) {
      const diff = (a.searchRank ?? 0) - (b.searchRank ?? 0);
      return order === 'asc' ? diff : -diff;
    }

    if (aHas && !bHas) {
      return order === 'asc' ? -1 : 1;
    }

    if (!aHas && bHas) {
      return order === 'asc' ? 1 : -1;
    }

    return a.title.localeCompare(b.title);
  });

  return copy;
};

const getSortOrderLabel = (order: SortOrder, field: SortField): string => {
  if (field === 'products') {
    return order === 'asc' ? 'Ascending (fewest first)' : 'Descending (most first)';
  }

  return order === 'asc' ? 'Ascending (best rank first)' : 'Descending (lowest rank last)';
};

export function AdditiveGrid({ items, emptyMessage = 'No additives found.' }: AdditiveGridProps) {
  const [sortField, setSortField] = useState<SortField>('searchRank');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');

  const sortedItems = useMemo(() => sortAdditives(items, sortField, sortOrder), [items, sortField, sortOrder]);
  const showProductMode = sortField === 'products';

  if (items.length === 0) {
    return (
      <Typography variant="body1" color="text.secondary">
        {emptyMessage}
      </Typography>
    );
  }

  const handleSortFieldChange = (event: SelectChangeEvent<SortField>) => {
    const value = event.target.value as SortField;
    setSortField(value);
    setSortOrder(value === 'products' ? 'desc' : 'asc');
  };

  const handleToggleOrder = () => {
    setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
  };

  const OrderIcon = sortOrder === 'asc' ? ArrowUpwardIcon : ArrowDownwardIcon;

  return (
    <Stack spacing={2.5} width="100%">
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        justifyContent={{ xs: 'flex-start', sm: 'flex-end' }}
        alignItems={{ xs: 'stretch', sm: 'center' }}
        spacing={1.5}
      >
        <FormControl size="small" sx={{ minWidth: { xs: '100%', sm: 200 } }}>
          <InputLabel id="additive-sort-label">Sort by</InputLabel>
          <Select<SortField>
            labelId="additive-sort-label"
            id="additive-sort"
            label="Sort by"
            value={sortField}
            onChange={handleSortFieldChange}
          >
            <MenuItem value="searchRank">Search rank</MenuItem>
            <MenuItem value="products">Products</MenuItem>
          </Select>
        </FormControl>

        <IconButton
          onClick={handleToggleOrder}
          aria-label={`Toggle sort order: ${getSortOrderLabel(sortOrder, sortField)}`}
          title={getSortOrderLabel(sortOrder, sortField)}
          sx={{
            alignSelf: { xs: 'flex-end', sm: 'center' },
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 2,
            width: 40,
            height: 40,
          }}
        >
          <OrderIcon fontSize="small" />
        </IconButton>
      </Stack>

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
        {sortedItems.map((additive) => {
          const hasSparkline =
            Array.isArray(additive.searchSparkline) && additive.searchSparkline.some((value) => value !== null);
          const hasSearchMetrics =
            typeof additive.searchRank === 'number' && typeof additive.searchVolume === 'number';
          const origins = additive.origin.filter((origin) => origin.trim().length > 0);
          const productCount = typeof additive.productCount === 'number' ? additive.productCount : null;
          const productSearchUrl = getFdcProductSearchUrl(additive.title);
          const visibleFunctions = additive.functions.slice(0, 2);
          const hiddenFunctionCount = Math.max(additive.functions.length - visibleFunctions.length, 0);

          return (
            <Card key={additive.slug} sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              <CardActionArea
                component={Link}
                href={`/${additive.slug}`}
                sx={{ flexGrow: 1, display: 'flex', alignItems: 'stretch' }}
              >
                <CardContent sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                  <Stack spacing={1.5} sx={{ flexGrow: 1 }}>
                    <Box display="flex" justifyContent="space-between" alignItems="flex-start">
                      <Typography variant="overline" color="text.secondary" letterSpacing={1.2}>
                        {additive.eNumber}
                      </Typography>
                      {origins.length > 0 ? (
                        <Stack direction="row" spacing={0.5}>
                          {origins.map((origin) => {
                            const label = getOriginLabel(origin);

                            return (
                              <Avatar
                                key={origin}
                                variant="circular"
                                sx={{
                                  width: 28,
                                  height: 28,
                                  bgcolor: 'grey.100',
                                  color: 'text.primary',
                                  fontSize: 12,
                                  fontWeight: 600,
                                }}
                              >
                                {label}
                              </Avatar>
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
                      sx={{
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                        minHeight: titleMinHeight,
                      }}
                    >
                      {additive.title}
                    </Typography>

                    {visibleFunctions.length > 0 ? (
                      <Stack direction="row" spacing={1} alignItems="center" sx={{ flexWrap: 'nowrap', minHeight: 28 }}>
                        {visibleFunctions.map((fn) => (
                          <Chip key={fn} label={fn} variant="outlined" size="small" />
                        ))}
                        {hiddenFunctionCount > 0 && (
                          <Chip label={`+${hiddenFunctionCount}`} variant="outlined" size="small" />
                        )}
                      </Stack>
                    ) : (
                      <Box sx={{ minHeight: 28 }} />
                    )}
                  </Stack>

                  {!showProductMode ? (
                    <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mt: 1.5 }}>
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
                        <Box sx={{ flexGrow: 1, minWidth: 96 }}>
                          <SearchSparkline values={additive.searchSparkline ?? []} />
                        </Box>
                      ) : (
                        <Box sx={{ flexGrow: 1, height: 40 }} />
                      )}
                    </Stack>
                  ) : (
                    <Box sx={{ mt: 1.5, minHeight: 40 }} />
                  )}
                </CardContent>
              </CardActionArea>

              {showProductMode ? (
                <Box
                  sx={{
                    px: 3,
                    py: 1.75,
                    borderTop: '1px solid',
                    borderColor: 'divider',
                    display: 'flex',
                    flexDirection: { xs: 'column', sm: 'row' },
                    gap: 1,
                    justifyContent: 'space-between',
                    alignItems: { xs: 'flex-start', sm: 'center' },
                  }}
                >
                  <Typography variant="body2" color="text.secondary">
                    {productCount !== null
                      ? `Found in ${formatProductCount(productCount)} products`
                      : 'Product count unavailable.'}
                  </Typography>
                  {productCount !== null ? (
                    <MuiLink
                      href={productSearchUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      underline="hover"
                      sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, fontWeight: 500 }}
                    >
                      View products
                      <LaunchIcon fontSize="inherit" />
                    </MuiLink>
                  ) : null}
                </Box>
              ) : null}
            </Card>
          );
        })}
      </Box>
    </Stack>
  );
}
