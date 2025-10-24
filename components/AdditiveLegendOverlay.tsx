'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { MutableRefObject, MouseEvent as ReactMouseEvent, TouchEvent as ReactTouchEvent } from 'react';
import CloseIcon from '@mui/icons-material/Close';
import { Avatar, Box, Card, CardContent, Chip, IconButton, Stack, Typography } from '@mui/material';
import Image from 'next/image';
import { createPortal } from 'react-dom';

import { getOriginAbbreviation, getOriginIcon } from '../lib/origin-icons';
import { formatOriginLabel } from '../lib/additive-format';
import { SearchSparkline } from './SearchSparkline';
import type { LegendOverlayLayout } from './legend-types';

const CONNECTOR_COLOR = '#f15445';
const CONNECTOR_THICKNESS = 2;
const BASE_LEFT_MARGIN = 124;
const BASE_RIGHT_MARGIN = 176;
const BASE_TOP_MARGIN = 64;
const BASE_BOTTOM_MARGIN = 96;
const MOBILE_HORIZONTAL_PADDING = 24;
const MOBILE_VERTICAL_PADDING = 32;
const MIN_VIEWPORT_PADDING = 16;
const SAMPLE_CARD_WIDTH = 360;
const SAMPLE_CARD_HEIGHT = 460;

const SAMPLE_SPARKLINE = [18, 22, 20, 24, 26, 32, 30, 36, 42, 38, 44, 46];

const ORIGINS = ['plant', 'synthetic'];

const FUNCTION_LABELS = ['Acidity-Regulator', 'Sequestrant'];

type LegendKey =
  | 'eNumber'
  | 'name'
  | 'origin'
  | 'functionalClass'
  | 'sparkline'
  | 'productCount'
  | 'searchVolume'
  | 'searchRank';

const LEGEND_KEYS: LegendKey[] = [
  'eNumber',
  'name',
  'origin',
  'functionalClass',
  'sparkline',
  'productCount',
  'searchVolume',
  'searchRank',
];

interface LabelConfig {
  label: string;
  side: 'left' | 'right';
  offsetY?: number;
  horizontalGap?: number;
  labelGap?: number;
  maxWidth?: number;
  minHorizontalSpan?: number;
}

const LABEL_CONFIGS: Record<LegendKey, LabelConfig> = {
  eNumber: {
    label: 'e-number',
    side: 'left',
    offsetY: -32,
    horizontalGap: 72,
    labelGap: 20,
    minHorizontalSpan: 36,
    maxWidth: 120,
  },
  name: {
    label: 'name',
    side: 'right',
    offsetY: -136,
    horizontalGap: 88,
    labelGap: 20,
    minHorizontalSpan: 44,
    maxWidth: 180,
  },
  origin: {
    label: 'origin',
    side: 'right',
    offsetY: -86,
    horizontalGap: 92,
    labelGap: 20,
    minHorizontalSpan: 44,
    maxWidth: 200,
  },
  functionalClass: {
    label: 'functional class',
    side: 'right',
    offsetY: 6,
    horizontalGap: 104,
    labelGap: 24,
    minHorizontalSpan: 56,
    maxWidth: 260,
  },
  sparkline: {
    label: 'search volume history sparkline',
    side: 'right',
    offsetY: 88,
    horizontalGap: 112,
    labelGap: 28,
    minHorizontalSpan: 64,
    maxWidth: 280,
  },
  productCount: {
    label: 'number of products containing this additive',
    side: 'left',
    offsetY: 76,
    horizontalGap: 80,
    labelGap: 24,
    minHorizontalSpan: 52,
    maxWidth: 320,
  },
  searchVolume: {
    label: 'search volume per month in U.S.',
    side: 'right',
    offsetY: 124,
    horizontalGap: 120,
    labelGap: 28,
    minHorizontalSpan: 64,
    maxWidth: 260,
  },
  searchRank: {
    label: 'search interest rank',
    side: 'left',
    offsetY: 20,
    horizontalGap: 76,
    labelGap: 24,
    minHorizontalSpan: 44,
    maxWidth: 240,
  },
};

interface LegendConnectorGeometry {
  id: LegendKey;
  label: string;
  labelLeft: number;
  labelTop: number;
  labelWidth: number;
  labelHeight: number;
  horizontalX1: number;
  horizontalX2: number;
  horizontalY: number;
  verticalX: number;
  verticalY1: number;
  verticalY2: number;
}

interface GeometrySettings {
  left: number;
  top: number;
  width: number;
  height: number;
  scale: number;
  cardOffsetLeft: number;
  cardOffsetTop: number;
  cardWidth: number;
  cardHeight: number;
  shouldAlign: boolean;
  viewportWidth: number;
  viewportHeight: number;
}

interface LegendSampleRefs {
  eNumber: MutableRefObject<HTMLSpanElement | null>;
  name: MutableRefObject<HTMLHeadingElement | null>;
  origin: MutableRefObject<HTMLDivElement | null>;
  functionalClass: MutableRefObject<HTMLDivElement | null>;
  sparkline: MutableRefObject<HTMLDivElement | null>;
  productCount: MutableRefObject<HTMLDivElement | null>;
  searchVolume: MutableRefObject<HTMLSpanElement | null>;
  searchRank: MutableRefObject<HTMLSpanElement | null>;
}

interface LegendLabelRefs {
  eNumber: MutableRefObject<HTMLDivElement | null>;
  name: MutableRefObject<HTMLDivElement | null>;
  origin: MutableRefObject<HTMLDivElement | null>;
  functionalClass: MutableRefObject<HTMLDivElement | null>;
  sparkline: MutableRefObject<HTMLDivElement | null>;
  productCount: MutableRefObject<HTMLDivElement | null>;
  searchVolume: MutableRefObject<HTMLDivElement | null>;
  searchRank: MutableRefObject<HTMLDivElement | null>;
}

interface LegendRefPair {
  key: LegendKey;
  target: MutableRefObject<HTMLElement | null>;
  label: MutableRefObject<HTMLDivElement | null>;
}

interface AdditiveLegendOverlayProps {
  open: boolean;
  layout: LegendOverlayLayout | null;
  onClose: () => void;
}

interface PositionMap {
  [key: string]: {
    x: number;
    y: number;
  };
}

interface SizeMap {
  [key: string]: {
    width: number;
    height: number;
  };
}

const FALLBACK_VIEWPORT_WIDTH = 1280;
const FALLBACK_VIEWPORT_HEIGHT = 800;

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const computeGeometry = (layout: LegendOverlayLayout | null): GeometrySettings => {
  const viewportWidth = layout?.viewportWidth ?? (typeof window !== 'undefined' ? window.innerWidth : FALLBACK_VIEWPORT_WIDTH);
  const viewportHeight = layout?.viewportHeight ?? (typeof window !== 'undefined' ? window.innerHeight : FALLBACK_VIEWPORT_HEIGHT);
  const cardRect = layout?.cardRect ?? {
    top: viewportHeight / 2 - SAMPLE_CARD_HEIGHT / 2,
    left: viewportWidth / 2 - SAMPLE_CARD_WIDTH / 2,
    width: SAMPLE_CARD_WIDTH,
    height: SAMPLE_CARD_HEIGHT,
  };

  if (layout && layout.gridColumnCount > 2) {
    const effectiveLeftMargin = Math.max(
      0,
      Math.min(BASE_LEFT_MARGIN, cardRect.left - MIN_VIEWPORT_PADDING),
    );
    const effectiveRightMargin = Math.max(
      0,
      Math.min(BASE_RIGHT_MARGIN, viewportWidth - cardRect.left - cardRect.width - MIN_VIEWPORT_PADDING),
    );
    const effectiveTopMargin = Math.max(
      0,
      Math.min(BASE_TOP_MARGIN, cardRect.top - MIN_VIEWPORT_PADDING),
    );
    const effectiveBottomMargin = Math.max(
      0,
      Math.min(
        BASE_BOTTOM_MARGIN,
        viewportHeight - cardRect.top - cardRect.height - MIN_VIEWPORT_PADDING,
      ),
    );

    const width = cardRect.width + effectiveLeftMargin + effectiveRightMargin;
    const height = cardRect.height + effectiveTopMargin + effectiveBottomMargin;

    return {
      left: cardRect.left - effectiveLeftMargin,
      top: cardRect.top - effectiveTopMargin,
      width,
      height,
      scale: 1,
      cardOffsetLeft: effectiveLeftMargin,
      cardOffsetTop: effectiveTopMargin,
      cardWidth: cardRect.width,
      cardHeight: cardRect.height,
      shouldAlign: true,
      viewportWidth,
      viewportHeight,
    };
  }

  const width = cardRect.width + BASE_LEFT_MARGIN + BASE_RIGHT_MARGIN;
  const height = cardRect.height + BASE_TOP_MARGIN + BASE_BOTTOM_MARGIN;

  const availableWidth = Math.max(0, viewportWidth - MOBILE_HORIZONTAL_PADDING * 2);
  const availableHeight = Math.max(0, viewportHeight - MOBILE_VERTICAL_PADDING * 2);
  const scale = Math.min(1, availableWidth / width, availableHeight / height);

  const scaledWidth = width * scale;
  const scaledHeight = height * scale;

  return {
    left: (viewportWidth - scaledWidth) / 2,
    top: (viewportHeight - scaledHeight) / 2,
    width,
    height,
    scale,
    cardOffsetLeft: BASE_LEFT_MARGIN,
    cardOffsetTop: BASE_TOP_MARGIN,
    cardWidth: cardRect.width,
    cardHeight: cardRect.height,
    shouldAlign: false,
    viewportWidth,
    viewportHeight,
  };
};

const stopPropagation = (event: ReactMouseEvent | ReactTouchEvent) => {
  event.stopPropagation();
};

const LegendSampleCard = ({
  refs,
  onAssetLoad,
}: {
  refs: LegendSampleRefs;
  onAssetLoad: () => void;
}) => (
  <Card
    elevation={16}
    sx={{
      position: 'relative',
      width: '100%',
      color: 'text.primary',
      boxShadow: '0 32px 120px rgba(0, 0, 0, 0.36)',
    }}
  >
    <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pb: 3 }}>
      <Stack spacing={1.5} sx={{ flexGrow: 1 }}>
        <Box display="flex" justifyContent="space-between" alignItems="flex-start">
          <Typography
            ref={refs.eNumber}
            component="span"
            variant="overline"
            color="text.secondary"
            letterSpacing={1.2}
            sx={{ fontWeight: 600 }}
          >
            E330
          </Typography>
          <Stack ref={refs.origin} direction="row" spacing={0.5}>
            {ORIGINS.map((origin) => {
              const icon = getOriginIcon(origin);
              const abbreviation = getOriginAbbreviation(origin);
              const label = formatOriginLabel(origin);

              return (
                <Avatar
                  key={origin}
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
                      onLoadingComplete={onAssetLoad}
                    />
                  ) : (
                    abbreviation
                  )}
                </Avatar>
              );
            })}
          </Stack>
        </Box>

        <Typography
          ref={refs.name}
          component="h2"
          variant="h2"
          sx={{ lineHeight: 1.2, fontWeight: 500 }}
        >
          Citric acid
        </Typography>

        <Stack
          ref={refs.functionalClass}
          direction="row"
          spacing={1}
          alignItems="center"
          sx={{ flexWrap: 'nowrap', minHeight: 28 }}
        >
          {FUNCTION_LABELS.map((label) => (
            <Chip key={label} label={label} variant="outlined" size="small" />
          ))}
        </Stack>
      </Stack>

      <Stack
        direction="row"
        alignItems="center"
        spacing={1.5}
        sx={{ mt: 1, opacity: 1 }}
      >
        <Stack direction="row" alignItems="baseline" spacing={1} flexShrink={0}>
          <Typography ref={refs.searchRank} component="span" variant="subtitle1" fontWeight={600}>
            #17
          </Typography>
          <Typography
            ref={refs.searchVolume}
            component="span"
            variant="body2"
            color="text.secondary"
          >
            98.5k / mo
          </Typography>
        </Stack>
        <Box ref={refs.sparkline} sx={{ flexGrow: 1, minWidth: 96 }}>
          <SearchSparkline values={SAMPLE_SPARKLINE} />
        </Box>
      </Stack>
    </CardContent>
    <Box
      ref={refs.productCount}
      sx={{ px: 3, py: 2, bgcolor: 'grey.50' }}
    >
      <Typography variant="body2" color="text.secondary">
        Found in <Box component="span" sx={{ fontWeight: 600 }}>55,503 products</Box>
      </Typography>
    </Box>
  </Card>
);

export function AdditiveLegendOverlay({ open, layout, onClose }: AdditiveLegendOverlayProps) {
  const geometry = useMemo(() => computeGeometry(layout), [layout]);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const legendCardWrapperRef = useRef<HTMLDivElement | null>(null);
  const eNumberRef = useRef<HTMLSpanElement | null>(null);
  const nameRef = useRef<HTMLHeadingElement | null>(null);
  const originRef = useRef<HTMLDivElement | null>(null);
  const functionalClassRef = useRef<HTMLDivElement | null>(null);
  const sparklineRef = useRef<HTMLDivElement | null>(null);
  const productCountRef = useRef<HTMLDivElement | null>(null);
  const searchVolumeRef = useRef<HTMLSpanElement | null>(null);
  const searchRankRef = useRef<HTMLSpanElement | null>(null);
  const eNumberLabelRef = useRef<HTMLDivElement | null>(null);
  const nameLabelRef = useRef<HTMLDivElement | null>(null);
  const originLabelRef = useRef<HTMLDivElement | null>(null);
  const functionalClassLabelRef = useRef<HTMLDivElement | null>(null);
  const sparklineLabelRef = useRef<HTMLDivElement | null>(null);
  const productCountLabelRef = useRef<HTMLDivElement | null>(null);
  const searchVolumeLabelRef = useRef<HTMLDivElement | null>(null);
  const searchRankLabelRef = useRef<HTMLDivElement | null>(null);

  const legendRefPairs = useMemo<LegendRefPair[]>(
    () => [
      { key: 'eNumber', target: eNumberRef, label: eNumberLabelRef },
      { key: 'name', target: nameRef, label: nameLabelRef },
      { key: 'origin', target: originRef, label: originLabelRef },
      { key: 'functionalClass', target: functionalClassRef, label: functionalClassLabelRef },
      { key: 'sparkline', target: sparklineRef, label: sparklineLabelRef },
      { key: 'productCount', target: productCountRef, label: productCountLabelRef },
      { key: 'searchVolume', target: searchVolumeRef, label: searchVolumeLabelRef },
      { key: 'searchRank', target: searchRankRef, label: searchRankLabelRef },
    ],
    [
      eNumberRef,
      nameRef,
      originRef,
      functionalClassRef,
      sparklineRef,
      productCountRef,
      searchVolumeRef,
      searchRankRef,
      eNumberLabelRef,
      nameLabelRef,
      originLabelRef,
      functionalClassLabelRef,
      sparklineLabelRef,
      productCountLabelRef,
      searchVolumeLabelRef,
      searchRankLabelRef,
    ],
  );

  const elementRefs = useMemo<LegendSampleRefs>(
    () => ({
      eNumber: eNumberRef,
      name: nameRef,
      origin: originRef,
      functionalClass: functionalClassRef,
      sparkline: sparklineRef,
      productCount: productCountRef,
      searchVolume: searchVolumeRef,
      searchRank: searchRankRef,
    }),
    [
      eNumberRef,
      nameRef,
      originRef,
      functionalClassRef,
      sparklineRef,
      productCountRef,
      searchVolumeRef,
      searchRankRef,
    ],
  );

  const labelRefs = useMemo<LegendLabelRefs>(
    () => ({
      eNumber: eNumberLabelRef,
      name: nameLabelRef,
      origin: originLabelRef,
      functionalClass: functionalClassLabelRef,
      sparkline: sparklineLabelRef,
      productCount: productCountLabelRef,
      searchVolume: searchVolumeLabelRef,
      searchRank: searchRankLabelRef,
    }),
    [
      eNumberLabelRef,
      nameLabelRef,
      originLabelRef,
      functionalClassLabelRef,
      sparklineLabelRef,
      productCountLabelRef,
      searchVolumeLabelRef,
      searchRankLabelRef,
    ],
  );
  const [targetPositions, setTargetPositions] = useState<PositionMap>({});
  const [labelSizes, setLabelSizes] = useState<SizeMap>({});

  const measure = useCallback(() => {
    if (!containerRef.current) {
      return;
    }

    const containerRect = containerRef.current.getBoundingClientRect();
    const scale = geometry.scale || 1;
    const nextPositions: PositionMap = {};
    const nextSizes: SizeMap = {};

    legendRefPairs.forEach(({ key, target, label }) => {
      const targetElement = target.current;

      if (targetElement) {
        const rect = targetElement.getBoundingClientRect();
        nextPositions[key] = {
          x: (rect.left + rect.width / 2 - containerRect.left) / scale,
          y: (rect.top + rect.height / 2 - containerRect.top) / scale,
        };
      }

      const labelElement = label.current;

      if (labelElement) {
        const rect = labelElement.getBoundingClientRect();
        nextSizes[key] = {
          width: rect.width / scale,
          height: rect.height / scale,
        };
      }
    });

    setTargetPositions(nextPositions);
    setLabelSizes(nextSizes);
  }, [geometry.scale, legendRefPairs]);

  useLayoutEffect(() => {
    if (!open) {
      return;
    }

    const animation = requestAnimationFrame(() => {
      measure();
    });

    return () => {
      cancelAnimationFrame(animation);
    };
  }, [measure, open, geometry]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const handleResize = () => {
      measure();
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [measure, open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose, open]);

  const hasMeasurements = useMemo(
    () =>
      LEGEND_KEYS.every(
        (key) => targetPositions[key] && labelSizes[key],
      ),
    [labelSizes, targetPositions],
  );

  const connectors = useMemo<LegendConnectorGeometry[]>(() => {
    if (!hasMeasurements) {
      return [];
    }

    const geometries: LegendConnectorGeometry[] = [];

    LEGEND_KEYS.forEach((key) => {
      const target = targetPositions[key];
      const size = labelSizes[key];
      const config = LABEL_CONFIGS[key];

      if (!target || !size) {
        return;
      }

      const horizontalGap = config.horizontalGap ?? 48;
      const labelGap = config.labelGap ?? 16;
      const minHorizontalSpan = config.minHorizontalSpan ?? 32;

      const labelHeight = size.height;
      const labelWidth = size.width;
      let labelTop = target.y - labelHeight / 2 + (config.offsetY ?? 0);
      labelTop = clamp(labelTop, 0, geometry.height - labelHeight);
      const labelCenterY = labelTop + labelHeight / 2;

      const cardLeft = geometry.cardOffsetLeft;
      const cardRight = geometry.cardOffsetLeft + geometry.cardWidth;

      let lineHorizontalEndX: number;
      let labelLeft: number;

      if (config.side === 'left') {
        const minAnchor = target.x - minHorizontalSpan;
        lineHorizontalEndX = Math.min(cardLeft - horizontalGap, minAnchor);
        labelLeft = lineHorizontalEndX - labelGap - labelWidth;

        if (labelLeft < MIN_VIEWPORT_PADDING) {
          const shift = MIN_VIEWPORT_PADDING - labelLeft;
          lineHorizontalEndX += shift;
          labelLeft += shift;
        }

        if (lineHorizontalEndX > minAnchor) {
          lineHorizontalEndX = minAnchor;
          labelLeft = lineHorizontalEndX - labelGap - labelWidth;
        }
      } else {
        const maxAnchor = target.x + minHorizontalSpan;
        lineHorizontalEndX = Math.max(cardRight + horizontalGap, maxAnchor);
        labelLeft = lineHorizontalEndX + labelGap;

        const maxLabelRight = geometry.width - MIN_VIEWPORT_PADDING;
        const overflow = labelLeft + labelWidth - maxLabelRight;

        if (overflow > 0) {
          lineHorizontalEndX -= overflow;
          labelLeft -= overflow;
        }

        if (lineHorizontalEndX < maxAnchor) {
          lineHorizontalEndX = maxAnchor;
          labelLeft = lineHorizontalEndX + labelGap;
        }
      }

      geometries.push({
        id: key,
        label: config.label,
        labelLeft,
        labelTop,
        labelWidth,
        labelHeight,
        horizontalX1: Math.min(target.x, lineHorizontalEndX),
        horizontalX2: Math.max(target.x, lineHorizontalEndX),
        horizontalY: labelCenterY,
        verticalX: target.x,
        verticalY1: target.y,
        verticalY2: labelCenterY,
      });
    });

    return geometries;
  }, [
    geometry.cardOffsetLeft,
    geometry.cardWidth,
    geometry.width,
    geometry.height,
    hasMeasurements,
    labelSizes,
    targetPositions,
  ]);

  const handleBackdropClick = useCallback(() => {
    onClose();
  }, [onClose]);

  const handleIconLoad = useCallback(() => {
    measure();
  }, [measure]);

  useEffect(() => {
    if (!open) {
      return;
    }

    if (typeof ResizeObserver === 'undefined') {
      return;
    }

    const observer = new ResizeObserver(() => {
      measure();
    });

    if (legendCardWrapperRef.current) {
      observer.observe(legendCardWrapperRef.current);
    }

    return () => {
      observer.disconnect();
    };
  }, [measure, open]);

  if (!open) {
    return null;
  }

  return createPortal(
    <Box
      onClick={handleBackdropClick}
      sx={{
        position: 'fixed',
        inset: 0,
        zIndex: 1400,
        bgcolor: 'rgba(12, 12, 12, 0.92)',
        backdropFilter: 'blur(6px)',
        touchAction: 'pan-y pinch-zoom',
      }}
    >
      <Box
        role="dialog"
        aria-label="Additive card legend"
        onClick={stopPropagation}
        sx={{ position: 'relative', width: '100%', height: '100%' }}
      >
        <IconButton
          aria-label="Close legend"
          onClick={onClose}
          sx={{
            position: 'fixed',
            top: { xs: 12, sm: 24 },
            right: { xs: 12, sm: 24 },
            color: '#ffffff',
            bgcolor: 'rgba(0, 0, 0, 0.4)',
            '&:hover': { bgcolor: 'rgba(0, 0, 0, 0.6)' },
          }}
        >
          <CloseIcon />
        </IconButton>

        <Box
          sx={{
            position: 'fixed',
            left: geometry.left,
            top: geometry.top,
            transform: `scale(${geometry.scale})`,
            transformOrigin: 'top left',
            pointerEvents: 'none',
          }}
        >
          <Box
            ref={containerRef}
            sx={{ position: 'relative', width: geometry.width, height: geometry.height }}
          >
            <Box
              ref={legendCardWrapperRef}
              sx={{
                position: 'absolute',
                top: geometry.cardOffsetTop,
                left: geometry.cardOffsetLeft,
                width: geometry.cardWidth,
                pointerEvents: 'auto',
              }}
            >
              <LegendSampleCard refs={elementRefs} onAssetLoad={handleIconLoad} />
            </Box>

            {LEGEND_KEYS.map((key) => {
              const geometryEntry = connectors.find((connector) => connector.id === key);
              const labelRef = labelRefs[key];

              return (
                <Box key={key}>
                  <Box
                    sx={{
                      position: 'absolute',
                      left: geometryEntry ? geometryEntry.verticalX - CONNECTOR_THICKNESS / 2 : 0,
                      top: geometryEntry
                        ? Math.min(geometryEntry.verticalY1, geometryEntry.verticalY2)
                        : 0,
                      width: CONNECTOR_THICKNESS,
                      height: geometryEntry
                        ? Math.abs(geometryEntry.verticalY2 - geometryEntry.verticalY1)
                        : 0,
                      bgcolor: CONNECTOR_COLOR,
                      opacity: geometryEntry ? 1 : 0,
                    }}
                  />
                  <Box
                    sx={{
                      position: 'absolute',
                      left: geometryEntry
                        ? Math.min(geometryEntry.horizontalX1, geometryEntry.horizontalX2)
                        : 0,
                      top: geometryEntry ? geometryEntry.horizontalY - CONNECTOR_THICKNESS / 2 : 0,
                      width: geometryEntry
                        ? Math.abs(geometryEntry.horizontalX2 - geometryEntry.horizontalX1)
                        : 0,
                      height: CONNECTOR_THICKNESS,
                      bgcolor: CONNECTOR_COLOR,
                      opacity: geometryEntry ? 1 : 0,
                    }}
                  />
                  <Typography
                    ref={labelRef}
                    variant="body2"
                    sx={{
                      position: 'absolute',
                      left: geometryEntry ? geometryEntry.labelLeft : 0,
                      top: geometryEntry ? geometryEntry.labelTop : 0,
                      color: '#ffffff',
                      fontSize: 16,
                      lineHeight: 1.35,
                      maxWidth: LABEL_CONFIGS[key].maxWidth,
                      opacity: geometryEntry ? 1 : 0,
                      fontWeight: 500,
                    }}
                  >
                    {LABEL_CONFIGS[key].label}
                  </Typography>
                </Box>
              );
            })}
          </Box>
        </Box>
      </Box>
    </Box>,
    document.body,
  );
}
