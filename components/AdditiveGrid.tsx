import Link from 'next/link';
import {
  Avatar,
  Box,
  Card,
  CardActionArea,
  CardActions,
  CardContent,
  Chip,
  Link as MuiLink,
  Stack,
  Typography,
} from '@mui/material';
import type { Theme } from '@mui/material/styles';

import type { Additive } from '../lib/additives';
import type { AdditiveSortMode } from '../lib/additive-sort';
import { formatInteger, formatMonthlyVolume } from '../lib/format';
import { SearchSparkline } from './SearchSparkline';
import { theme } from '../lib/theme';
import { getFdcProductSearchUrl } from '../lib/product-search';

const getOriginLabel = (origin: string) => {
  const letters = origin.replace(/[^A-Za-z]/g, '');

  if (letters.length === 0) {
    return '';
  }

  const first = letters.charAt(0).toUpperCase();
  const second = letters.charAt(1);

  return `${first}${second ? second.toLowerCase() : ''}`;
};

const getTitleMinHeight = (muiTheme: Theme) => {
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
  sortMode?: AdditiveSortMode;
}

export function AdditiveGrid({
  items,
  emptyMessage = 'No additives found.',
  sortMode = 'search',
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
        const isProductMode = sortMode === 'products';
        const showSearchSection = !isProductMode && (hasSparkline || hasSearchMetrics);
        const visibleFunctions = additive.functions.slice(0, 2);
        const hiddenFunctionCount = Math.max(additive.functions.length - visibleFunctions.length, 0);
        const origins = additive.origin.filter((origin) => origin.trim().length > 0);
        const productCount =
          typeof additive.productCount === 'number' && Number.isFinite(additive.productCount)
            ? Math.max(0, Math.round(additive.productCount))
            : null;
        const productSearchUrl = getFdcProductSearchUrl(additive.title);

        return (
          <Card key={additive.slug} sx={{ display: 'flex', flexDirection: 'column' }}>
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

                {showSearchSection ? (
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
                  <Box sx={{ height: isProductMode ? 0 : 40, mt: isProductMode ? 0 : 1.5 }} />
                )}
              </CardContent>
            </CardActionArea>
            <CardActions sx={{ px: 2, pt: 0, pb: 2 }}>
              <Typography
                variant={isProductMode ? 'body2' : 'caption'}
                color="text.secondary"
                sx={{ fontWeight: isProductMode ? 600 : 500 }}
              >
                {productCount !== null ? (
                  <MuiLink
                    href={productSearchUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    underline="hover"
                    sx={{ color: 'inherit', fontWeight: 'inherit' }}
                  >
                    Found in {formatInteger(productCount)} products
                  </MuiLink>
                ) : (
                  'Product count unavailable.'
                )}
              </Typography>
            </CardActions>
          </Card>
        );
      })}
    </Box>
  );
}
