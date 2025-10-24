'use client';

import {
  MutableRefObject,
  forwardRef,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  Avatar,
  Box,
  Button,
  Card,
  CardActionArea,
  CardContent,
  Chip,
  IconButton,
  Paper,
  Portal,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';

import type { Additive, AdditiveSortMode } from '../lib/additives';
import { formatOriginLabel } from '../lib/additive-format';
import { formatMonthlyVolume, formatProductCount } from '../lib/format';
import { getOriginAbbreviation, getOriginIcon } from '../lib/origin-icons';
import { SearchSparkline } from './SearchSparkline';
import { theme } from '../lib/theme';

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
const SOFT_HYPHEN = '\\u00ad';

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

type LegendAnchorKey =
  | 'eNumber'
  | 'title'
  | 'origin'
  | 'functions'
  | 'searchRank'
  | 'searchVolume'
  | 'searchHistory'
  | 'productCount';

type LegendRefMap = Partial<Record<LegendAnchorKey, MutableRefObject<HTMLElement | null>>>;

type LegendAnchorPositions = Partial<Record<LegendAnchorKey, { x: number; y: number }>>;

type LegendConnectorDirection = 'left' | 'right' | 'top' | 'bottom';

const DEFAULT_SORT_MODE: AdditiveSortMode = 'product-count';

interface LegendCalloutDefinition {
  key: LegendAnchorKey;
  label: string;
  direction: LegendConnectorDirection;
  gap: number;
  crossOffset?: number;
  width?: number;
  align?: 'left' | 'center' | 'right';
}

const assignLegendRef = <T extends HTMLElement>(
  refObj?: MutableRefObject<HTMLElement | null>,
) => {
  if (!refObj) {
    return undefined;
  }

  return (instance: T | null) => {
    refObj.current = instance;
  };
};

interface AdditiveCardProps {
  additive: Additive;
  sortMode: AdditiveSortMode;
  disableLink?: boolean;
  legendRefs?: LegendRefMap;
  highlight?: boolean;
}

const AdditiveCard = forwardRef<HTMLDivElement, AdditiveCardProps>(function AdditiveCard(
  { additive, sortMode, disableLink = false, legendRefs, highlight = false },
  ref,
) {
  const hasSparkline =
    Array.isArray(additive.searchSparkline) && additive.searchSparkline.some((value) => value !== null);
  const hasSearchMetrics =
    typeof additive.searchRank === 'number' && typeof additive.searchVolume === 'number';
  const showSearchSection = hasSparkline || hasSearchMetrics;
  const visibleFunctions = additive.functions.slice(0, 2);
  const hiddenFunctionCount = Math.max(additive.functions.length - visibleFunctions.length, 0);
  const origins = additive.origin.filter((origin) => origin.trim().length > 0);
  const highlightProducts = sortMode === 'product-count';
  const searchSectionOpacity = highlightProducts ? 0.6 : 1;
  const productCountValue =
    typeof additive.productCount === 'number' ? Math.max(0, additive.productCount) : null;
  const showProductCount = typeof productCountValue === 'number' && productCountValue > 0;
  const productCountLabel = showProductCount ? formatProductCount(productCountValue) : null;
  const normalizedTitle = additive.title.replace(/\s+/g, ' ').trim();
  const words = normalizedTitle.split(/\s+/);
  const longestWordLength = words.reduce(
    (max, word) => Math.max(max, word.replace(/[^A-Za-z]/g, '').length),
    0,
  );
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

  const cardContent = (
    <CardContent sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Stack spacing={1.5} sx={{ flexGrow: 1 }}>
        <Box display="flex" justifyContent="space-between" alignItems="flex-start">
          <Typography
            ref={assignLegendRef<HTMLSpanElement>(legendRefs?.eNumber)}
            component="span"
            variant="overline"
            color="text.secondary"
            letterSpacing={1.2}
          >
            {additive.eNumber}
          </Typography>
          {origins.length > 0 ? (
            <Stack
              ref={assignLegendRef<HTMLDivElement>(legendRefs?.origin)}
              direction="row"
              spacing={0.5}
            >
              {origins.map((origin) => {
                const icon = getOriginIcon(origin);
                const abbreviation = getOriginAbbreviation(origin);
                const label = formatOriginLabel(origin);

                return (
                  <Tooltip key={origin} title={label} arrow>
                    <Avatar
                      variant="circular"
                      sx={{
                        width: 28,
                        height: 28,
                        bgcolor: 'grey.100',
                        color: 'text.primary',
                        fontSize: 12,
                        fontWeight: 600,
                        p: 0.5,
                      }}
                    >
                      {icon ? (
                        <Image
                          src={icon}
                          alt={`${label} origin icon`}
                          width={20}
                          height={20}
                          style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                        />
                      ) : (
                        abbreviation
                      )}
                    </Avatar>
                  </Tooltip>
                );
              })}
            </Stack>
          ) : (
            <Box sx={{ minHeight: 28, minWidth: 28 }} />
          )}
        </Box>

        <Typography
          ref={assignLegendRef<HTMLHeadingElement>(legendRefs?.title)}
          component="h2"
          variant="h2"
          lang="en"
          sx={{
            display: '-webkit-box',
            WebkitBoxOrient: 'vertical',
            WebkitLineClamp: 3,
            overflow: 'hidden',
            width: '100%',
            lineHeight: 1.2,
            fontSize: titleFontSize,
            overflowWrap: showSoftHyphenation ? 'anywhere' : 'break-word',
            wordBreak: 'break-word',
            hyphens: 'auto',
            textOverflow: 'ellipsis',
          }}
        >
          {displayTitle}
        </Typography>

        {visibleFunctions.length > 0 ? (
          <Stack
            ref={assignLegendRef<HTMLDivElement>(legendRefs?.functions)}
            direction="row"
            spacing={1}
            alignItems="center"
            sx={{ flexWrap: 'nowrap', minHeight: 28 }}
          >
            {visibleFunctions.map((fn) => (
              <Chip key={fn} label={fn} variant="outlined" size="small" />
            ))}
            {hiddenFunctionCount > 0 && <Chip label={`+${hiddenFunctionCount}`} variant="outlined" size="small" />}
          </Stack>
        ) : (
          <Box sx={{ minHeight: 28 }} />
        )}
      </Stack>

      {showSearchSection ? (
        <Stack
          direction="row"
          alignItems="center"
          spacing={1.5}
          sx={{ mt: 1.5, opacity: searchSectionOpacity }}
        >
          {hasSearchMetrics ? (
            <Stack direction="row" alignItems="baseline" spacing={1} flexShrink={0}>
              <Typography
                ref={assignLegendRef<HTMLSpanElement>(legendRefs?.searchRank)}
                component="span"
                variant="subtitle1"
                fontWeight={600}
              >
                #{additive.searchRank}
              </Typography>
              <Typography
                ref={assignLegendRef<HTMLSpanElement>(legendRefs?.searchVolume)}
                component="span"
                variant="body2"
                color="text.secondary"
              >
                {formatMonthlyVolume(additive.searchVolume!)} / mo
              </Typography>
            </Stack>
          ) : (
            <Box sx={{ minWidth: 0 }} />
          )}
          {hasSparkline ? (
            <Box
              ref={assignLegendRef<HTMLDivElement>(legendRefs?.searchHistory)}
              sx={{ flexGrow: 1, minWidth: 96 }}
            >
              <SearchSparkline values={additive.searchSparkline ?? []} />
            </Box>
          ) : (
            <Box sx={{ flexGrow: 1, height: 40 }} />
          )}
        </Stack>
      ) : (
        <Box sx={{ height: 40, mt: 1.5 }} />
      )}
    </CardContent>
  );

  return (
    <Card
      ref={ref}
      sx={{
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        boxShadow: highlight
          ? '0 0 0 2px rgba(148, 163, 184, 0.35), 0 24px 60px rgba(15, 23, 42, 0.55)'
          : undefined,
        transform: highlight ? 'translateY(-2px)' : undefined,
        transition: 'transform 150ms ease, box-shadow 150ms ease',
        backgroundColor: 'background.paper',
      }}
    >
      {disableLink ? (
        <Box sx={{ flexGrow: 1, display: 'flex', alignItems: 'stretch' }}>{cardContent}</Box>
      ) : (
        <CardActionArea
          component={Link}
          href={`/${additive.slug}`}
          sx={{ flexGrow: 1, display: 'flex', alignItems: 'stretch' }}
        >
          {cardContent}
        </CardActionArea>
      )}
      {showProductCount && productCountLabel ? (
        <Box sx={{ px: 3, py: 2, bgcolor: highlightProducts ? 'grey.50' : 'background.paper' }}>
          <Typography
            ref={assignLegendRef<HTMLParagraphElement>(legendRefs?.productCount)}
            variant="body2"
            color={highlightProducts ? 'text.primary' : 'text.secondary'}
            sx={{ fontWeight: highlightProducts ? 600 : 400 }}
          >
            Found in{' '}
            <Box component="span" sx={{ fontWeight: highlightProducts ? 600 : 500 }}>
              {productCountLabel} products
            </Box>
          </Typography>
        </Box>
      ) : null}
    </Card>
  );
});

interface LegendOverlayProps {
  additive: Additive;
  sortMode: AdditiveSortMode;
  cardRect: DOMRect | null;
  onClose: () => void;
}

const DESKTOP_CALLOUTS: LegendCalloutDefinition[] = [
  { key: 'eNumber', label: 'e-number', direction: 'left', gap: 72, crossOffset: -28, width: 180, align: 'right' },
  { key: 'title', label: 'name', direction: 'top', gap: 88, width: 160 },
  { key: 'origin', label: 'origin', direction: 'top', gap: 88, crossOffset: 132, width: 150, align: 'left' },
  { key: 'functions', label: 'functional class', direction: 'right', gap: 80, crossOffset: -24, width: 200 },
  {
    key: 'searchRank',
    label: 'search interest rank',
    direction: 'left',
    gap: 104,
    crossOffset: 16,
    width: 220,
    align: 'right',
  },
  {
    key: 'searchVolume',
    label: 'search volume per month in U.S.',
    direction: 'left',
    gap: 104,
    crossOffset: 60,
    width: 260,
    align: 'right',
  },
  { key: 'searchHistory', label: 'search history', direction: 'bottom', gap: 88, crossOffset: -44, width: 180 },
  {
    key: 'productCount',
    label: 'number of products containing this additive',
    direction: 'bottom',
    gap: 120,
    crossOffset: 96,
    width: 280,
    align: 'left',
  },
];

const MOBILE_CALLOUTS: LegendCalloutDefinition[] = [
  { key: 'eNumber', label: 'e-number', direction: 'top', gap: 72, crossOffset: -96, width: 180, align: 'left' },
  { key: 'title', label: 'name', direction: 'top', gap: 80, width: 180 },
  { key: 'origin', label: 'origin', direction: 'top', gap: 72, crossOffset: 96, width: 180, align: 'right' },
  {
    key: 'functions',
    label: 'functional class',
    direction: 'bottom',
    gap: 88,
    crossOffset: -72,
    width: 220,
  },
  {
    key: 'searchRank',
    label: 'search interest rank',
    direction: 'bottom',
    gap: 92,
    crossOffset: -24,
    width: 220,
  },
  {
    key: 'searchVolume',
    label: 'search volume per month in U.S.',
    direction: 'bottom',
    gap: 92,
    crossOffset: 36,
    width: 240,
  },
  { key: 'searchHistory', label: 'search history', direction: 'bottom', gap: 120, width: 200 },
  {
    key: 'productCount',
    label: 'number of products containing this additive',
    direction: 'bottom',
    gap: 144,
    crossOffset: 72,
    width: 260,
  },
];

function LegendOverlay({ additive, sortMode, cardRect, onClose }: LegendOverlayProps) {
  const theme = useTheme();
  const isSmallScreen = useMediaQuery(theme.breakpoints.down('sm'));
  const eNumberRef = useRef<HTMLElement | null>(null);
  const titleRef = useRef<HTMLElement | null>(null);
  const originRef = useRef<HTMLElement | null>(null);
  const functionsRef = useRef<HTMLElement | null>(null);
  const searchRankRef = useRef<HTMLElement | null>(null);
  const searchVolumeRef = useRef<HTMLElement | null>(null);
  const searchHistoryRef = useRef<HTMLElement | null>(null);
  const productCountRef = useRef<HTMLElement | null>(null);

  const legendRefs: LegendRefMap = {
    eNumber: eNumberRef,
    title: titleRef,
    origin: originRef,
    functions: functionsRef,
    searchRank: searchRankRef,
    searchVolume: searchVolumeRef,
    searchHistory: searchHistoryRef,
    productCount: productCountRef,
  };

  const [anchorPositions, setAnchorPositions] = useState<LegendAnchorPositions>({});

  const updateAnchorPositions = useCallback(() => {
    const assign = (key: LegendAnchorKey, element: HTMLElement | null, positions: LegendAnchorPositions) => {
      if (!element) {
        return;
      }

      const rect = element.getBoundingClientRect();
      positions[key] = {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
      };
    };

    const next: LegendAnchorPositions = {};
    assign('eNumber', eNumberRef.current, next);
    assign('title', titleRef.current, next);
    assign('origin', originRef.current, next);
    assign('functions', functionsRef.current, next);
    assign('searchRank', searchRankRef.current, next);
    assign('searchVolume', searchVolumeRef.current, next);
    assign('searchHistory', searchHistoryRef.current, next);
    assign('productCount', productCountRef.current, next);
    setAnchorPositions(next);
  }, []);

  useLayoutEffect(() => {
    const frame = requestAnimationFrame(() => {
      updateAnchorPositions();
    });

    return () => cancelAnimationFrame(frame);
  }, [updateAnchorPositions, additive.slug, cardRect, isSmallScreen]);

  useEffect(() => {
    const handleResize = () => {
      updateAnchorPositions();
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [updateAnchorPositions]);

  const calloutDefinitions = isSmallScreen ? MOBILE_CALLOUTS : DESKTOP_CALLOUTS;
  const fallbackWidth =
    typeof window === 'undefined' ? 320 : Math.min(window.innerWidth - 32, isSmallScreen ? 360 : 420);

  const highlightStyles = cardRect
    ? {
        top: cardRect.top,
        left: cardRect.left,
        width: cardRect.width,
        height: cardRect.height,
        transform: 'none',
      }
    : {
        top: '50%',
        left: '50%',
        width: fallbackWidth,
        transform: 'translate(-50%, -50%)',
      };

  return (
    <Portal>
      <Box
        role="dialog"
        aria-modal="true"
        aria-label="Additive card legend"
        sx={{
          position: 'fixed',
          inset: 0,
          zIndex: (themeArg) => themeArg.zIndex.modal + 1,
        }}
      >
        <Box
          onClick={onClose}
          sx={{
            position: 'absolute',
            inset: 0,
            bgcolor: 'rgba(15, 23, 42, 0.72)',
            backdropFilter: 'blur(2px)',
          }}
        />

        <IconButton
          size="large"
          onClick={onClose}
          aria-label="Close legend"
          sx={{
            position: 'absolute',
            top: { xs: 12, sm: 24 },
            right: { xs: 12, sm: 24 },
            bgcolor: 'rgba(15, 23, 42, 0.72)',
            color: 'common.white',
            '&:hover': {
              bgcolor: 'rgba(15, 23, 42, 0.88)',
            },
            zIndex: 1,
          }}
        >
          <CloseRoundedIcon fontSize="inherit" />
        </IconButton>

        <Box
          sx={{
            position: 'absolute',
            inset: 0,
          }}
        >
          <Box
            sx={{
              position: 'absolute',
              ...highlightStyles,
              maxWidth: 'min(92vw, 460px)',
              pointerEvents: 'auto',
            }}
            onClick={(event) => {
              event.stopPropagation();
            }}
          >
            <AdditiveCard
              additive={additive}
              sortMode={sortMode}
              disableLink
              legendRefs={legendRefs}
              highlight
            />
          </Box>
        </Box>

        {calloutDefinitions.map((definition) => {
          const anchor = anchorPositions[definition.key];

          if (!anchor) {
            return null;
          }

          return (
            <LegendConnector
              key={definition.key}
              anchor={anchor}
              direction={definition.direction}
              gap={definition.gap}
              crossOffset={definition.crossOffset}
              width={definition.width}
              align={definition.align}
              label={definition.label}
            />
          );
        })}
      </Box>
    </Portal>
  );
}

interface LegendConnectorProps {
  anchor: { x: number; y: number };
  direction: LegendConnectorDirection;
  gap: number;
  crossOffset?: number;
  width?: number;
  align?: 'left' | 'center' | 'right';
  label: string;
}

function LegendConnector({
  anchor,
  direction,
  gap,
  crossOffset = 0,
  width = 220,
  align,
  label,
}: LegendConnectorProps) {
  const transformParts: string[] = [];

  if (direction === 'left') {
    transformParts.push(`translateX(calc(-100% - ${gap}px))`);
    transformParts.push('translateY(-50%)');
    if (crossOffset) {
      transformParts.push(`translateY(${crossOffset}px)`);
    }
  } else if (direction === 'right') {
    transformParts.push(`translateX(${gap}px)`);
    transformParts.push('translateY(-50%)');
    if (crossOffset) {
      transformParts.push(`translateY(${crossOffset}px)`);
    }
  } else if (direction === 'top') {
    transformParts.push('translateX(-50%)');
    transformParts.push(`translateY(calc(-100% - ${gap}px))`);
    if (crossOffset) {
      transformParts.push(`translateX(${crossOffset}px)`);
    }
  } else {
    transformParts.push('translateX(-50%)');
    transformParts.push(`translateY(${gap}px)`);
    if (crossOffset) {
      transformParts.push(`translateX(${crossOffset}px)`);
    }
  }

  const transform = transformParts.join(' ');
  const textAlign = align ?? (direction === 'left' ? 'right' : direction === 'right' ? 'left' : 'center');
  const lineColor = 'rgba(226, 232, 240, 0.85)';
  const gapPx = `${gap}px`;

  const lineStyles = (() => {
    if (direction === 'left') {
      return {
        line: {
          top: '50%',
          right: `-${gapPx}`,
          width: gapPx,
          height: '2px',
          transform: 'translateY(-50%)',
        },
        node: {
          top: '50%',
          right: `calc(-${gapPx} - 6px)`,
          transform: 'translateY(-50%)',
        },
      };
    }

    if (direction === 'right') {
      return {
        line: {
          top: '50%',
          left: `-${gapPx}`,
          width: gapPx,
          height: '2px',
          transform: 'translateY(-50%)',
        },
        node: {
          top: '50%',
          left: `calc(-${gapPx} - 6px)`,
          transform: 'translateY(-50%)',
        },
      };
    }

    if (direction === 'top') {
      return {
        line: {
          left: '50%',
          bottom: `-${gapPx}`,
          width: '2px',
          height: gapPx,
          transform: 'translateX(-50%)',
        },
        node: {
          left: '50%',
          bottom: `calc(-${gapPx} - 6px)`,
          transform: 'translateX(-50%)',
        },
      };
    }

    return {
      line: {
        left: '50%',
        top: `-${gapPx}`,
        width: '2px',
        height: gapPx,
        transform: 'translateX(-50%)',
      },
      node: {
        left: '50%',
        top: `calc(-${gapPx} - 6px)`,
        transform: 'translateX(-50%)',
      },
    };
  })();

  return (
    <Box
      sx={{
        position: 'absolute',
        left: anchor.x,
        top: anchor.y,
        pointerEvents: 'none',
      }}
    >
      <Box
        sx={{
          position: 'absolute',
          transform,
        }}
      >
        <Paper
          elevation={0}
          sx={{
            px: 2,
            py: 1,
            borderRadius: 2,
            bgcolor: 'rgba(15, 23, 42, 0.92)',
            color: 'rgb(226, 232, 240)',
            border: '1px solid rgba(148, 163, 184, 0.45)',
            backdropFilter: 'blur(6px)',
            maxWidth: width,
            textAlign,
            fontWeight: 600,
            position: 'relative',
            boxShadow: '0 18px 32px rgba(15, 23, 42, 0.45)',
            '&::after': {
              content: '""',
              position: 'absolute',
              backgroundColor: lineColor,
              borderRadius: 1,
              ...lineStyles.line,
            },
            '&::before': {
              content: '""',
              position: 'absolute',
              width: 12,
              height: 12,
              borderRadius: '50%',
              border: `2px solid ${lineColor}`,
              backgroundColor: 'rgba(15, 23, 42, 0.92)',
              boxSizing: 'border-box',
              ...lineStyles.node,
            },
          }}
        >
          <Typography
            variant="caption"
            sx={{
              color: 'inherit',
              fontWeight: 600,
              lineHeight: 1.35,
              textTransform: 'none',
              display: 'block',
            }}
          >
            {label}
          </Typography>
        </Paper>
      </Box>
    </Box>
  );
}

interface AdditiveGridProps {
  items: Additive[];
  emptyMessage?: string;
  sortMode?: AdditiveSortMode;
}

export function AdditiveGrid({
  items,
  emptyMessage = 'No additives found.',
  sortMode = DEFAULT_SORT_MODE,
}: AdditiveGridProps) {
  const [legendOpen, setLegendOpen] = useState(false);
  const [cardRect, setCardRect] = useState<DOMRect | null>(null);
  const firstCardRef = useRef<HTMLDivElement | null>(null);
  const highlightAdditive = items[0];
  const firstItemSlug = highlightAdditive?.slug ?? null;

  const updateCardRect = useCallback(() => {
    if (!firstCardRef.current) {
      return;
    }

    setCardRect(firstCardRef.current.getBoundingClientRect());
  }, []);

  useLayoutEffect(() => {
    if (!legendOpen) {
      return;
    }

    updateCardRect();
  }, [legendOpen, updateCardRect, firstItemSlug]);

  useEffect(() => {
    if (!legendOpen) {
      return;
    }

    const handleResize = () => {
      updateCardRect();
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [legendOpen, updateCardRect]);

  useEffect(() => {
    if (!legendOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setLegendOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [legendOpen]);

  useEffect(() => {
    if (!legendOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [legendOpen]);

  if (items.length === 0) {
    return (
      <Typography variant="body1" color="text.secondary">
        {emptyMessage}
      </Typography>
    );
  }

  return (
    <Box display="flex" flexDirection="column" gap={{ xs: 2, sm: 2.5 }}>
      <Box>
        <Button
          startIcon={<InfoOutlinedIcon />}
          onClick={() => {
            if (highlightAdditive) {
              setLegendOpen(true);
            }
          }}
          disabled={!highlightAdditive}
          sx={{
            textTransform: 'none',
            px: 0,
            minWidth: 0,
            fontWeight: 600,
            color: 'text.primary',
            '& .MuiButton-startIcon': {
              mr: 1,
            },
          }}
        >
          show legend
        </Button>
      </Box>

      <Box
        display="grid"
        gap={{ xs: 2, sm: 3 }}
        sx={{
          gridTemplateColumns: {
            xs: '1fr',
            sm: 'repeat(2, 1fr)',
            md: 'repeat(3, 1fr)',
            lg: 'repeat(4, 1fr)',
          },
          '@media (min-width: 1600px)': {
            gridTemplateColumns: 'repeat(6, 1fr)',
          },
        }}
      >
        {items.map((additive, index) => (
          <AdditiveCard
            key={additive.slug}
            ref={index === 0 ? firstCardRef : undefined}
            additive={additive}
            sortMode={sortMode}
          />
        ))}
      </Box>

      {legendOpen && highlightAdditive ? (
        <LegendOverlay
          additive={highlightAdditive}
          sortMode={sortMode}
          cardRect={cardRect}
          onClose={() => setLegendOpen(false)}
        />
      ) : null}
    </Box>
  );
}
