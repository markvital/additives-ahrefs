'use client';

import { Chip, Tooltip } from '@mui/material';
import type { SxProps, Theme } from '@mui/material/styles';

import type { AwarenessScoreResult } from '../lib/awareness';

const START_COLOR = { r: 255, g: 153, b: 153 } as const;
const END_COLOR = { r: 255, g: 0, b: 0 } as const;

const clamp = (value: number, min: number, max: number) => {
  if (value < min) {
    return min;
  }

  if (value > max) {
    return max;
  }

  return value;
};

const interpolateColor = (ratio: number) => {
  const clamped = clamp(ratio, 0, 1);
  const r = Math.round(START_COLOR.r + (END_COLOR.r - START_COLOR.r) * clamped);
  const g = Math.round(START_COLOR.g + (END_COLOR.g - START_COLOR.g) * clamped);
  const b = Math.round(START_COLOR.b + (END_COLOR.b - START_COLOR.b) * clamped);

  const toHex = (component: number) => component.toString(16).padStart(2, '0');

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
};

const getTooltipMessage = (index: number): string => {
  if (!Number.isFinite(index) || index <= 0) {
    return 'Compares searches to usage. ×1.0 = normal; above 1 = over-aware; below 1 = under-aware.';
  }

  if (index > 1.25) {
    return "Searched much more than it's used in products. Likely over-aware / buzzy. Compares searches to usage. ×1.0 = normal; above 1 = over-aware; below 1 = under-aware.";
  }

  if (index < 0.8) {
    return "Used widely but searched less than expected. Likely under-aware. Compares searches to usage. ×1.0 = normal; above 1 = over-aware; below 1 = under-aware.";
  }

  return 'Searched proportional to its use. Typical awareness. Compares searches to usage. ×1.0 = normal; above 1 = over-aware; below 1 = under-aware.';
};

interface AwarenessScoreChipProps {
  score: AwarenessScoreResult | null | undefined;
  size?: 'small' | 'medium';
  sx?: SxProps<Theme>;
}

export function AwarenessScoreChip({ score, size = 'small', sx }: AwarenessScoreChipProps) {
  if (!score || !Number.isFinite(score.index) || score.index <= 0) {
    return null;
  }

  const colorRatio = clamp((score.colorScore ?? 50) / 100, 0, 1);
  const backgroundColor = interpolateColor(colorRatio);
  const tooltipText = getTooltipMessage(score.index);
  const label = `×${score.index.toFixed(1)}`;

  return (
    <Tooltip title={tooltipText} arrow enterTouchDelay={0} leaveTouchDelay={1500}>
      <Chip
        size={size}
        label={label}
        sx={{
          bgcolor: backgroundColor,
          color: '#ffffff',
          fontWeight: 600,
          borderRadius: '999px',
          fontVariantNumeric: 'tabular-nums',
          '& .MuiChip-label': {
            px: 1.25,
            py: 0.5,
            fontWeight: 600,
          },
          ...sx,
        }}
      />
    </Tooltip>
  );
}
