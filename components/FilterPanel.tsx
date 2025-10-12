'use client';

import { useTransition } from 'react';
import type { ChangeEvent } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Box, Checkbox, FormControl, FormControlLabel, InputLabel, MenuItem, Select, Stack } from '@mui/material';
import type { SelectChangeEvent } from '@mui/material/Select';

import type { AdditiveSortMode } from '../lib/additives';

export interface FilterOption {
  slug: string;
  label: string;
}

interface FilterPanelProps {
  functionOptions: FilterOption[];
  originOptions: FilterOption[];
  currentFunctionSlug?: string | null;
  currentOriginSlug?: string | null;
  currentSortMode?: AdditiveSortMode;
  currentShowClasses?: boolean;
}

const HOME_ROUTE = '/';

export function FilterPanel({
  functionOptions,
  originOptions,
  currentFunctionSlug = null,
  currentOriginSlug = null,
  currentSortMode = 'search-rank',
  currentShowClasses = false,
}: FilterPanelProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  type SortSelectValue = 'search-rank' | 'products';
  const currentSortValue: SortSelectValue = currentSortMode === 'product-count' ? 'products' : 'search-rank';

  const buildUrlWithState = (
    path: string,
    sort: SortSelectValue = currentSortValue,
    showClasses: boolean = currentShowClasses,
  ) => {
    const params = new URLSearchParams(searchParams?.toString() ?? '');

    if (sort === 'products') {
      params.set('sort', 'products');
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

  const handleFunctionChange = (event: SelectChangeEvent<string>) => {
    const slug = event.target.value;

    startTransition(() => {
      if (slug) {
        router.push(buildUrlWithState(`/function/${slug}`));
      } else {
        router.push(buildUrlWithState(HOME_ROUTE));
      }
    });
  };

  const handleOriginChange = (event: SelectChangeEvent<string>) => {
    const slug = event.target.value;

    startTransition(() => {
      if (slug) {
        router.push(buildUrlWithState(`/origin/${slug}`));
      } else {
        router.push(buildUrlWithState(HOME_ROUTE));
      }
    });
  };

  const handleSortChange = (event: SelectChangeEvent<string>) => {
    const value = (event.target.value as SortSelectValue) || 'search-rank';

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

  return (
    <Stack
      direction={{ xs: 'column', sm: 'row' }}
      justifyContent={{ xs: 'flex-start', sm: 'flex-end' }}
      alignItems={{ xs: 'stretch', sm: 'center' }}
      spacing={1.5}
      width="100%"
      flexWrap="wrap"
    >
      <Box
        component="span"
        title="Show generic parent additives"
        sx={{
          mr: { xs: 0, sm: 1 },
          ml: { xs: -0.5, sm: 0 },
          alignSelf: { xs: 'flex-start', sm: 'center' },
          display: 'flex',
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
        <InputLabel id="origin-filter-label">Origin</InputLabel>
        <Select
          labelId="origin-filter-label"
          id="origin-filter"
          label="Origin"
          value={currentOriginSlug ?? ''}
          onChange={handleOriginChange}
        >
          <MenuItem value="">All origins</MenuItem>
          {originOptions.map((option) => (
            <MenuItem key={option.slug} value={option.slug}>
              {option.label}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      <FormControl
        size="small"
        sx={{ minWidth: { xs: '100%', sm: 180 } }}
        disabled={isPending}
      >
        <InputLabel id="function-filter-label">Function</InputLabel>
        <Select
          labelId="function-filter-label"
          id="function-filter"
          label="Function"
          value={currentFunctionSlug ?? ''}
          onChange={handleFunctionChange}
        >
          <MenuItem value="">All functions</MenuItem>
          {functionOptions.map((option) => (
            <MenuItem key={option.slug} value={option.slug}>
              {option.label}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
    </Stack>
  );
}
