import Link from 'next/link';
import { Box, Card, CardActionArea, CardContent, Chip, Stack, Typography } from '@mui/material';

import type { Additive } from '../lib/additives';
import { formatMonthlyVolume } from '../lib/format';
import { SearchSparkline } from './SearchSparkline';

interface AdditiveGridProps {
  items: Additive[];
  emptyMessage?: string;
}

export function AdditiveGrid({ items, emptyMessage = 'No additives found.' }: AdditiveGridProps) {
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

        return (
          <Card key={additive.slug} sx={{ display: 'flex', flexDirection: 'column' }}>
            <CardActionArea component={Link} href={`/${additive.slug}`} sx={{ flexGrow: 1 }}>
              <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Box display="flex" flexDirection="column" gap={0.5}>
                  <Typography variant="overline" color="text.secondary" letterSpacing={1.2}>
                    {additive.eNumber}
                  </Typography>
                  <Typography component="h2" variant="h2">
                    {additive.title}
                  </Typography>
                </Box>
                {additive.functions.length > 0 ? (
                  <Stack direction="row" flexWrap="wrap" gap={1}>
                    {additive.functions.map((fn) => (
                      <Chip key={fn} label={fn} variant="outlined" />
                    ))}
                  </Stack>
                ) : (
                  <Box sx={{ minHeight: '1.5rem' }} />
                )}
                {hasSearchMetrics ? (
                  <Stack direction="row" alignItems="baseline" gap={1}>
                    <Typography component="span" variant="subtitle1" fontWeight={600}>
                      #{additive.searchRank}
                    </Typography>
                    <Typography component="span" variant="body2" color="text.secondary">
                      {formatMonthlyVolume(additive.searchVolume!)} / mo
                    </Typography>
                  </Stack>
                ) : (
                  <Box sx={{ minHeight: '1.5rem' }} />
                )}
              </CardContent>
            </CardActionArea>
            {hasSparkline && (
              <Box
                component={Link}
                href={`/${additive.slug}#search-history`}
                sx={{
                  px: 2,
                  pb: 1.5,
                  pt: 1,
                  display: 'block',
                }}
              >
                <SearchSparkline values={additive.searchSparkline ?? []} />
              </Box>
            )}
          </Card>
        );
      })}
    </Box>
  );
}
