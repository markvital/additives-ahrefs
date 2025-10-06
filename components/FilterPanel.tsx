'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { FormControl, InputLabel, MenuItem, Select, Stack } from '@mui/material';
import type { SelectChangeEvent } from '@mui/material/Select';

export interface FilterOption {
  slug: string;
  label: string;
}

interface FilterPanelProps {
  functionOptions: FilterOption[];
  originOptions: FilterOption[];
  currentFunctionSlug?: string | null;
  currentOriginSlug?: string | null;
}

const HOME_ROUTE = '/';

export function FilterPanel({
  functionOptions,
  originOptions,
  currentFunctionSlug = null,
  currentOriginSlug = null,
}: FilterPanelProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleFunctionChange = (event: SelectChangeEvent<string>) => {
    const slug = event.target.value;

    startTransition(() => {
      if (slug) {
        router.push(`/function/${slug}`);
      } else {
        router.push(HOME_ROUTE);
      }
    });
  };

  const handleOriginChange = (event: SelectChangeEvent<string>) => {
    const slug = event.target.value;

    startTransition(() => {
      if (slug) {
        router.push(`/origin/${slug}`);
      } else {
        router.push(HOME_ROUTE);
      }
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
