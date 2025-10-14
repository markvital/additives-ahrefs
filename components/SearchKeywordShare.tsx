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
import type { SearchKeywordConfig } from '../lib/search-volume';

export interface KeywordVolumeEntry {
  keyword: string;
  volume: number;
}

interface SearchKeywordShareProps {
  keywords: KeywordVolumeEntry[];
  total: number;
  label?: string;
  sx?: Parameters<typeof Box>[0]['sx'];
  keywordConfig?: SearchKeywordConfig | null;
}

const percentageFormatter = new Intl.NumberFormat(undefined, {
  maximumFractionDigits: 1,
});

export function SearchKeywordShare({ keywords, total, label, sx, keywordConfig }: SearchKeywordShareProps) {
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

  const includedKeywords = useMemo(() => {
    if (!keywordConfig || !Array.isArray(keywordConfig.included)) {
      return [] as string[];
    }
    return keywordConfig.included;
  }, [keywordConfig]);

  const supplementaryKeywords = useMemo(() => {
    if (!keywordConfig || !Array.isArray(keywordConfig.supplementary)) {
      return [] as string[];
    }
    return keywordConfig.supplementary;
  }, [keywordConfig]);

  const excludedKeywords = useMemo(() => {
    if (!keywordConfig || !Array.isArray(keywordConfig.excluded)) {
      return [] as string[];
    }
    return keywordConfig.excluded;
  }, [keywordConfig]);

  const supplementarySet = useMemo(() => {
    return new Set(
      supplementaryKeywords
        .map((keyword) => (typeof keyword === 'string' ? keyword.trim().toLowerCase() : ''))
        .filter((keyword) => keyword.length > 0),
    );
  }, [supplementaryKeywords]);

  const includedKeywordSummary = useMemo(() => {
    if (!Array.isArray(includedKeywords) || includedKeywords.length === 0) {
      return '';
    }

    return includedKeywords
      .map((keyword) => {
        const trimmed = typeof keyword === 'string' ? keyword.trim() : '';
        if (!trimmed) {
          return null;
        }

        if (supplementarySet.has(trimmed.toLowerCase())) {
          return `${trimmed} (supplementary)`;
        }

        return trimmed;
      })
      .filter((entry): entry is string => typeof entry === 'string' && entry.length > 0)
      .join(', ');
  }, [includedKeywords, supplementarySet]);

  const excludedKeywordSummary = useMemo(() => {
    if (!Array.isArray(excludedKeywords) || excludedKeywords.length === 0) {
      return '';
    }

    return excludedKeywords
      .map((keyword) => (typeof keyword === 'string' ? keyword.trim() : ''))
      .filter((keyword) => keyword.length > 0)
      .join(', ');
  }, [excludedKeywords]);

  const hasSupplementaryKeywords = supplementaryKeywords.length > 0;
  const hasKeywordMeta = includedKeywordSummary.length > 0 || excludedKeywordSummary.length > 0;

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
            <Box>
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
              {hasKeywordMeta && (
                <Box
                  sx={{
                    borderTop: `1px solid ${theme.palette.divider}`,
                    px: 2,
                    py: 1.5,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 1,
                  }}
                >
                  {includedKeywordSummary.length > 0 && (
                    <Box>
                      <Typography
                        variant="caption"
                        sx={{
                          display: 'block',
                          color: 'text.secondary',
                          textTransform: 'uppercase',
                          letterSpacing: 0.4,
                          mb: 0.5,
                        }}
                      >
                        Keywords used
                      </Typography>
                      <Typography
                        variant="body2"
                        sx={{
                          color: 'text.primary',
                          whiteSpace: 'normal',
                        }}
                      >
                        {includedKeywordSummary}
                      </Typography>
                      {hasSupplementaryKeywords && (
                        <Typography
                          variant="caption"
                          sx={{
                            display: 'block',
                            color: 'text.secondary',
                            mt: 0.5,
                          }}
                        >
                          Supplementary keywords were added manually to improve coverage.
                        </Typography>
                      )}
                    </Box>
                  )}
                  {excludedKeywordSummary.length > 0 && (
                    <Box>
                      <Typography
                        variant="caption"
                        sx={{
                          display: 'block',
                          color: 'text.secondary',
                          textTransform: 'uppercase',
                          letterSpacing: 0.4,
                          mb: 0.5,
                        }}
                      >
                        Excluded keywords
                      </Typography>
                      <Typography
                        variant="body2"
                        sx={{
                          color: 'text.secondary',
                          whiteSpace: 'normal',
                        }}
                      >
                        {excludedKeywordSummary}
                      </Typography>
                    </Box>
                  )}
                </Box>
              )}
            </Box>
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
