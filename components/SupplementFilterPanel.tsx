'use client';

import { useTransition } from 'react';
import type { ChangeEvent } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Box, Checkbox, FormControl, FormControlLabel, InputLabel, MenuItem, Select, Stack } from '@mui/material';
import type { SelectChangeEvent } from '@mui/material/Select';

import type { AdditiveSortMode } from '../lib/additives';

export interface SupplementFilterOption {
  slug: string;
  label: string;
}

interface SupplementFilterPanelProps {
  roleOptions: SupplementFilterOption[];
  formatOptions: SupplementFilterOption[];
  currentRoleSlug?: string | null;
  currentFormatSlug?: string | null;
  currentSortMode?: AdditiveSortMode;
  showClasses?: boolean;
}

const DEFAULT_SORT_MODE: AdditiveSortMode = 'product-count';

export function SupplementFilterPanel({
  roleOptions,
  formatOptions,
  currentRoleSlug = null,
  currentFormatSlug = null,
  currentSortMode = DEFAULT_SORT_MODE,
  showClasses = false,
}: SupplementFilterPanelProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  type SortSelectValue = 'search-rank' | 'products';
  const currentSortValue: SortSelectValue = currentSortMode === 'product-count' ? 'products' : 'search-rank';

  const buildUrl = (
    roleSlug: string | null,
    formatSlug: string | null,
    sortValue: SortSelectValue,
    showParentClasses: boolean,
  ) => {
    const params = new URLSearchParams(searchParams?.toString() ?? '');

    if (roleSlug) {
      params.set('role', roleSlug);
    } else {
      params.delete('role');
    }

    if (formatSlug) {
      params.set('format', formatSlug);
    } else {
      params.delete('format');
    }

    if (sortValue === 'search-rank') {
      params.set('sort', 'search-rank');
    } else {
      params.delete('sort');
    }

    if (showParentClasses) {
      params.set('classes', '1');
    } else {
      params.delete('classes');
    }

    const query = params.toString();
    return query ? `${pathname}?${query}` : pathname;
  };

  const handleRoleChange = (event: SelectChangeEvent<string>) => {
    const slug = event.target.value;

    startTransition(() => {
      router.push(buildUrl(slug || null, currentFormatSlug, currentSortValue, showClasses));
    });
  };

  const handleFormatChange = (event: SelectChangeEvent<string>) => {
    const slug = event.target.value;

    startTransition(() => {
      router.push(buildUrl(currentRoleSlug, slug || null, currentSortValue, showClasses));
    });
  };

  const handleSortChange = (event: SelectChangeEvent<string>) => {
    const value = (event.target.value as SortSelectValue) || 'products';

    startTransition(() => {
      router.push(buildUrl(currentRoleSlug, currentFormatSlug, value, showClasses));
    });
  };

  const handleShowClassesChange = (event: ChangeEvent<HTMLInputElement>) => {
    const nextShowClasses = event.target.checked;

    startTransition(() => {
      router.push(buildUrl(currentRoleSlug, currentFormatSlug, currentSortValue, nextShowClasses));
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
              checked={showClasses}
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
        <InputLabel id="supplement-sort-filter-label">Sort by</InputLabel>
        <Select
          labelId="supplement-sort-filter-label"
          id="supplement-sort-filter"
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
        sx={{ minWidth: { xs: '100%', sm: 200 } }}
        disabled={isPending}
      >
        <InputLabel id="supplement-role-filter-label">Primary role</InputLabel>
        <Select
          labelId="supplement-role-filter-label"
          id="supplement-role-filter"
          label="Primary role"
          value={currentRoleSlug ?? ''}
          onChange={handleRoleChange}
        >
          <MenuItem value="">All roles</MenuItem>
          {roleOptions.map((option) => (
            <MenuItem key={option.slug} value={option.slug}>
              {option.label}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      <FormControl
        size="small"
        sx={{ minWidth: { xs: '100%', sm: 200 } }}
        disabled={isPending}
      >
        <InputLabel id="supplement-format-filter-label">Delivery format</InputLabel>
        <Select
          labelId="supplement-format-filter-label"
          id="supplement-format-filter"
          label="Delivery format"
          value={currentFormatSlug ?? ''}
          onChange={handleFormatChange}
        >
          <MenuItem value="">All formats</MenuItem>
          {formatOptions.map((option) => (
            <MenuItem key={option.slug} value={option.slug}>
              {option.label}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
    </Stack>
  );
}
