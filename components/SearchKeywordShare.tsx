'use client';

import { useMemo, useState, type MouseEvent } from 'react';
import { Box, Popover, Stack, Typography, useTheme } from '@mui/material';

import { formatMonthlyVolume } from '../lib/format';

export interface KeywordVolumeEntry {
  keyword: string;
  volume: number;
}

interface SearchKeywordShareProps {
  keywords: KeywordVolumeEntry[];
  total: number;
  label?: string;
  sx?: Parameters<typeof Box>[0]['sx'];
}

const percentageFormatter = new Intl.NumberFormat(undefined, {
  maximumFractionDigits: 1,
});

export function SearchKeywordShare({ keywords, total, label, sx }: SearchKeywordShareProps) {
  const theme = useTheme();
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);

  const segments = useMemo(() => {
    if (!Array.isArray(keywords)) {
      return [] as KeywordVolumeEntry[];
    }

    return keywords
      .map((entry) => {
        const keyword = typeof entry?.keyword === 'string' ? entry.keyword.trim() : '';
        const volume =
          typeof entry?.volume === 'number' && Number.isFinite(entry.volume)
            ? Math.max(0, entry.volume)
            : 0;
        return { keyword, volume };
      })
      .filter((entry) => entry.keyword.length > 0 && entry.volume > 0);
  }, [keywords]);

  const totalVolume = useMemo(() => {
    const providedTotal =
      typeof total === 'number' && Number.isFinite(total) && total >= 0 ? total : 0;
    if (providedTotal > 0) {
      return providedTotal;
    }
    return segments.reduce((acc, entry) => acc + entry.volume, 0);
  }, [segments, total]);

  const hasSegments = segments.length > 0 && totalVolume > 0;

  const sortedSegments = useMemo(() => {
    if (!hasSegments) {
      return [] as KeywordVolumeEntry[];
    }
    return [...segments].sort((a, b) => b.volume - a.volume);
  }, [hasSegments, segments]);

  const handleButtonClick = (event: MouseEvent<HTMLButtonElement>) => {
    if (anchorEl) {
      setAnchorEl(null);
      return;
    }
    setAnchorEl(event.currentTarget);
  };

  const handleClosePopover = () => {
    setAnchorEl(null);
  };

  const displayLabel = useMemo(() => {
    if (typeof label === 'string' && label.trim().length > 0) {
      return label.trim();
    }

    if (!hasSegments) {
      return '';
    }

    const uniqueCount = segments
      .map((segment) => segment.keyword)
      .filter((keyword, index, list) => keyword.length > 0 && list.indexOf(keyword) === index).length;

    if (uniqueCount === 0) {
      return '';
    }

    return `${uniqueCount} ${uniqueCount === 1 ? 'keyword' : 'keywords'}`;
  }, [hasSegments, label, segments]);

  if (!hasSegments) {
    return null;
  }

  return (
    <>
      <Box
        component="button"
        type="button"
        onClick={handleButtonClick}
        aria-haspopup="dialog"
        aria-expanded={Boolean(anchorEl)}
        sx={{
          backgroundColor: 'transparent',
          border: 'none',
          color: 'inherit',
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 0.25,
          p: 0,
          font: 'inherit',
          textDecoration: 'underline',
          textDecorationColor: theme.palette.text.secondary,
          textDecorationThickness: 'from-font',
          textUnderlineOffset: 2,
          '&:hover': {
            textDecorationColor: theme.palette.text.primary,
          },
          '&:focus-visible': {
            outline: `2px solid ${theme.palette.primary.main}`,
            outlineOffset: 2,
          },
          ...sx,
        }}
      >
        {displayLabel}
      </Box>

      <Popover
        open={Boolean(anchorEl)}
        anchorEl={anchorEl}
        onClose={handleClosePopover}
        disableRestoreFocus
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        transformOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        slotProps={{
          paper: {
            sx: {
              px: 2,
              py: 1.5,
              borderRadius: 2,
              boxShadow: theme.shadows[3],
              border: `1px solid ${theme.palette.divider}`,
              maxWidth: 320,
            },
          },
        }}
      >
        <Stack spacing={1}>
          {sortedSegments.map((segment, index) => {
            const share = segment.volume / totalVolume;
            return (
              <Stack
                key={`${segment.keyword}-${index}`}
                direction="row"
                spacing={1.25}
                alignItems="center"
                flexWrap="wrap"
              >
                <Typography
                  variant="body2"
                  component="span"
                  sx={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600, minWidth: 52 }}
                >
                  {percentageFormatter.format(share * 100)}%
                </Typography>
                <Typography
                  variant="body2"
                  component="span"
                  color="text.secondary"
                  sx={{ fontVariantNumeric: 'tabular-nums', minWidth: 92 }}
                >
                  {formatMonthlyVolume(segment.volume)} / mo
                </Typography>
                <Typography variant="body2" component="span" sx={{ color: 'text.primary' }}>
                  {segment.keyword}
                </Typography>
              </Stack>
            );
          })}
        </Stack>
      </Popover>
    </>
  );
}
