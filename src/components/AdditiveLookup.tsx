'use client';

import { Fragment, useMemo, useRef, useState, useTransition, type ReactNode } from 'react';
import { Autocomplete, Box, CircularProgress, Stack, TextField, Typography } from '@mui/material';
import type { TextFieldProps } from '@mui/material/TextField';
import type { Modifier } from '@popperjs/core';

import type { Additive } from '../lib/additives';
import { formatAdditiveDisplayName } from '../lib/additive-format';
import type { AdditiveSearchMatch, HighlightRange } from '../lib/additive-search';
import { searchAdditives } from '../lib/additive-search';

interface AdditiveLookupProps<TAdditive extends Additive> {
  additives: TAdditive[];
  value: TAdditive | null;
  onChange: (value: TAdditive | null) => void;
  label?: string;
  placeholder?: string;
  disabledSlugs?: readonly string[];
  autoFocus?: boolean;
  id?: string;
  maxResults?: number;
  onResultsChange?: (results: AdditiveSearchMatch<TAdditive>[], query: string) => void;
  onInputValueChange?: (value: string) => void;
  textFieldProps?: TextFieldProps;
  clearOnSelect?: boolean;
  showPopupIcon?: boolean;
  transformInputDisplayValue?: (value: string) => string;
}

type MatchesMap<TAdditive extends Additive> = Map<string, AdditiveSearchMatch<TAdditive>['matches']>;

const renderHighlightedText = (text: string, ranges: HighlightRange[]): ReactNode => {
  if (!text) {
    return null;
  }

  if (!Array.isArray(ranges) || ranges.length === 0) {
    return text;
  }

  const parts: React.ReactNode[] = [];
  let cursor = 0;

  ranges
    .slice()
    .sort((a, b) => a.start - b.start)
    .forEach((range, index) => {
      if (range.start > cursor) {
        parts.push(text.slice(cursor, range.start));
      }

      parts.push(
        <Box key={`match-${index}`} component="strong" sx={{ fontWeight: 700 }}>
          {text.slice(range.start, range.end)}
        </Box>,
      );

      cursor = range.end;
    });

  if (cursor < text.length) {
    parts.push(text.slice(cursor));
  }

  return parts;
};

const MIN_QUERY_LENGTH = 2;

const sameWidthModifier: Modifier<'sameWidth', Record<string, never>> = {
  name: 'sameWidth',
  enabled: true,
  phase: 'beforeWrite',
  requires: ['computeStyles'],
  fn: ({ state }) => {
    const width = `${state.rects.reference.width}px`;
    state.styles.popper.width = width;
    state.styles.popper.minWidth = width;
  },
};

export function AdditiveLookup<TAdditive extends Additive>({
  additives,
  value,
  onChange,
  label,
  placeholder,
  disabledSlugs,
  autoFocus,
  id,
  maxResults = 50,
  onResultsChange,
  onInputValueChange,
  textFieldProps,
  clearOnSelect = false,
  showPopupIcon = true,
  transformInputDisplayValue,
}: AdditiveLookupProps<TAdditive>) {
  const [inputValue, setInputValue] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [isSearching, startTransition] = useTransition();
  const [results, setResults] = useState<AdditiveSearchMatch<TAdditive>[]>([]);
  const matchesRef = useRef<MatchesMap<TAdditive>>(new Map());

  const disabledSet = useMemo(() => new Set(disabledSlugs ?? []), [disabledSlugs]);

  const normalizedQuery = inputValue.trim();

  const displayOptions = useMemo(() => {
    if (normalizedQuery.length < MIN_QUERY_LENGTH) {
      return [];
    }

    return results.map((result) => result.additive);
  }, [normalizedQuery.length, results]);

  const noOptionsText = (() => {
    if (normalizedQuery.length === 0) {
      return 'Start typing to search';
    }

    if (normalizedQuery.length < MIN_QUERY_LENGTH) {
      return 'Type at least two characters';
    }

    return 'No additives found';
  })();

  const handleSearch = (query: string) => {
    const trimmed = query.trim();

    if (trimmed.length < MIN_QUERY_LENGTH) {
      matchesRef.current = new Map();
      setResults([]);
      if (onResultsChange) {
        onResultsChange([], trimmed);
      }
      return;
    }

    startTransition(() => {
      const computed = searchAdditives(additives, trimmed, { maxResults });
      matchesRef.current = new Map(computed.map((item) => [item.additive.slug, item.matches]));
      setResults(computed);
      if (onResultsChange) {
        onResultsChange(computed, trimmed);
      }
    });
  };

  return (
    <Autocomplete
      id={id}
      value={value}
      open={isOpen}
      options={displayOptions}
      autoHighlight
      clearOnBlur={false}
      includeInputInList
      loading={isSearching}
      forcePopupIcon={showPopupIcon}
      popupIcon={showPopupIcon ? undefined : null}
      filterOptions={(options) => options}
      slotProps={{
        popper: {
          modifiers: [sameWidthModifier],
        },
      }}
      onOpen={() => {
        setIsOpen(true);
        handleSearch(inputValue);
      }}
      onClose={() => setIsOpen(false)}
      onChange={(_, nextValue) => {
        onChange(nextValue ?? null);
        if (clearOnSelect) {
          matchesRef.current = new Map();
          setResults([]);
          setInputValue('');
          if (onInputValueChange) {
            onInputValueChange('');
          }
          if (onResultsChange) {
            onResultsChange([], '');
          }
        }
      }}
      onInputChange={(_, nextInput, reason) => {
        setInputValue(nextInput);
        if (onInputValueChange) {
          onInputValueChange(nextInput);
        }

        if (reason === 'input' || reason === 'reset') {
          handleSearch(nextInput);
        }

        if (reason === 'clear') {
          handleSearch('');
        }
      }}
      inputValue={inputValue}
      getOptionLabel={(option) => formatAdditiveDisplayName(option.eNumber, option.title)}
      isOptionEqualToValue={(option, optionValue) => option.slug === optionValue.slug}
      getOptionDisabled={(option) => disabledSet.has(option.slug)}
      renderInput={(params) => (
        (() => {
          const {
            InputProps: textFieldInputProps,
            label: customLabel,
            placeholder: customPlaceholder,
            autoFocus: customAutoFocus,
            ...otherTextFieldProps
          } = textFieldProps ?? {};
          const mergedInputProps = {
            ...params.InputProps,
            ...textFieldInputProps,
            startAdornment: (
              <Fragment>
                {textFieldInputProps?.startAdornment}
                {params.InputProps.startAdornment}
              </Fragment>
            ),
            endAdornment: (
              <Fragment>
                {isSearching ? <CircularProgress color="inherit" size={18} /> : null}
                {textFieldInputProps?.endAdornment}
                {params.InputProps.endAdornment}
              </Fragment>
            ),
          };

          const mergedInputBaseProps = {
            ...params.inputProps,
            ...(otherTextFieldProps?.inputProps ?? {}),
            autoComplete:
              otherTextFieldProps?.inputProps?.autoComplete !== undefined
                ? otherTextFieldProps.inputProps.autoComplete
                : 'off',
            autoCorrect:
              otherTextFieldProps?.inputProps?.autoCorrect !== undefined
                ? otherTextFieldProps.inputProps.autoCorrect
                : 'off',
            autoCapitalize:
              otherTextFieldProps?.inputProps?.autoCapitalize !== undefined
                ? otherTextFieldProps.inputProps.autoCapitalize
                : 'none',
            spellCheck:
              otherTextFieldProps?.inputProps?.spellCheck !== undefined
                ? otherTextFieldProps.inputProps.spellCheck
                : false,
          } as typeof params.inputProps;

          const finalInputProps = transformInputDisplayValue
            ? (() => {
                const rawValue = params.inputProps.value ?? '';
                const normalizedValue = typeof rawValue === 'string' ? rawValue : String(rawValue);

                return {
                  ...mergedInputBaseProps,
                  value: transformInputDisplayValue(normalizedValue),
                };
              })()
            : mergedInputBaseProps;

          return (
            <TextField
              {...params}
              {...otherTextFieldProps}
              label={customLabel ?? label}
              placeholder={customPlaceholder ?? placeholder}
              autoFocus={customAutoFocus ?? autoFocus}
              autoComplete={otherTextFieldProps?.autoComplete ?? 'off'}
              InputProps={mergedInputProps}
              inputProps={finalInputProps}
            />
          );
        })()
      )}
      renderOption={(props, option) => {
        const matches = matchesRef.current.get(option.slug);

        const normalizedENumber = option.eNumber?.trim() ?? '';
        const normalizedTitle = option.title?.trim() ?? '';
        const normalizedENumberLower = normalizedENumber.toLowerCase();
        const normalizedTitleLower = normalizedTitle.toLowerCase();

        const shouldShowENumber = normalizedENumber.length > 0;
        const shouldShowTitle =
          normalizedTitle.length > 0 && normalizedTitleLower !== normalizedENumberLower;

        const primaryLineSegments: ReactNode[] = [];

        if (shouldShowENumber) {
          primaryLineSegments.push(renderHighlightedText(normalizedENumber, matches?.eNumber ?? []));
        }

        if (shouldShowTitle) {
          primaryLineSegments.push(renderHighlightedText(normalizedTitle, matches?.title ?? []));
        }

        if (primaryLineSegments.length === 0) {
          primaryLineSegments.push(formatAdditiveDisplayName(normalizedENumber, normalizedTitle));
        }

        const synonymMatches = (matches?.synonyms ?? []).filter((synonymMatch) => {
          const synonymValue = synonymMatch.value?.trim();

          if (!synonymValue) {
            return false;
          }

          const synonymLower = synonymValue.toLowerCase();

          if (synonymLower === normalizedENumberLower || synonymLower === normalizedTitleLower) {
            return false;
          }

          return true;
        });

        const distinctSynonyms: typeof synonymMatches = [];
        const seenSynonyms = new Set<string>();

        synonymMatches.forEach((synonymMatch) => {
          const synonymValue = synonymMatch.value.trim();
          const synonymLower = synonymValue.toLowerCase();

          if (seenSynonyms.has(synonymLower)) {
            return;
          }

          seenSynonyms.add(synonymLower);
          distinctSynonyms.push({
            ...synonymMatch,
            value: synonymValue,
          });
        });

        const shouldShowSynonym = distinctSynonyms.length > 0;

        const synonymContent = shouldShowSynonym
          ? distinctSynonyms.map((synonymMatch, index) => (
              <Fragment key={`${option.slug}-synonym-${synonymMatch.index}`}>
                {index > 0 ? <Box component="span">, </Box> : null}
                <Box component="span">
                  {renderHighlightedText(synonymMatch.value, synonymMatch.ranges)}
                </Box>
              </Fragment>
            ))
          : null;

        return (
          <li {...props} key={option.slug}>
            <Stack spacing={synonymContent ? 0.25 : 0}>
              <Typography component="div" variant="body1">
                {primaryLineSegments.map((segment, index) => (
                  <Fragment key={`segment-${index}`}>
                    {index > 0 ? <Box component="span">{' — '}</Box> : null}
                    <Box component="span">{segment}</Box>
                  </Fragment>
                ))}
              </Typography>
              {synonymContent ? (
                <Typography component="div" variant="body2" color="text.secondary">
                  {synonymContent}
                </Typography>
              ) : null}
            </Stack>
          </li>
        );
      }}
      noOptionsText={noOptionsText}
    />
  );
}
