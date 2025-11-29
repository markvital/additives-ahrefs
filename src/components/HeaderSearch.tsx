'use client';

import { useCallback, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Box, InputAdornment } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';

import type { AdditiveSearchMatch } from '../lib/additive-search';
import type { AdditiveSearchItem } from '../lib/additives';
import { useAdditiveSearchData } from '../lib/client/useAdditiveSearchData';
import { AdditiveLookup } from './AdditiveLookup';

export function HeaderSearch() {
  const router = useRouter();
  const [value, setValue] = useState<AdditiveSearchItem | null>(null);
  const [results, setResults] = useState<AdditiveSearchMatch<AdditiveSearchItem>[]>([]);
  const [query, setQuery] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const { additives, ensureLoaded: ensureSearchData, hasLoaded, isLoading } = useAdditiveSearchData();

  const handleQueryChange = useCallback(
    (nextQuery: string) => {
      setQuery(nextQuery);

      if (!hasLoaded) {
        ensureSearchData();
      }
    },
    [ensureSearchData, hasLoaded],
  );

  const loadingState = useMemo(() => !hasLoaded && isLoading, [hasLoaded, isLoading]);

  const navigateToAdditive = useCallback(
    (slug: string | null | undefined) => {
      if (!slug) {
        return;
      }

      router.push(`/${slug}`);
    },
    [router],
  );

  const handleSubmit = useCallback(() => {
    if (results.length === 0) {
      return;
    }

    const first = results[0]?.additive;

    if (first) {
      navigateToAdditive(first.slug);
    }
  }, [navigateToAdditive, results]);

  const normalizedQuery = query.trim();
  const placeholder = !isFocused && normalizedQuery.length === 0 ? 'Search' : undefined;
  const shouldCollapseValue = !isFocused && normalizedQuery.length > 0;

  const transformDisplayValue = useCallback(
    (value: string) => {
      if (shouldCollapseValue) {
        return '...';
      }

      return value;
    },
    [shouldCollapseValue],
  );

  return (
    <Box
      className="header-search"
      data-active={isFocused ? 'true' : undefined}
      onPointerEnter={ensureSearchData}
    >
      <AdditiveLookup
        additives={additives}
        value={value}
        onChange={(nextValue) => {
          if (nextValue) {
            navigateToAdditive(nextValue.slug);
          }
          setValue(null);
        }}
        placeholder={placeholder}
        clearOnSelect
        onInputValueChange={handleQueryChange}
        onResultsChange={(nextResults, searchQuery) => {
          setResults(nextResults);
          if (searchQuery.length === 0) {
            setQuery('');
          }
        }}
        showPopupIcon={false}
        loading={loadingState}
        textFieldProps={{
          size: 'small',
          onKeyDown: (event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              if (normalizedQuery.length > 0) {
                handleSubmit();
              }
            }
          },
          autoComplete: 'off',
          onFocus: () => {
            setIsFocused(true);
            ensureSearchData();
          },
          onPointerEnter: () => {
            ensureSearchData();
          },
          onBlur: () => setIsFocused(false),
          sx: {
            '& .MuiOutlinedInput-root': {
              borderRadius: 999,
            },
            '& .MuiOutlinedInput-input': {
              paddingTop: 0.5,
              paddingBottom: 0.5,
            },
          },
          InputProps: {
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            ),
          },
        }}
        transformInputDisplayValue={transformDisplayValue}
      />
    </Box>
  );
}
