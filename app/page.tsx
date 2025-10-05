import Link from 'next/link';
import { Avatar, Box, Card, CardActionArea, CardContent, Chip, Stack, Typography } from '@mui/material';

import { getAdditives } from '../lib/additives';
import { SearchSparkline } from '../components/SearchSparkline';
import { formatMonthlyVolume } from '../lib/format';

const additives = getAdditives();

const getOriginLabel = (origin: string) => {
  const letters = origin.replace(/[^A-Za-z]/g, '');

  if (letters.length === 0) {
    return '';
  }

  const first = letters.charAt(0).toUpperCase();
  const second = letters.charAt(1);

  return `${first}${second ? second.toLowerCase() : ''}`;
};

export default function HomePage() {
  return (
    <Box component="section" display="flex" flexDirection="column" gap={4}>
      <Box display="flex" flexDirection="column" gap={1.5} maxWidth={720}>
        <Typography component="h1" variant="h1">
          Food additives
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Explore the essential information behind common food additives. Compare their purposes and quickly
          access in-depth resources to make informed decisions about what goes into your food.
        </Typography>
      </Box>

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
        {additives.map((additive) => {
          const hasSparkline =
            Array.isArray(additive.searchSparkline) &&
            additive.searchSparkline.some((value) => value !== null);
          const hasSearchMetrics =
            typeof additive.searchRank === 'number' && typeof additive.searchVolume === 'number';
          const showSearchSection = hasSparkline || hasSearchMetrics;
          const visibleFunctions = additive.functions.slice(0, 2);
          const hiddenFunctionCount = Math.max(additive.functions.length - visibleFunctions.length, 0);
          const origins = additive.origin.filter((origin) => origin.trim().length > 0);

          return (
            <Card key={additive.slug} sx={{ display: 'flex', flexDirection: 'column' }}>
              <CardActionArea component={Link} href={`/${additive.slug}`} sx={{ flexGrow: 1 }}>
                <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
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
                      <Box sx={{ minHeight: 28 }} />
                    )}
                  </Box>

                  <Typography component="h2" variant="h2">
                    {additive.title}
                  </Typography>

                  {visibleFunctions.length > 0 ? (
                    <Stack direction="row" spacing={1} alignItems="center" sx={{ flexWrap: 'nowrap' }}>
                      {visibleFunctions.map((fn) => (
                        <Chip key={fn} label={fn} variant="outlined" size="small" />
                      ))}
                      {hiddenFunctionCount > 0 && (
                        <Chip label={`(+${hiddenFunctionCount})`} variant="outlined" size="small" />
                      )}
                    </Stack>
                  ) : (
                    <Box sx={{ minHeight: 24 }} />
                  )}

                  {showSearchSection ? (
                    <Stack direction="row" alignItems="center" spacing={1.5}>
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
                    <Box sx={{ height: 40 }} />
                  )}
                </CardContent>
              </CardActionArea>
            </Card>
          );
        })}
      </Box>
    </Box>
  );
}
