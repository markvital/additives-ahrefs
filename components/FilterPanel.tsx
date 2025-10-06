'use client';

import { useTransition } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { FormControl, InputLabel, MenuItem, Select, Stack } from '@mui/material';
import type { SelectChangeEvent } from '@mui/material/Select';

export interface FilterOption {
  slug: string;
  label: string;
}

type SortMode = 'search' | 'products';

const SORT_OPTIONS: Array<{ value: SortMode; label: string }> = [
  { value: 'search', label: 'Search rank' },
  { value: 'products', label: 'Products' },
];

interface FilterPanelProps {
  functionOptions: FilterOption[];
  originOptions: FilterOption[];
  currentFunctionSlug?: string | null;
  currentOriginSlug?: string | null;
  sortMode?: SortMode;
}

const HOME_ROUTE = '/';

export function FilterPanel({
  functionOptions,
  originOptions,
  currentFunctionSlug = null,
  currentOriginSlug = null,
  sortMode = 'search',
}: FilterPanelProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();
  const sortValue = sortMode;

  const createUrlWithSort = (path: string, nextSort: SortMode) => {
    const params = new URLSearchParams();
    if (nextSort && nextSort !== 'search') {
      params.set('sort', nextSort);
    }
    const query = params.toString();
    return query ? `${path}?${query}` : path;
  };

  const handleFunctionChange = (event: SelectChangeEvent<string>) => {
    const slug = event.target.value;

    startTransition(() => {
      if (slug) {
        router.push(createUrlWithSort(`/function/${slug}`, sortValue));
      } else {
        router.push(createUrlWithSort(HOME_ROUTE, sortValue));
      }
    });
  };

  const handleOriginChange = (event: SelectChangeEvent<string>) => {
    const slug = event.target.value;

    startTransition(() => {
      if (slug) {
        router.push(createUrlWithSort(`/origin/${slug}`, sortValue));
      } else {
        router.push(createUrlWithSort(HOME_ROUTE, sortValue));
      }
    });
  };

  const handleSortChange = (event: SelectChangeEvent<string>) => {
    const value = event.target.value as SortMode | '';
    const nextSort = value && (value === 'products' ? 'products' : 'search');
    const targetSort = nextSort || 'search';
    const currentPath = pathname || HOME_ROUTE;

    startTransition(() => {
      router.push(createUrlWithSort(currentPath, targetSort));
    });
  };

  return (
    <Stack
      direction={{ xs: 'column', sm: 'row' }}
      justifyContent={{ xs: 'flex-start', sm: 'space-between' }}
      alignItems={{ xs: 'stretch', sm: 'center' }}
      spacing={1.5}
      width="100%"
      flexWrap="wrap"
    >
      <FormControl
        size="small"
        sx={{ minWidth: { xs: '100%', sm: 200 } }}
        disabled={isPending}
      >
        <InputLabel id="sort-filter-label">Sort by</InputLabel>
        <Select
          labelId="sort-filter-label"
          id="sort-filter"
          label="Sort by"
          value={sortValue}
          onChange={handleSortChange}
        >
          {SORT_OPTIONS.map((option) => (
            <MenuItem key={option.value} value={option.value}>
              {option.label}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={1.5}
        alignItems={{ xs: 'stretch', sm: 'center' }}
        justifyContent={{ xs: 'flex-start', sm: 'flex-end' }}
        flexGrow={1}
        flexWrap="wrap"
      >
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
    </Stack>
  );
}
