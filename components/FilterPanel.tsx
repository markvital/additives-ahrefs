'use client';

import { useTransition, ChangeEvent } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  Checkbox,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Select,
  Stack,
} from '@mui/material';
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
const SHOW_CLASSES_PARAM = 'classes';

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

  const buildUrlWithSort = (path: string, sort: SortSelectValue) => {
    const params = new URLSearchParams(searchParams?.toString() ?? '');

    if (sort === 'products') {
      params.set('sort', 'products');
    } else {
      params.delete('sort');
    }

    if (currentShowClasses) {
      params.set(SHOW_CLASSES_PARAM, '1');
    } else {
      params.delete(SHOW_CLASSES_PARAM);
    }

    const queryString = params.toString();
    return queryString ? `${path}?${queryString}` : path;
  };

  const handleFunctionChange = (event: SelectChangeEvent<string>) => {
    const slug = event.target.value;

    startTransition(() => {
      if (slug) {
        router.push(buildUrlWithSort(`/function/${slug}`, currentSortValue));
      } else {
        router.push(buildUrlWithSort(HOME_ROUTE, currentSortValue));
      }
    });
  };

  const handleOriginChange = (event: SelectChangeEvent<string>) => {
    const slug = event.target.value;

    startTransition(() => {
      if (slug) {
        router.push(buildUrlWithSort(`/origin/${slug}`, currentSortValue));
      } else {
        router.push(buildUrlWithSort(HOME_ROUTE, currentSortValue));
      }
    });
  };

  const handleSortChange = (event: SelectChangeEvent<string>) => {
    const value = (event.target.value as SortSelectValue) || 'search-rank';

    startTransition(() => {
      router.push(buildUrlWithSort(pathname, value));
    });
  };

  const handleShowClassesChange = (event: ChangeEvent<HTMLInputElement>) => {
    const checked = event.target.checked;

    startTransition(() => {
      const params = new URLSearchParams(searchParams?.toString() ?? '');

      if (checked) {
        params.set(SHOW_CLASSES_PARAM, '1');
      } else {
        params.delete(SHOW_CLASSES_PARAM);
      }

      if (currentSortValue === 'products') {
        params.set('sort', 'products');
      } else {
        params.delete('sort');
      }

      const queryString = params.toString();
      router.push(queryString ? `${pathname}?${queryString}` : pathname);
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
      <FormControlLabel
        control={
          <Checkbox
            size="small"
            checked={currentShowClasses}
            onChange={handleShowClassesChange}
            disabled={isPending}
          />
        }
        label="Show classes"
        sx={{ margin: 0 }}
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
