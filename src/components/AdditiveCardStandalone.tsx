'use client';

import { useMemo } from 'react';
import Image from 'next/image';
import { Avatar, Box, Card, CardContent, Stack, Tooltip, Typography } from '@mui/material';

import type { AdditiveGridItem as AdditiveGridItemType } from '../lib/additives';
import { formatOriginLabel } from '../lib/additive-format';
import { formatMonthlyVolume, formatProductCount } from '../lib/format';
import { getOriginAbbreviation, getOriginIcon } from '../lib/origin-icons';
import { SearchSparkline } from './SearchSparkline';
import { theme } from '../lib/theme';
import { FunctionChipList } from './FunctionChipList';
import type { AwarenessScoreResult } from '../lib/awareness';
import { AwarenessScoreChip } from './AwarenessScoreChip';

const resolveTypographySize = (value: string | number | undefined, fallback = '1.5rem') => {
  if (typeof value === 'number') {
    return `${value}px`;
  }

  if (typeof value === 'string' && value.trim().length > 0) {
    return value;
  }

  return fallback;
};

const baseTitleFontSize = resolveTypographySize(theme.typography.h2?.fontSize);
const SOFT_HYPHEN = '­';

const hyphenateLongWords = (text: string) =>
  text.replace(/[A-Za-z]{12,}/g, (word) => {
    let result = '';

    for (let index = 0; index < word.length; index += 6) {
      const sliceEnd = Math.min(word.length, index + 6);
      result += word.slice(index, sliceEnd);

      if (sliceEnd < word.length) {
        result += SOFT_HYPHEN;
      }
    }

    return result;
  });

interface AdditiveCardStandaloneProps {
  additive: AdditiveGridItemType;
  awarenessScore: AwarenessScoreResult | null | undefined;
}

/**
 * Standalone card component for preview generation.
 * This is a simplified version of AdditiveGridCard without drag-and-drop functionality.
 */
export function AdditiveCardStandalone({ additive, awarenessScore }: AdditiveCardStandaloneProps) {
  // For preview, don't show sparkline to avoid rendering issues
  const hasSparkline = false;
  const hasSearchMetrics =
    typeof additive.searchRank === 'number' && typeof additive.searchVolume === 'number';
  const showSearchSection = hasSparkline || hasSearchMetrics;
  const origins = additive.origin.filter((origin) => origin.trim().length > 0);
  const highlightProducts = false; // Always false for preview
  const searchSectionOpacity = highlightProducts ? 0.6 : 1;
  const productCountValue =
    typeof additive.productCount === 'number' ? Math.max(0, additive.productCount) : null;
  const showProductCount = typeof productCountValue === 'number' && productCountValue > 0;
  const productCountLabel = showProductCount ? formatProductCount(productCountValue) : null;
  const normalizedTitle = additive.title.replace(/\s+/g, ' ').trim();
  const words = normalizedTitle.split(/\s+/);
  const longestWordLength = words.reduce((max, word) => Math.max(max, word.replace(/[^A-Za-z]/g, '').length), 0);
  const titleLength = normalizedTitle.length;
  let titleFontScale = 1;

  if (titleLength > 72 || longestWordLength > 32) {
    titleFontScale = 0.78;
  } else if (titleLength > 58 || longestWordLength > 26) {
    titleFontScale = 0.84;
  } else if (titleLength > 42 || longestWordLength > 22) {
    titleFontScale = 0.9;
  } else if (titleLength > 28 || longestWordLength > 18) {
    titleFontScale = 0.96;
  }

  const titleFontSize = titleFontScale === 1 ? undefined : `calc(${baseTitleFontSize} * ${titleFontScale})`;
  const showSoftHyphenation = longestWordLength > 18;
  const displayTitle = showSoftHyphenation ? hyphenateLongWords(normalizedTitle) : normalizedTitle;
  const childCount = additive.childSlugs.length;
  const isFamily = childCount > 0;
  const familyTooltip = `additive family has ${childCount} additive${childCount === 1 ? '' : 's'}`;

  return (
    <Card
      sx={{
        display: 'flex',
        flexDirection: 'column',
        cursor: 'default',
      }}
    >
      <CardContent
        sx={{
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          width: '100%',
          boxSizing: 'border-box',
          px: 1.25,
          pt: 1.875,
          pb: 1.875,
          '&:last-child': { pb: 1.875 },
        }}
      >
        <Stack spacing={1.5} sx={{ flexGrow: 1, minHeight: 0 }}>
          <Box display="flex" justifyContent="space-between" alignItems="flex-start">
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography variant="overline" color="text.secondary" letterSpacing={1.2}>
                {additive.eNumber}
              </Typography>
              {isFamily ? (
                <Tooltip title={familyTooltip} arrow>
                  <Typography
                    component="span"
                    variant="overline"
                    sx={{
                      color: '#AAAAAA',
                      letterSpacing: 1.2,
                      textTransform: 'uppercase',
                    }}
                  >
                    family
                  </Typography>
                </Tooltip>
              ) : null}
            </Stack>
            {origins.length > 0 ? (
              <Stack direction="row" spacing={0.5} alignItems="center">
                {origins.map((origin) => {
                  const icon = getOriginIcon(origin);
                  const abbreviation = getOriginAbbreviation(origin);
                  const label = formatOriginLabel(origin);

                  return (
                    <Tooltip key={origin} title={label} arrow>
                      {icon ? (
                        <Avatar
                          sx={{
                            width: 20,
                            height: 20,
                            fontSize: '0.75rem',
                            bgcolor: 'transparent',
                          }}
                        >
                          <Image src={icon} alt={label} width={20} height={20} unoptimized />
                        </Avatar>
                      ) : (
                        <Avatar
                          sx={{
                            width: 20,
                            height: 20,
                            fontSize: '0.75rem',
                            bgcolor: '#f5f5f5',
                            color: 'text.secondary',
                          }}
                        >
                          {abbreviation}
                        </Avatar>
                      )}
                    </Tooltip>
                  );
                })}
              </Stack>
            ) : null}
          </Box>

          <Box>
            <Typography
              variant="h2"
              component="h2"
              sx={{
                fontSize: titleFontSize,
                wordBreak: 'break-word',
                hyphens: showSoftHyphenation ? 'auto' : 'none',
              }}
            >
              {displayTitle}
            </Typography>
          </Box>

          {additive.functions.length > 0 ? (
            <Box sx={{ minHeight: 0 }}>
              <FunctionChipList functions={additive.functions} maxVisibleChips={3} />
            </Box>
          ) : null}

          {showSearchSection ? (
            <Stack direction="row" spacing={2} alignItems="center" sx={{ opacity: searchSectionOpacity }}>
              {hasSearchMetrics ? (
                <Stack direction="column" spacing={0.5}>
                  <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1 }}>
                    {formatMonthlyVolume(additive.searchVolume ?? 0)}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1, fontSize: '0.65rem' }}>
                    #{additive.searchRank}
                  </Typography>
                </Stack>
              ) : null}
              {/* Sparkline disabled for preview to avoid rendering issues */}
            </Stack>
          ) : null}

          <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
            {showProductCount ? (
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{
                  fontSize: '0.7rem',
                  fontWeight: highlightProducts ? 600 : 400,
                  opacity: highlightProducts ? 1 : 0.8,
                }}
              >
                {productCountLabel}
              </Typography>
            ) : (
              <Box />
            )}
            {awarenessScore ? (
              <Box>
                <AwarenessScoreChip score={awarenessScore} />
              </Box>
            ) : null}
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
}
