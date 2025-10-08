'use client';

import { useMemo, useState, type MouseEvent } from 'react';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import { alpha } from '@mui/material/styles';
import { Box, Button, Popover, Stack, Typography, useTheme } from '@mui/material';

import { formatMonthlyVolume } from '../lib/format';

export interface KeywordVolumeEntry {
  keyword: string;
  volume: number;
}

interface SearchKeywordShareProps {
  keywords: KeywordVolumeEntry[];
  total: number;
}

const percentageFormatter = new Intl.NumberFormat(undefined, {
  maximumFractionDigits: 1,
});

export function SearchKeywordShare({ keywords, total }: SearchKeywordShareProps) {
  const theme = useTheme();
  const [expanded, setExpanded] = useState(false);
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const uniqueKeywords = useMemo(
    () =>
      (Array.isArray(keywords) ? keywords : [])
        .map((item) => (typeof item?.keyword === 'string' ? item.keyword.trim() : ''))
        .filter((item, index, list) => item.length > 0 && list.indexOf(item) === index),
    [keywords],
  );

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

  const handleToggle = () => {
    setExpanded((prev) => {
      if (prev) {
        setActiveIndex(null);
        setAnchorEl(null);
      }
      return !prev;
    });
  };

  const handleSegmentClick = (event: MouseEvent<HTMLButtonElement>, index: number) => {
    if (activeIndex === index) {
      setActiveIndex(null);
      setAnchorEl(null);
      return;
    }
    setActiveIndex(index);
    setAnchorEl(event.currentTarget);
  };

  const handleClosePopover = () => {
    setActiveIndex(null);
    setAnchorEl(null);
  };

  const popoverData = activeIndex !== null ? segments[activeIndex] : null;
  const arrowRotation = expanded ? 'rotate(180deg)' : 'rotate(0deg)';

  const colorSteps = [0.9, 0.75, 0.6, 0.45, 0.35, 0.25, 0.15];

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
      <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap">
        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 500 }}>
          data from {uniqueKeywords.length}{' '}
          {uniqueKeywords.length === 1 ? 'keyword' : 'keywords'}
        </Typography>
        <Button
          size="small"
          variant="text"
          onClick={handleToggle}
          endIcon={<KeyboardArrowDownIcon sx={{ transition: 'transform 0.2s', transform: arrowRotation }} />}
        >
          {expanded ? 'Show less' : 'Show more'}
        </Button>
      </Stack>

      {expanded && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {hasSegments ? (
            <Box
              sx={{
                display: 'flex',
                height: 32,
                borderRadius: 16,
                overflow: 'hidden',
                border: `1px solid ${theme.palette.divider}`,
                backgroundColor: theme.palette.background.paper,
              }}
            >
              {segments.map((segment, index) => {
                const share = segment.volume / totalVolume;
                const backgroundColor = alpha(
                  theme.palette.primary.main,
                  colorSteps[index % colorSteps.length],
                );

                return (
                  <Box
                    key={segment.keyword}
                    component="button"
                    type="button"
                    onClick={(event) => handleSegmentClick(event, index)}
                    aria-label={`${segment.keyword}: ${percentageFormatter.format(share * 100)}% share`}
                    sx={{
                      flexGrow: segment.volume,
                      border: 'none',
                      m: 0,
                      p: 0,
                      backgroundColor,
                      cursor: 'pointer',
                      transition: 'opacity 0.2s ease',
                      '&:hover': { opacity: 0.85 },
                      '&:focus-visible': {
                        outline: `2px solid ${theme.palette.primary.main}`,
                        outlineOffset: -2,
                      },
                    }}
                  />
                );
              })}
            </Box>
          ) : (
            <Typography variant="body2" color="text.secondary">
              No search volume data available yet.
            </Typography>
          )}
        </Box>
      )}

      <Popover
        open={Boolean(popoverData)}
        anchorEl={anchorEl}
        onClose={handleClosePopover}
        disableRestoreFocus
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        transformOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        slotProps={{
          paper: {
            sx: {
              px: 1.5,
              py: 1,
              borderRadius: 2,
              boxShadow: theme.shadows[3],
              border: `1px solid ${theme.palette.divider}`,
            },
          },
        }}
      >
        {popoverData && (
          <Stack spacing={0.5}>
            <Typography variant="subtitle2" component="span" sx={{ fontWeight: 600 }}>
              {popoverData.keyword}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {formatMonthlyVolume(popoverData.volume)} / mo
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {percentageFormatter.format((popoverData.volume / totalVolume) * 100)}% share
            </Typography>
          </Stack>
        )}
      </Popover>
    </Box>
  );
}
