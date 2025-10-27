'use client';

import { useCallback, useEffect, useState, useTransition } from 'react';
import type { ChangeEvent, KeyboardEvent } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  Box,
  Button,
  Checkbox,
  FormControl,
  FormControlLabel,
  IconButton,
  InputLabel,
  ListSubheader,
  MenuItem,
  Select,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import CloseIcon from '@mui/icons-material/Close';
import type { SelectChangeEvent } from '@mui/material/Select';

import type { AdditiveSortMode } from '../lib/additives';
import { DEFAULT_AWARENESS_ALPHA, DEFAULT_AWARENESS_USE_LOG } from '../lib/awareness';

export interface FilterOption {
  slug: string;
  label: string;
}

type FilterType = 'origin' | 'function';

export interface CurrentFilterSelection {
  type: FilterType;
  slug: string;
}

interface FilterPanelProps {
  functionOptions: FilterOption[];
  originOptions: FilterOption[];
  currentFilter?: CurrentFilterSelection | null;
  currentSortMode?: AdditiveSortMode;
  currentShowClasses?: boolean;
  currentAwarenessAlpha?: number;
  currentAwarenessUseLog?: boolean;
}

const HOME_ROUTE = '/';
const DEFAULT_SORT_MODE: AdditiveSortMode = 'product-count';

export function FilterPanel({
  functionOptions,
  originOptions,
  currentFilter = null,
  currentSortMode = DEFAULT_SORT_MODE,
  currentShowClasses = false,
  currentAwarenessAlpha,
  currentAwarenessUseLog,
}: FilterPanelProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [legendOpen, setLegendOpen] = useState(false);
  const [legendPosition, setLegendPosition] = useState<
    { top: number; left: number; width: number; scaledWidth: number } | null
  >(null);
  type SortSelectValue = 'search-rank' | 'products';
  const currentSortValue: SortSelectValue = currentSortMode === 'product-count' ? 'products' : 'search-rank';
  const resolvedAwarenessAlpha =
    typeof currentAwarenessAlpha === 'number' && Number.isFinite(currentAwarenessAlpha) && currentAwarenessAlpha >= 0
      ? currentAwarenessAlpha
      : DEFAULT_AWARENESS_ALPHA;
  const resolvedAwarenessUseLog =
    typeof currentAwarenessUseLog === 'boolean' ? currentAwarenessUseLog : DEFAULT_AWARENESS_USE_LOG;
  const [awarenessAlphaInput, setAwarenessAlphaInput] = useState<string>(resolvedAwarenessAlpha.toString());

  useEffect(() => {
    setAwarenessAlphaInput(resolvedAwarenessAlpha.toString());
  }, [resolvedAwarenessAlpha]);

  const closeLegend = useCallback(() => {
    setLegendOpen(false);
    setLegendPosition(null);
  }, []);

  const updateLegendPosition = useCallback(() => {
    const firstCard = document.querySelector('[data-additive-card-index="0"]') as HTMLElement | null;

    if (!firstCard) {
      setLegendPosition(null);
      return;
    }

    const rect = firstCard.getBoundingClientRect();
    const viewportWidth = document.documentElement.clientWidth;
    const rightMargin = 24;
    const availableWidth = Math.max(viewportWidth - rect.left - rightMargin, rect.width);
    const scaledWidth = Math.min(rect.width * 2, availableWidth);

    setLegendPosition({ top: rect.top, left: rect.left, width: rect.width, scaledWidth });
  }, []);

  useEffect(() => {
    if (!legendOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    updateLegendPosition();

    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeLegend();
      }
    };

    window.addEventListener('resize', updateLegendPosition);
    window.addEventListener('scroll', updateLegendPosition, true);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('resize', updateLegendPosition);
      window.removeEventListener('scroll', updateLegendPosition, true);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [legendOpen, updateLegendPosition, closeLegend]);

  const buildUrlWithState = (
    path: string,
    sort: SortSelectValue = currentSortValue,
    showClasses: boolean = currentShowClasses,
    awarenessAlpha: number | null = resolvedAwarenessAlpha,
    awarenessUseLog: boolean = resolvedAwarenessUseLog,
  ) => {
    const params = new URLSearchParams(searchParams?.toString() ?? '');

    if (sort === 'search-rank') {
      params.set('sort', 'search-rank');
    } else {
      params.delete('sort');
    }

    if (showClasses) {
      params.set('classes', '1');
    } else {
      params.delete('classes');
    }

    const hasValidAlpha =
      typeof awarenessAlpha === 'number' && Number.isFinite(awarenessAlpha) && awarenessAlpha >= 0;

    if (hasValidAlpha && awarenessAlpha !== DEFAULT_AWARENESS_ALPHA) {
      params.set('awAlpha', String(awarenessAlpha));
    } else {
      params.delete('awAlpha');
    }

    const useLogValue = typeof awarenessUseLog === 'boolean' ? awarenessUseLog : DEFAULT_AWARENESS_USE_LOG;

    if (useLogValue !== DEFAULT_AWARENESS_USE_LOG) {
      params.set('awLog', useLogValue ? '1' : '0');
    } else {
      params.delete('awLog');
    }

    const queryString = params.toString();
    return queryString ? `${path}?${queryString}` : path;
  };

  const buildFilterValue = (selection: CurrentFilterSelection | null) =>
    selection ? `${selection.type}:${selection.slug}` : '';

  const handleFilterChange = (event: SelectChangeEvent<string>) => {
    const value = event.target.value;

    if (!value) {
      startTransition(() => {
        router.push(buildUrlWithState(HOME_ROUTE));
      });
      return;
    }

    const [type, slug] = value.split(':', 2) as [FilterType | undefined, string | undefined];

    if (!type || !slug) {
      return;
    }

    const targetPath = type === 'origin' ? `/origin/${slug}` : `/function/${slug}`;

    startTransition(() => {
      router.push(buildUrlWithState(targetPath));
    });
  };

  const handleSortChange = (event: SelectChangeEvent<string>) => {
    const value = (event.target.value as SortSelectValue) || 'products';

    startTransition(() => {
      router.push(buildUrlWithState(pathname, value));
    });
  };

  const handleShowClassesChange = (event: ChangeEvent<HTMLInputElement>) => {
    const showClasses = event.target.checked;

    startTransition(() => {
      router.push(buildUrlWithState(pathname, currentSortValue, showClasses));
    });
  };

  const applyAwarenessAlpha = (value: string) => {
    const trimmed = value.trim();

    if (!trimmed) {
      setAwarenessAlphaInput(DEFAULT_AWARENESS_ALPHA.toString());
      startTransition(() => {
        router.push(
          buildUrlWithState(
            pathname,
            currentSortValue,
            currentShowClasses,
            DEFAULT_AWARENESS_ALPHA,
            resolvedAwarenessUseLog,
          ),
        );
      });
      return;
    }

    const parsed = Number.parseFloat(trimmed);

    if (!Number.isFinite(parsed) || parsed < 0) {
      setAwarenessAlphaInput(resolvedAwarenessAlpha.toString());
      return;
    }

    setAwarenessAlphaInput(parsed.toString());

    startTransition(() => {
      router.push(
        buildUrlWithState(pathname, currentSortValue, currentShowClasses, parsed, resolvedAwarenessUseLog),
      );
    });
  };

  const handleAwarenessAlphaChange = (event: ChangeEvent<HTMLInputElement>) => {
    setAwarenessAlphaInput(event.target.value);
  };

  const handleAwarenessAlphaBlur = () => {
    applyAwarenessAlpha(awarenessAlphaInput);
  };

  const handleAwarenessAlphaKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      applyAwarenessAlpha(awarenessAlphaInput);
    }
  };

  const handleAwarenessUseLogChange = (event: ChangeEvent<HTMLInputElement>) => {
    const nextUseLog = event.target.checked;

    startTransition(() => {
      router.push(
        buildUrlWithState(pathname, currentSortValue, currentShowClasses, resolvedAwarenessAlpha, nextUseLog),
      );
    });
  };

  return (
    <>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        justifyContent={{ xs: 'flex-start', sm: 'space-between' }}
        alignItems={{ xs: 'stretch', sm: 'center' }}
        spacing={1.5}
        width="100%"
        flexWrap="wrap"
      >
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={{ xs: 1, sm: 1.5 }}
          alignItems={{ xs: 'flex-start', sm: 'center' }}
          flexWrap="wrap"
          sx={{
            minWidth: { xs: '100%', sm: 'auto' },
          }}
        >
          <Button
            type="button"
            onClick={() => setLegendOpen(true)}
            startIcon={<InfoOutlinedIcon fontSize="small" />}
            sx={{
              color: '#626262',
              textTransform: 'none',
              fontWeight: 500,
              fontSize: 16,
              px: 0,
              '&:hover': {
                backgroundColor: 'transparent',
                textDecoration: 'underline',
              },
            }}
          >
            show legend
          </Button>
        </Stack>

        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={1.5}
          alignItems={{ xs: 'stretch', sm: 'center' }}
          flexWrap="wrap"
          justifyContent="flex-end"
          sx={{ flexGrow: 1 }}
        >
          <Box
            component="span"
            title="Show generic parent additives"
            sx={{
              alignSelf: 'center',
              display: 'flex',
              order: { xs: -1, sm: 0 },
            }}
          >
            <FormControlLabel
              control={
                <Checkbox
                  size="small"
                  checked={currentShowClasses}
                  onChange={handleShowClassesChange}
                  disabled={isPending}
                />
              }
              label="parent E"
              sx={{
                color: 'text.secondary',
                '& .MuiFormControlLabel-label': {
                  fontSize: 14,
                },
              }}
            />
          </Box>

          <TextField
            label="Awareness α"
            type="number"
            size="small"
            value={awarenessAlphaInput}
            onChange={handleAwarenessAlphaChange}
            onBlur={handleAwarenessAlphaBlur}
            onKeyDown={handleAwarenessAlphaKeyDown}
            disabled={isPending}
            sx={{ width: { xs: '100%', sm: 130 } }}
            inputProps={{ min: 0, step: 0.5, inputMode: 'decimal' }}
          />

          <FormControlLabel
            control={
              <Switch
                size="small"
                checked={resolvedAwarenessUseLog}
                onChange={handleAwarenessUseLogChange}
                disabled={isPending}
              />
            }
            label="Log scale"
            sx={{
              color: 'text.secondary',
              '& .MuiFormControlLabel-label': {
                fontSize: 14,
              },
            }}
          />

          <FormControl
            size="small"
            sx={{ minWidth: { xs: '100%', sm: 180 } }}
            disabled={isPending}
          >
            <InputLabel id="sort-filter-label">Sort by</InputLabel>
            <Select
              labelId="sort-filter-label"
              id="sort-filter"
              label="Sort by"
              value={currentSortValue}
              onChange={handleSortChange}
            >
              <MenuItem value="search-rank">Search rank</MenuItem>
              <MenuItem value="products">Products</MenuItem>
            </Select>
          </FormControl>

          <FormControl
            size="small"
            sx={{ minWidth: { xs: '100%', sm: 180 } }}
            disabled={isPending}
          >
            <InputLabel id="filter-select-label">Filter</InputLabel>
            <Select
              labelId="filter-select-label"
              id="filter-select"
              label="Filter"
              value={buildFilterValue(currentFilter)}
              onChange={handleFilterChange}
            >
              <MenuItem value="">All filters</MenuItem>
              <ListSubheader disableSticky>Origins</ListSubheader>
              {originOptions.map((option) => (
                <MenuItem key={`origin:${option.slug}`} value={`origin:${option.slug}`}>
                  {option.label}
                </MenuItem>
              ))}
              <ListSubheader disableSticky>Functions</ListSubheader>
              {functionOptions.map((option) => (
                <MenuItem key={`function:${option.slug}`} value={`function:${option.slug}`}>
                  {option.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Stack>
      </Stack>

      {legendOpen ? (
        <Box
          role="dialog"
          aria-modal="true"
          aria-label="Additive card legend"
          onClick={closeLegend}
          sx={{
            position: 'fixed',
            inset: 0,
            zIndex: 1400,
            bgcolor: 'rgba(10, 10, 16, 0.75)',
            backdropFilter: 'blur(6px)',
            WebkitBackdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: { xs: 'center', md: 'flex-start' },
            justifyContent: { xs: 'center', md: 'flex-start' },
            overflow: 'auto',
            p: { xs: 2, sm: 4 },
          }}
        >
          <IconButton
            aria-label="Close legend"
            onClick={(event) => {
              event.stopPropagation();
              closeLegend();
            }}
            sx={{
              position: 'fixed',
              top: { xs: 12, sm: 20 },
              right: { xs: 12, sm: 24 },
              color: 'common.white',
              bgcolor: 'rgba(30, 30, 36, 0.55)',
              '&:hover': {
                bgcolor: 'rgba(30, 30, 36, 0.75)',
              },
            }}
            size="large"
          >
            <CloseIcon />
          </IconButton>

          <Box
            onClick={(event) => event.stopPropagation()}
            sx={{
              position: { xs: 'relative', md: legendPosition ? 'absolute' : 'relative' },
              top: { md: legendPosition ? `${legendPosition.top}px` : '50%' },
              left: { md: legendPosition ? `${legendPosition.left}px` : '50%' },
              transform: {
                md: legendPosition ? 'translate(0, 0)' : 'translate(-50%, -50%)',
              },
              width: {
                xs: 'min(544px, 92vw)',
                sm: 'min(544px, 85vw)',
                md: legendPosition ? `${legendPosition.scaledWidth}px` : 'min(544px, 60vw)',
              },
              maxWidth: { xs: '544px', md: 'min(1088px, 90vw)' },
              pointerEvents: 'auto',
              touchAction: 'pan-x pan-y pinch-zoom',
              filter: 'drop-shadow(0 24px 48px rgba(0, 0, 0, 0.45))',
            }}
          >
            <Box
              component="img"
              src="/img/card-legend.svg"
              alt="Legend describing the additive card"
              draggable={false}
              sx={{
                width: '100%',
                height: 'auto',
                display: 'block',
                userSelect: 'none',
              }}
            />
            <Typography
              variant="caption"
              color="grey.200"
              sx={{ display: { xs: 'block', md: 'none' }, mt: 1, textAlign: 'center' }}
            >
              Pinch to zoom
            </Typography>
          </Box>
        </Box>
      ) : null}
    </>
  );
}
