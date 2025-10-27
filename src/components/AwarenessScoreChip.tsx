'use client';

import type { SyntheticEvent } from 'react';
import { Box, Chip, Link as MuiLink, Stack, Tooltip, Typography } from '@mui/material';
import type { SxProps, Theme } from '@mui/material/styles';

import type { AwarenessScoreResult } from '../lib/awareness';

const START_COLOR = { r: 194, g: 159, b: 251 } as const;
const END_COLOR = { r: 128, g: 55, b: 182 } as const;

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

const getTooltipExplanation = (index: number): string => {
  if (!Number.isFinite(index) || index <= 0) {
    return 'Awareness data is not available.';
  }

  if (index > 1.25) {
    return "Searched much more than it's used in products. Likely over-aware / buzzy.";
  }

  if (index < 0.8) {
    return 'Used widely but searched less than expected. Likely under-aware.';
  }

  return 'Searched proportional to its use. Typical awareness.';
};

const formatGridLabel = (index: number): string => {
  if (index >= 100) {
    return `×${Math.round(index)}`;
  }

  if (index >= 10) {
    return `×${index.toFixed(1)}`;
  }

  return `×${index.toFixed(2)}`;
};

const buildTooltipContent = (index: number, formattedIndex: string) => {
  const explanation = getTooltipExplanation(index);

  return (
    <Stack spacing={0.5}>
      <Typography component="span" variant="body2" fontWeight={700}>
        Awareness Score - {formattedIndex.replace(/^×/, '')}
      </Typography>
      <Typography component="span" variant="body2" sx={{ fontStyle: 'italic' }}>
        {explanation}
      </Typography>
      <Typography component="span" variant="body2">
        Compares searches to usage. ×1.0 = normal; above 1 = over-aware; below 1 = under-aware.{' '}
        <MuiLink href="/about#awareness_score" underline="always" color="inherit" sx={{ fontWeight: 600 }}>
          read more
        </MuiLink>
      </Typography>
    </Stack>
  );
};

interface AwarenessScoreChipProps {
  score: AwarenessScoreResult | null | undefined;
  size?: 'small' | 'medium';
  sx?: SxProps<Theme>;
  /**
   * Adjusts how the chip label is formatted.
   * - `default`: always show two decimal places.
   * - `grid`: compact formatting (2 decimals under 10, 1 decimal for 10–99.9, whole numbers at 100+).
   */
  labelStyle?: 'default' | 'grid';
}

export function AwarenessScoreChip({
  score,
  size = 'small',
  sx,
  labelStyle = 'default',
}: AwarenessScoreChipProps) {
  if (!score || !Number.isFinite(score.index) || score.index <= 0) {
    return null;
  }

  const colorRatio = clamp((score.colorScore ?? 50) / 100, 0, 1);
  const backgroundColor = interpolateColor(colorRatio);
  const formattedIndexForTooltip = `×${score.index.toFixed(2)}`;
  const label = labelStyle === 'grid' ? formatGridLabel(score.index) : formattedIndexForTooltip;
  const tooltipContent = buildTooltipContent(score.index, formattedIndexForTooltip);

  const wrapperSx: SxProps<Theme> = Array.isArray(sx)
    ? [{ display: 'inline-flex', alignItems: 'center' }, ...sx]
    : typeof sx === 'function'
      ? (theme) => ({ display: 'inline-flex', alignItems: 'center', ...sx(theme) })
      : { display: 'inline-flex', alignItems: 'center', ...(sx ?? {}) };

  return (
    <Box sx={wrapperSx}>
      <Tooltip title={tooltipContent} arrow enterTouchDelay={0} leaveTouchDelay={1500}>
        <Chip
          size={size}
          label={label}
          onClick={(event: SyntheticEvent) => {
            event.stopPropagation();
          }}
          onPointerDown={(event: SyntheticEvent) => {
            event.stopPropagation();
          }}
          onPointerUp={(event: SyntheticEvent) => {
            event.stopPropagation();
          }}
          onTouchStart={(event: SyntheticEvent) => {
            event.stopPropagation();
          }}
          sx={{
            bgcolor: backgroundColor,
            color: '#ffffff',
            fontWeight: 600,
            borderRadius: '999px',
            fontVariantNumeric: 'tabular-nums',
            cursor: 'default',
            '& .MuiChip-label': {
              px: 1.25,
              py: 0.5,
              fontWeight: 600,
            },
          }}
        />
      </Tooltip>
    </Box>
  );
}
