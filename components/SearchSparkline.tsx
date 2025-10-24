'use client';

import { useMemo } from 'react';
import { ResponsiveLine } from '@nivo/line';
import type { LineCustomSvgLayer } from '@nivo/line';
import { Box, useTheme } from '@mui/material';

interface SearchSparklineProps {
  values: Array<number | null>;
}

type SparklineDatum = {
  x: number;
  y: number | null;
};

type SparklineSeries = {
  id: string;
  data: SparklineDatum[];
};

const buildSparklineData = (values: Array<number | null>): SparklineDatum[] => {
  const endYear = new Date().getUTCFullYear();
  const startYear = endYear - values.length + 1;

  return values.map((value, index) => ({
    x: startYear + index,
    y: value,
  }));
};

const firstPointLayer: LineCustomSvgLayer<SparklineSeries> = ({ series, xScale, yScale }) => {
  const [primarySeries] = series;

  if (!primarySeries) {
    return null;
  }

  const firstPoint = primarySeries.data.find((datum) => typeof datum.data.y === 'number');

  if (!firstPoint || typeof firstPoint.data.y !== 'number') {
    return null;
  }

  const cx = xScale(firstPoint.data.x);
  const cy = yScale(firstPoint.data.y);

  return <circle cx={cx} cy={cy} r={4} fill={primarySeries.color} />;
};

export function SearchSparkline({ values }: SearchSparklineProps) {
  const theme = useTheme();
  const series = useMemo(() => buildSparklineData(values), [values]);
  const color = theme.palette.grey[700] ?? theme.palette.text.secondary;
  const chartMargins = { top: 12, right: 16, bottom: 12, left: 16 } as const;

  return (
    <Box sx={{ width: '100%', height: 40 }}>
      <ResponsiveLine
        data={[
          {
            id: 'sparkline',
            data: series,
          },
        ]}
        margin={chartMargins}
        xScale={{ type: 'linear', min: 'auto', max: 'auto' }}
        yScale={{ type: 'linear', min: 'auto', max: 'auto' }}
        axisBottom={null}
        axisLeft={null}
        colors={[color]}
        theme={{
          axis: { ticks: { text: { fill: theme.palette.text.secondary } } },
        }}
        curve="monotoneX"
        enableArea={false}
        enablePoints={false}
        enableGridX={false}
        enableGridY={false}
        lineWidth={2}
        useMesh={false}
        isInteractive={false}
        layers={['lines', firstPointLayer]}
      />
    </Box>
  );
}
