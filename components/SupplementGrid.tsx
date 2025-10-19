import Link from 'next/link';
import { Box, Card, CardActionArea, CardContent, Chip, Divider, Stack, Typography } from '@mui/material';

import type { SupplementAdditive } from '../lib/supplement-additives';
import type { AdditiveSortMode } from '../lib/additives';
import { DEFAULT_ADDITIVE_SORT_MODE } from '../lib/additives';
import { formatMonthlyVolume, formatProductCount } from '../lib/format';

interface SupplementGridProps {
  items: SupplementAdditive[];
  sortMode?: AdditiveSortMode;
}

const formatList = (values: string[]): string => {
  if (values.length === 0) {
    return '';
  }

  if (values.length === 1) {
    return values[0];
  }

  if (values.length === 2) {
    return `${values[0]} and ${values[1]}`;
  }

  const allButLast = values.slice(0, -1);
  const last = values[values.length - 1];
  return `${allButLast.join(', ')}, and ${last}`;
};

export function SupplementGrid({ items, sortMode = DEFAULT_ADDITIVE_SORT_MODE }: SupplementGridProps) {
  if (items.length === 0) {
    return (
      <Typography variant="body1" color="text.secondary">
        No supplement-specific additives match your filters.
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
      {items.map((item) => {
        const showProductCount = typeof item.productCount === 'number' && item.productCount > 0;
        const showSearchRank = typeof item.searchRank === 'number' && typeof item.searchVolume === 'number';
        const deliverySummary = formatList(item.supplementDeliveryFormats);
        const roles = item.supplementRoles.slice(0, 3);
        const extraRoleCount = Math.max(item.supplementRoles.length - roles.length, 0);

        return (
          <Card key={item.slug} sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <CardActionArea component={Link} href={`/${item.slug}`} sx={{ flexGrow: 1 }}>
              <CardContent sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                <Stack spacing={1.5} sx={{ flexGrow: 1 }}>
                  <Box display="flex" justifyContent="space-between" alignItems="flex-start">
                    <Typography variant="overline" color="text.secondary" letterSpacing={1.2}>
                      {item.eNumber}
                    </Typography>
                    {showProductCount ? (
                      <Chip
                        label={formatProductCount(item.productCount!)}
                        size="small"
                        color={sortMode === 'product-count' ? 'primary' : 'default'}
                        sx={{ fontWeight: 600 }}
                      />
                    ) : (
                      <Box sx={{ minWidth: 28 }} />
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
                      minHeight: '3.5rem',
                    }}
                  >
                    {item.title}
                  </Typography>

                  {roles.length > 0 ? (
                    <Stack direction="row" spacing={1} alignItems="center" sx={{ flexWrap: 'wrap', minHeight: 28 }}>
                      {roles.map((role) => (
                        <Chip key={role} label={role} variant="outlined" size="small" />
                      ))}
                      {extraRoleCount > 0 && <Chip label={`+${extraRoleCount}`} variant="outlined" size="small" />}
                    </Stack>
                  ) : (
                    <Box sx={{ minHeight: 28 }} />
                  )}

                  <Typography variant="body2" color="text.primary">
                    {item.supplementHighlights}
                  </Typography>

                  {deliverySummary && (
                    <Typography variant="body2" color="text.secondary">
                      Works best in {deliverySummary} formats.
                    </Typography>
                  )}
                </Stack>

                <Divider sx={{ my: 2 }} />

                <Stack spacing={1}>
                  {showSearchRank ? (
                    <Stack direction="row" spacing={1} alignItems="baseline">
                      <Typography component="span" variant="subtitle2" fontWeight={600}>
                        #{item.searchRank}
                      </Typography>
                      <Typography component="span" variant="body2" color="text.secondary">
                        {formatMonthlyVolume(item.searchVolume!)} searches / mo
                      </Typography>
                    </Stack>
                  ) : null}

                  {item.supplementSafetyNotes && (
                    <Typography variant="caption" color="text.secondary">
                      Safety: {item.supplementSafetyNotes}
                    </Typography>
                  )}

                  {item.supplementRegulatoryNotes && (
                    <Typography variant="caption" color="text.secondary">
                      Regulatory: {item.supplementRegulatoryNotes}
                    </Typography>
                  )}
                </Stack>
              </CardContent>
            </CardActionArea>
          </Card>
        );
      })}
    </Box>
  );
}
