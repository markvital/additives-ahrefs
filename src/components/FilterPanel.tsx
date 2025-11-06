'use client';

import { useCallback, useEffect, useState, useTransition } from 'react';
import type { ChangeEvent } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import {
  Box,
  Button,
  Checkbox,
  Divider,
  FormControl,
  FormControlLabel,
  IconButton,
  InputLabel,
  ListSubheader,
  MenuItem,
  Select,
  Stack,
  Typography,
} from '@mui/material';
import type { Theme } from '@mui/material/styles';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import CloseIcon from '@mui/icons-material/Close';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import type { SelectChangeEvent } from '@mui/material/Select';

import type { AdditiveSortMode } from '../lib/additives';
import { getOriginAbbreviation, getOriginIcon } from '../lib/origin-icons';

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
}

const HOME_ROUTE = '/';
const DEFAULT_SORT_MODE: AdditiveSortMode = 'product-count';

export function FilterPanel({
  functionOptions,
  originOptions,
  currentFilter = null,
  currentSortMode = DEFAULT_SORT_MODE,
  currentShowClasses = false,
}: FilterPanelProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [legendOpen, setLegendOpen] = useState(false);
  const [legendPosition, setLegendPosition] = useState<
    { top: number; left: number; width: number; scaledWidth: number } | null
  >(null);
  const [showClassesControlVisible, setShowClassesControlVisible] = useState(currentShowClasses);

  useEffect(() => {
    if (currentShowClasses) {
      setShowClassesControlVisible(true);
    }
  }, [currentShowClasses]);
  type SortSelectValue = 'search-rank' | 'products' | 'awareness';
  const currentSortValue: SortSelectValue =
    currentSortMode === 'product-count'
      ? 'products'
      : currentSortMode === 'awareness'
        ? 'awareness'
        : 'search-rank';

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
  ) => {
    const params = new URLSearchParams(searchParams?.toString() ?? '');

    if (sort === 'search-rank') {
      params.set('sort', 'search-rank');
    } else if (sort === 'awareness') {
      params.set('sort', 'awareness');
    } else {
      params.delete('sort');
    }

    if (showClasses) {
      params.set('classes', '1');
    } else {
      params.delete('classes');
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

  const showMoreButtonSx = {
    color: 'text.secondary',
    borderRadius: '999px',
    border: '1px solid',
    borderColor: 'grey.300',
    backgroundColor: 'transparent',
    transition: (theme: Theme) => theme.transitions.create(['border-color', 'color']),
    '&:hover': {
      color: 'text.primary',
      borderColor: 'grey.400',
      backgroundColor: 'transparent',
    },
    '&:focus-visible': {
      borderColor: 'primary.main',
      color: 'text.primary',
      backgroundColor: 'transparent',
    },
  } as const;

  const handleShowMoreClick = () => {
    setShowClassesControlVisible(true);
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
          direction={{ xs: 'row', sm: 'row' }}
          spacing={{ xs: 1, sm: 1.5 }}
          alignItems={{ xs: 'center', sm: 'center' }}
          justifyContent={{ xs: 'space-between', md: 'flex-start' }}
          flexWrap="wrap"
          sx={{
            flexBasis: { xs: '100%', sm: 'auto' },
            flexGrow: { xs: 1, sm: 0 },
            minWidth: { xs: 0, sm: 'auto' },
            width: { xs: '100%', sm: 'auto' },
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
          {!showClassesControlVisible && (
            <IconButton
              aria-label="Show family filter"
              onClick={handleShowMoreClick}
              size="small"
              sx={{
                ...showMoreButtonSx,
                display: { xs: 'inline-flex', sm: 'none' },
                ml: 'auto',
              }}
            >
              <MoreVertIcon fontSize="small" />
            </IconButton>
          )}
        </Stack>

        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={1.5}
          alignItems={{ xs: 'stretch', sm: 'center' }}
          flexWrap="wrap"
          justifyContent="flex-end"
          sx={{ flexGrow: 1 }}
        >
          <FormControl
            size="small"
            sx={{ minWidth: { xs: '100%', sm: 180 }, order: { xs: 0, sm: 0 } }}
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
              <MenuItem value="products">Products</MenuItem>
              <MenuItem value="awareness">Awareness score</MenuItem>
              <MenuItem value="search-rank">Search rank</MenuItem>
            </Select>
          </FormControl>

          <Box
            component="span"
            title="Show additive families"
            sx={{
              alignSelf: 'center',
              display: showClassesControlVisible ? 'flex' : { xs: 'none', sm: 'inline-flex' },
              order: { xs: -1, sm: 1 },
            }}
          >
            {showClassesControlVisible ? (
              <FormControlLabel
                control={
                  <Checkbox
                    size="small"
                    checked={currentShowClasses}
                    onChange={handleShowClassesChange}
                    disabled={isPending}
                  />
                }
                label="Show families"
                sx={{
                  color: 'text.secondary',
                  '& .MuiFormControlLabel-label': {
                    fontSize: 14,
                  },
                }}
              />
            ) : (
              <IconButton
                aria-label="Show family filter"
                onClick={handleShowMoreClick}
                size="small"
                sx={{
                  ...showMoreButtonSx,
                  display: { xs: 'none', sm: 'inline-flex' },
                }}
              >
                <MoreVertIcon fontSize="small" />
              </IconButton>
            )}
          </Box>

          <FormControl
            size="small"
            sx={{ minWidth: { xs: '100%', sm: 180 }, order: { xs: 1, sm: 2 } }}
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
              <MenuItem
                value=""
                sx={{
                  '&.Mui-selected': { backgroundColor: 'transparent' },
                  '&.Mui-selected:hover': { backgroundColor: 'action.hover' },
                }}
              >
                All filters
              </MenuItem>
              <Divider component="li" sx={{ borderColor: 'grey.200', mx: 1 }} />
              <ListSubheader disableSticky>Origins</ListSubheader>
              {originOptions.map((option) => {
                const icon = getOriginIcon(option.slug);
                const abbreviation = getOriginAbbreviation(option.label);

                return (
                  <MenuItem key={`origin:${option.slug}`} value={`origin:${option.slug}`}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      {icon ? (
                        <Box
                          sx={{
                            width: 18,
                            height: 18,
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                          }}
                        >
                          <Image
                            src={icon}
                            alt={`${option.label} origin icon`}
                            width={18}
                            height={18}
                            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                          />
                        </Box>
                      ) : (
                        <Box
                          sx={{
                            width: 18,
                            height: 18,
                            borderRadius: '50%',
                            bgcolor: 'grey.100',
                            color: 'text.secondary',
                            fontSize: 10,
                            fontWeight: 600,
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                          }}
                        >
                          {abbreviation}
                        </Box>
                      )}
                      <Typography component="span" variant="body1" sx={{ lineHeight: 1 }}>
                        {option.label}
                      </Typography>
                    </Box>
                  </MenuItem>
                );
              })}
              <Divider component="li" sx={{ borderColor: 'grey.200', mx: 1, my: 0.5 }} />
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
