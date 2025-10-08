'use client';

import { MouseEvent, useMemo, useState } from 'react';
import { Box, Button, Popover, Typography, useTheme } from '@mui/material';

import { formatMonthlyVolume } from '../lib/format';
import type { SearchVolumeDataset } from '../lib/search-volume';

interface SearchVolumeShareProps {
  dataset: SearchVolumeDataset;
}

interface ShareSegment {
  keyword: string;
  volume: number;
  share: number;
}

export function SearchVolumeShare({ dataset }: SearchVolumeShareProps) {
  const theme = useTheme();
  const [expanded, setExpanded] = useState(false);
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const { segments, totalVolume, keywordCount } = useMemo(() => {
    const totalFromData = dataset.totalSearchVolume;
    const fallbackTotal = dataset.keywords.reduce((acc, entry) => acc + Math.max(0, entry.volume), 0);
    const resolvedTotal = totalFromData > 0 ? totalFromData : fallbackTotal;

    const mappedSegments: ShareSegment[] = dataset.keywords.map((entry) => {
      const volume = Math.max(0, entry.volume);
      const share = resolvedTotal > 0 ? volume / resolvedTotal : 0;
      return {
        keyword: entry.keyword,
        volume,
        share,
      };
    });

    return {
      segments: mappedSegments,
      totalVolume: resolvedTotal,
      keywordCount: dataset.keywords.length,
    };
  }, [dataset]);

  const handleToggle = () => {
    setExpanded((prev) => {
      const next = !prev;
      if (!next) {
        setAnchorEl(null);
        setActiveIndex(null);
      }
      return next;
    });
  };

  const handleSegmentClick = (index: number) => (event: MouseEvent<HTMLElement>) => {
    if (activeIndex === index) {
      setAnchorEl(null);
      setActiveIndex(null);
      return;
    }

    setAnchorEl(event.currentTarget);
    setActiveIndex(index);
  };

  const handleClosePopover = () => {
    setAnchorEl(null);
    setActiveIndex(null);
  };

  const activeSegment = activeIndex !== null ? segments[activeIndex] : null;
  const open = Boolean(anchorEl) && activeSegment !== null;

  const hasPositiveVolume = segments.some((segment) => segment.volume > 0);

  const colorForIndex = (index: number): string => {
    if (index === 0) {
      return theme.palette.primary.main;
    }

    const greyShades = [800, 700, 600, 500, 400, 300, 200] as const;
    const shade = greyShades[(index - 1) % greyShades.length];
    return theme.palette.grey[shade];
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
        <Typography variant="body2" color="text.secondary">
          data from {keywordCount} {keywordCount === 1 ? 'keyword' : 'keywords'}
        </Typography>
        <Button onClick={handleToggle} size="small" variant="text" aria-expanded={expanded}>
          {expanded ? 'Show less' : 'Show more'}
        </Button>
      </Box>

      {expanded && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {hasPositiveVolume ? (
            <Box
              sx={{
                display: 'flex',
                alignItems: 'stretch',
                borderRadius: 1,
                overflow: 'hidden',
                minHeight: 28,
                border: `1px solid ${theme.palette.divider}`,
              }}
            >
              {segments.map((segment, index) => {
                const sharePercent = segment.share * 100;
                const backgroundColor = colorForIndex(index);

                return (
                  <Box
                    key={segment.keyword}
                    component="button"
                    type="button"
                    onClick={handleSegmentClick(index)}
                    aria-label={`Show share for ${segment.keyword}`}
                    sx={{
                      cursor: 'pointer',
                      border: 'none',
                      backgroundColor: 'transparent',
                      flexGrow: segment.share > 0 ? segment.share : 0,
                      flexBasis: 0,
                      minWidth: segment.share > 0 ? 0 : 16,
                      position: 'relative',
                      p: 0,
                    }}
                  >
                    <Box
                      sx={{
                        width: '100%',
                        height: '100%',
                        backgroundColor,
                        opacity: activeIndex === index ? 0.85 : 1,
                        transition: 'opacity 120ms ease-in-out',
                      }}
                    >
                      <Box
                        component="span"
                        sx={{
                          position: 'absolute',
                          inset: 0,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          px: 1,
                          color: theme.palette.getContrastText(backgroundColor),
                          fontSize: 12,
                          fontWeight: 600,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {sharePercent >= 10 ? `${sharePercent.toFixed(0)}%` : ''}
                      </Box>
                    </Box>
                  </Box>
                );
              })}
            </Box>
          ) : (
            <Typography variant="body2" color="text.secondary">
              No search volume data available yet.
            </Typography>
          )}

          <Typography variant="caption" color="text.secondary">
            Click a segment to see details.
          </Typography>
        </Box>
      )}

      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={handleClosePopover}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        transformOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        disableRestoreFocus
      >
        {activeSegment && (
          <Box sx={{ px: 2, py: 1.5, maxWidth: 220, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
              {activeSegment.keyword}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {formatMonthlyVolume(activeSegment.volume)} / mo
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {totalVolume > 0 ? `${((activeSegment.share || 0) * 100).toFixed(1)}% of total` : 'No share data'}
            </Typography>
          </Box>
        )}
      </Popover>
    </Box>
  );
}
