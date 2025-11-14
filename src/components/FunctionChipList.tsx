'use client';

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Box, Chip, Stack, Tooltip, Typography, type StackProps } from '@mui/material';

import { formatFunctionLabel } from '../lib/additive-format';

interface FunctionChipListProps extends Omit<StackProps, 'direction'> {
  functions: string[];
  maxVisible?: number;
}

const isOverflowing = (element: HTMLElement) => {
  const widthOverflow = Math.ceil(element.scrollWidth) > Math.ceil(element.clientWidth + 0.5);
  const heightOverflow = Math.ceil(element.scrollHeight) > Math.ceil(element.clientHeight + 0.5);

  return widthOverflow || heightOverflow;
};

export function FunctionChipList({ functions, maxVisible, spacing = 1, sx, ...rest }: FunctionChipListProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const normalizedFunctions = useMemo(
    () => functions.map((fn) => fn.trim()).filter((fn) => fn.length > 0),
    [functions]
  );
  const normalizedLength = normalizedFunctions.length;
  const desiredMax = typeof maxVisible === 'number' ? Math.max(0, maxVisible) : normalizedLength;
  const targetCount = Math.max(0, Math.min(desiredMax, normalizedLength));
  const [displayCount, setDisplayCount] = useState(targetCount);
  const [resizeDirection, setResizeDirection] = useState<'grow' | 'shrink' | null>(null);

  useEffect(() => {
    setDisplayCount((prev) => Math.min(prev, targetCount));
  }, [targetCount]);

  useLayoutEffect(() => {
    const container = containerRef.current;

    if (!container) {
      if (displayCount !== targetCount) {
        setDisplayCount(targetCount);
      }

      if (resizeDirection !== null) {
        setResizeDirection(null);
      }

      return;
    }

    const overflow = displayCount > 0 ? isOverflowing(container) : false;

    if (displayCount > targetCount) {
      setDisplayCount(targetCount);
      if (resizeDirection !== null) {
        setResizeDirection(null);
      }
      return;
    }

    if (displayCount > 0 && overflow) {
      setDisplayCount(displayCount - 1);
      if (resizeDirection !== null) {
        setResizeDirection(null);
      }
      return;
    }

    if (resizeDirection === 'grow' && !overflow && displayCount < targetCount) {
      setResizeDirection(null);
      setDisplayCount(targetCount);
      return;
    }

    if (resizeDirection !== null) {
      setResizeDirection(null);
    }
  }, [displayCount, resizeDirection, targetCount]);

  useLayoutEffect(() => {
    const container = containerRef.current;

    if (!container || typeof ResizeObserver === 'undefined') {
      return;
    }

    let previousWidth = container.getBoundingClientRect().width;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];

      if (!entry) {
        return;
      }

      const { width } = entry.contentRect;
      const widthDifference = width - previousWidth;
      previousWidth = width;

      if (widthDifference > 1) {
        setResizeDirection('grow');
      } else if (widthDifference < -1) {
        setResizeDirection('shrink');
      }
    });

    observer.observe(container);

    return () => {
      observer.disconnect();
    };
  }, [maxVisible, normalizedLength]);

  const hiddenCount = Math.max(normalizedLength - displayCount, 0);
  const displayedFunctions = normalizedFunctions.slice(0, displayCount);
  const hiddenFunctions = useMemo(() => normalizedFunctions.slice(displayCount), [displayCount, normalizedFunctions]);
  const hasHiddenFunctions = hiddenFunctions.length > 0;

  if (normalizedLength === 0) {
    return null;
  }
  const chipSx = {
    textTransform: 'none',
    whiteSpace: 'nowrap',
    maxWidth: 'none',
    flexShrink: 0,
    borderRadius: '7.5px',
    bgcolor: '#f4f4f4',
    color: '#787878',
    border: 'none',
    '& .MuiChip-label': {
      px: '5px',
      py: '3px',
      color: '#787878',
    },
  } as const;

  const stackSx = Array.isArray(sx) ? sx : sx ? [sx] : [];

  return (
    <Stack
      ref={containerRef}
      direction="row"
      alignItems="center"
      spacing={spacing}
      useFlexGap
      data-function-chips
      sx={[
        {
          flexWrap: 'nowrap',
          overflow: 'hidden',
          minHeight: 28,
          width: '100%',
          minWidth: 0,
          boxSizing: 'border-box',
        },
        ...stackSx,
      ]}
      {...rest}
    >
      {displayedFunctions.map((fn) => (
        <Chip key={fn} label={formatFunctionLabel(fn)} variant="filled" size="small" sx={chipSx} />
      ))}
      {hasHiddenFunctions && (
        <Box component="span" sx={{ display: 'inline-flex' }}>
          <Tooltip
            arrow
            enterTouchDelay={0}
            leaveTouchDelay={1500}
            disableInteractive={false}
            slotProps={{ tooltip: { sx: { pointerEvents: 'auto' } } }}
            title={
              <Stack spacing={0.5}>
                {hiddenFunctions.map((fn) => (
                  <Typography
                    key={fn}
                    component="span"
                    variant="body2"
                    sx={{ display: 'block', lineHeight: 1.4 }}
                  >
                    {formatFunctionLabel(fn)}
                  </Typography>
                ))}
              </Stack>
            }
          >
            <Chip
              label={`+${hiddenCount}`}
              variant="filled"
              size="small"
              sx={{ ...chipSx, cursor: 'default' as const }}
              clickable={false}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
              }}
              onPointerDown={(event) => {
                event.stopPropagation();
              }}
              onPointerUp={(event) => {
                event.stopPropagation();
              }}
              onTouchStart={(event) => {
                event.stopPropagation();
              }}
              onTouchEnd={(event) => {
                event.preventDefault();
                event.stopPropagation();
              }}
              onKeyDown={(event) => {
                if (event.key === 'Escape' || event.key === 'Esc') {
                  event.preventDefault();
                  event.stopPropagation();
                }
              }}
            />
          </Tooltip>
        </Box>
      )}
    </Stack>
  );
}
