'use client';

import { useMemo } from 'react';
import { ResponsiveLine } from '@nivo/line';
import { Box, useTheme, useMediaQuery } from '@mui/material';

import { formatMonthlyVolume } from '../lib/format';

export interface SearchHistoryPoint {
  date: string;
  volume: number;
}

interface SearchHistoryChartProps {
  metrics: SearchHistoryPoint[];
  domain?: { min: number; max: number } | null;
}

export function SearchHistoryChart({ metrics, domain }: SearchHistoryChartProps) {
  const theme = useTheme();

  const toUtcMonth = (dateString: string): Date | null => {
    const parsed = new Date(dateString);
    if (Number.isNaN(parsed.getTime())) {
      return null;
    }
    // Anchor to midday UTC to avoid local timezone shifting the month backward.
    return new Date(Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), 1, 12));
  };

  const normalisedMetrics = useMemo(
    () =>
      metrics
        .map((point) => {
          const date = toUtcMonth(point.date);
          if (!date) {
            return null;
          }
          return { x: date, y: point.volume };
        })
        .filter((entry): entry is { x: Date; y: number } => entry !== null),
    [metrics],
  );

  const data = useMemo(
    () => [
      {
        id: 'search-volume',
        data: normalisedMetrics,
      },
    ],
    [normalisedMetrics],
  );

  const years = useMemo(() => {
    const uniqueYears = Array.from(new Set(normalisedMetrics.map((point) => point.x.getUTCFullYear())));

    uniqueYears.sort((a, b) => a - b);

    return uniqueYears;
  }, [normalisedMetrics]);

  const isCompact = useMediaQuery(theme.breakpoints.down('md'));

  const tickValues = useMemo(() => {
    const step = isCompact ? 2 : 1;
    return years
      .filter((_, index) => index % step === 0)
      .map((year) => new Date(Date.UTC(year, 0, 1)));
  }, [years, isCompact]);

  const margin = useMemo(
    () =>
      isCompact
        ? { top: 20, right: 12, bottom: 40, left: 48 }
        : { top: 20, right: 24, bottom: 40, left: 56 },
    [isCompact],
  );

  return (
    <Box sx={{ width: '100%', height: { xs: 260, sm: 300, md: 340 } }}>
      <ResponsiveLine
        data={data}
        margin={margin}
        xScale={{ type: 'time', format: 'native', precision: 'month' }}
        xFormat="time:%b %Y"
        yScale={{
          type: 'linear',
          min: domain?.min ?? 'auto',
          max: domain?.max ?? 'auto',
          stacked: false,
        }}
        curve="monotoneX"
        colors={[theme.palette.primary.main]}
        axisBottom={{
          format: '%Y',
          tickValues: isCompact ? 'every 2 years' : 'every year',
          tickSize: 6,
          tickPadding: 8,
          legendOffset: 32,
        }}
        axisLeft={{
          tickSize: 6,
          tickPadding: 8,
          format: (value) => formatMonthlyVolume(Number(value)),
        }}
        theme={{
          axis: {
            domain: {
              line: {
                stroke: theme.palette.divider,
                strokeWidth: 1,
              },
            },
            ticks: {
              line: {
                stroke: theme.palette.divider,
                strokeWidth: 1,
              },
              text: {
                fill: theme.palette.text.secondary,
                fontSize: 12,
              },
            },
          },
          grid: {
            line: {
              stroke: theme.palette.divider,
              strokeWidth: 1,
              strokeDasharray: '3 6',
            },
          },
        }}
        enablePoints={false}
        useMesh
        enableArea
        areaOpacity={0.08}
        enableSlices="x"
        sliceTooltip={({ slice }) => (
          <Box
            sx={{
              backgroundColor: theme.palette.background.paper,
              borderRadius: 1,
              boxShadow: theme.shadows[3],
              border: `1px solid ${theme.palette.divider}`,
              px: 1.5,
              py: 0.75,
              display: 'flex',
              flexDirection: 'column',
              gap: 0.5,
            }}
          >
            {slice.points.map((point) => (
              <Box key={point.id} sx={{ display: 'flex', flexDirection: 'column' }}>
                <Box component="span" sx={{ fontSize: 12, color: theme.palette.text.secondary }}>
                  {(point.data.x instanceof Date ? point.data.x : new Date(point.data.x as Date)).toLocaleDateString(
                    undefined,
                    {
                      month: 'short',
                      year: 'numeric',
                      timeZone: 'UTC',
                    },
                  )}
                </Box>
                <Box component="span" sx={{ fontSize: 14, fontWeight: 600 }}>
                  {formatMonthlyVolume(point.data.y as number)} / mo
                </Box>
              </Box>
            ))}
          </Box>
        )}
      />
    </Box>
  );
}
