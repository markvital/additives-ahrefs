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

  const data = useMemo(
    () => [
      {
        id: 'search-volume',
        data: metrics.map((point) => ({ x: new Date(point.date), y: point.volume })),
      },
    ],
    [metrics],
  );

  const isCompact = useMediaQuery(theme.breakpoints.down('md'));

  return (
    <Box sx={{ width: '100%', height: { xs: 260, sm: 300, md: 340 } }}>
      <ResponsiveLine
        data={data}
        margin={{ top: 20, right: 24, bottom: 40, left: 56 }}
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
                  {new Date(point.data.x as Date).toLocaleDateString(undefined, {
                    month: 'short',
                    year: 'numeric',
                  })}
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
