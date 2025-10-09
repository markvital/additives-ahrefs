'use client';

import { useMemo, useState, type KeyboardEvent } from 'react';
import {
  Box,
  ClickAwayListener,
  Table,
  TableBody,
  TableCell,
  TableRow,
  Tooltip,
  Typography,
  useTheme,
} from '@mui/material';

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
  const [open, setOpen] = useState(false);

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
      .filter((entry) => entry.keyword.length > 0);
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

  const handleButtonClick = () => {
    setOpen((previous) => !previous);
  };

  const handleCloseTooltip = () => {
    setOpen(false);
  };

  const handleButtonKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'Escape' || event.key === 'Esc') {
      event.preventDefault();
      event.stopPropagation();
      handleCloseTooltip();
    }
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
    <ClickAwayListener onClickAway={handleCloseTooltip}>
      <Box component="span" sx={{ display: 'inline-flex' }}>
        <Tooltip
          arrow
          open={open}
          onClose={handleCloseTooltip}
          disableFocusListener
          disableHoverListener
          disableTouchListener
          placement="bottom"
          title={
            <Table
              size="small"
              aria-label="Keyword search volume breakdown"
              sx={{
                '& td, & th': {
                  borderBottom: `1px solid ${theme.palette.divider}`,
                },
              }}
            >
              <TableBody>
                {sortedSegments.map((segment, index) => {
                  const share = segment.volume / totalVolume;
                  return (
                    <TableRow key={`${segment.keyword}-${index}`} sx={{ '&:last-of-type td': { borderBottom: 0 } }}>
                      <TableCell
                        component="th"
                        scope="row"
                        sx={{
                          fontWeight: 600,
                          whiteSpace: 'nowrap',
                          fontVariantNumeric: 'tabular-nums',
                          pr: 2,
                        }}
                      >
                        {percentageFormatter.format(share * 100)}%
                      </TableCell>
                      <TableCell
                        align="right"
                        sx={{
                          color: 'text.secondary',
                          whiteSpace: 'nowrap',
                          fontVariantNumeric: 'tabular-nums',
                          pr: 2,
                        }}
                      >
                        {formatMonthlyVolume(segment.volume)} / mo
                      </TableCell>
                      <TableCell
                        sx={{
                          color: 'text.primary',
                          whiteSpace: 'normal',
                          wordBreak: 'break-word',
                          pr: 1,
                        }}
                      >
                        {segment.keyword}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          }
          slotProps={{
            popper: {
              disablePortal: true,
            },
            tooltip: {
              sx: {
                backgroundColor: theme.palette.background.paper,
                border: `1px solid ${theme.palette.divider}`,
                boxShadow: theme.shadows[3],
                color: theme.palette.text.primary,
                borderRadius: 1,
                maxWidth: 360,
                p: 0,
                overflow: 'visible',
              },
            },
            arrow: {
              sx: {
                color: theme.palette.background.paper,
                fontSize: 24,
                '&::before': {
                  border: `1px solid ${theme.palette.divider}`,
                  boxShadow: theme.shadows[1],
                },
              },
            },
          }}
        >
          <Box
            component="button"
            type="button"
            onClick={handleButtonClick}
            onKeyDown={handleButtonKeyDown}
            aria-haspopup="true"
            aria-expanded={open}
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
        </Tooltip>
      </Box>
    </ClickAwayListener>
  );
}
