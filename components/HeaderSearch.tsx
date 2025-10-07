'use client';

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Box, InputAdornment } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';

import type { Additive } from '../lib/additives';
import type { AdditiveSearchMatch } from '../lib/additive-search';
import { AdditiveLookup } from './AdditiveLookup';

interface HeaderSearchProps {
  additives: Additive[];
}

export function HeaderSearch({ additives }: HeaderSearchProps) {
  const router = useRouter();
  const [value, setValue] = useState<Additive | null>(null);
  const [results, setResults] = useState<AdditiveSearchMatch<Additive>[]>([]);
  const [query, setQuery] = useState('');
  const [isFocused, setIsFocused] = useState(false);

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

  return (
    <Box className="header-search" data-active={isFocused || normalizedQuery.length > 0 ? 'true' : undefined}>
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
        onInputValueChange={setQuery}
        onResultsChange={(nextResults, searchQuery) => {
          setResults(nextResults);
          if (searchQuery.length === 0) {
            setQuery('');
          }
        }}
        showPopupIcon={false}
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
          onFocus: () => setIsFocused(true),
          onBlur: () => setIsFocused(false),
          InputProps: {
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            ),
          },
        }}
      />
    </Box>
  );
}
