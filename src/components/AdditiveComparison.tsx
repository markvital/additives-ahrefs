'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Box, Button, Chip, Stack, Typography } from '@mui/material';
import type { Additive, AdditiveSearchItem } from '../lib/additives';
import { formatAdditiveDisplayName, formatFunctionLabel, formatOriginLabel } from '../lib/additive-format';
import { extractArticleSummary, splitArticlePreview } from '../lib/article';
import { formatMonthlyVolume, formatProductCount, getCountryFlagEmoji, getCountryLabel } from '../lib/format';
import type { SearchHistoryDataset } from '../lib/search-history';
import { MarkdownArticle } from './MarkdownArticle';
import { AdditiveLookup } from './AdditiveLookup';
import { SearchHistoryChart } from './SearchHistoryChart';
import type { AwarenessScoreResult } from '../lib/awareness';
import { AwarenessScoreChip } from './AwarenessScoreChip';
import {
  getCachedAdditiveSearchItems,
  hasAdditiveSearchDataLoaded,
  isAdditiveSearchDataLoading,
  loadAdditiveSearchItems,
} from '../lib/client/additive-search-data';

export interface ComparisonAdditive extends Additive {
  searchHistory: SearchHistoryDataset | null;
}

interface AdditiveComparisonProps {
  initialSelection: [string | null, string | null];
  initialAdditives: Record<string, ComparisonAdditive>;
  awarenessScores: Record<string, AwarenessScoreResult>;
}

interface SelectionState {
  left: string | null;
  right: string | null;
}

const toSearchItem = (additive: ComparisonAdditive): AdditiveSearchItem => ({
  slug: additive.slug,
  title: additive.title,
  eNumber: additive.eNumber,
  synonyms: additive.synonyms,
  searchRank: typeof additive.searchRank === 'number' ? additive.searchRank : null,
});

const getInitialSearchItems = (initialAdditives: Record<string, ComparisonAdditive>): AdditiveSearchItem[] => {
  const unique = new Map<string, AdditiveSearchItem>();

  Object.values(initialAdditives).forEach((additive) => {
    unique.set(additive.slug, toSearchItem(additive));
  });

  return Array.from(unique.values());
};

interface AdditiveDetailResponse {
  additive?: ComparisonAdditive | null;
}

const fetchComparisonAdditive = async (slug: string): Promise<ComparisonAdditive | null> => {
  const response = await fetch(`/api/additives/${encodeURIComponent(slug)}`, {
    cache: 'force-cache',
    credentials: 'same-origin',
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`Failed to load additive details for ${slug}: ${response.status}`);
  }

  const payload = (await response.json()) as AdditiveDetailResponse;

  if (!payload.additive) {
    return null;
  }

  return {
    ...payload.additive,
    searchHistory: payload.additive.searchHistory ?? null,
  };
};

const functionChipSx = {
  borderRadius: '7.5px',
  bgcolor: '#f4f4f4',
  color: '#787878',
  border: 'none',
  textTransform: 'none',
  whiteSpace: 'nowrap',
  '& .MuiChip-label': {
    px: '5px',
    py: '3px',
    color: '#787878',
  },
} as const;

const renderSynonymContent = (additive: ComparisonAdditive | null) => {
  if (!additive) {
    return null;
  }

  if (additive.synonyms.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        No synonyms available.
      </Typography>
    );
  }

  const synonyms = additive.synonyms.filter((value, index, list) => list.indexOf(value) === index);

  return (
    <Stack direction="row" spacing={1} flexWrap="wrap">
      {synonyms.map((synonym) => (
        <Chip
          key={synonym}
          label={synonym}
          variant="outlined"
          size="small"
        />
      ))}
    </Stack>
  );
};

const renderFunctionContent = (additive: ComparisonAdditive | null) => {
  if (!additive) {
    return null;
  }

  if (additive.functions.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        Not specified.
      </Typography>
    );
  }

  const functions = additive.functions.filter((value, index, list) => list.indexOf(value) === index);

  return (
    <Stack direction="row" spacing={1} flexWrap="wrap">
      {functions.map((fn) => (
        <Chip
          key={fn}
          label={formatFunctionLabel(fn)}
          variant="filled"
          size="small"
          sx={functionChipSx}
        />
      ))}
    </Stack>
  );
};

const renderOriginContent = (additive: ComparisonAdditive | null) => {
  if (!additive) {
    return null;
  }

  if (additive.origin.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        Not specified.
      </Typography>
    );
  }

  const origins = additive.origin.filter((value, index, list) => list.indexOf(value) === index);

  return (
    <Stack direction="row" spacing={1} flexWrap="wrap">
      {origins.map((origin) => (
        <Chip key={origin} label={formatOriginLabel(origin)} variant="outlined" size="small" />
      ))}
    </Stack>
  );
};

const getSearchInterestLabel = (dataset: SearchHistoryDataset | null) => {
  if (!dataset) {
    return null;
  }

  const keywords = Array.isArray(dataset.keywords) ? dataset.keywords : [];
  const firstKeyword = keywords[0]?.keyword?.trim();

  let keywordText: string | null = null;
  if (keywords.length === 1 && firstKeyword) {
    keywordText = `“${firstKeyword}”`;
  } else if (keywords.length > 1) {
    keywordText = `${keywords.length} keywords`;
  }

  if (!keywordText) {
    return null;
  }

  const countryCode = dataset.country?.trim();
  const countryLabel = countryCode ? getCountryLabel(countryCode) ?? countryCode.toUpperCase() : null;
  const countryText = countryLabel ? `${countryLabel}` : null;

  if (!countryText) {
    return `Interest over time for ${keywordText} during the last 10 years.`;
  }

  return `Interest over time for ${keywordText} in ${countryText} during the last 10 years.`;
};

const renderSearchMetrics = (additive: ComparisonAdditive | null) => {
  if (!additive) {
    return null;
  }

  const hasRank = typeof additive.searchRank === 'number';
  const hasVolume = typeof additive.searchVolume === 'number';
  const countryCode = additive.searchHistory?.country;
  const flag = countryCode ? getCountryFlagEmoji(countryCode) : null;
  const countryLabel = countryCode ? getCountryLabel(countryCode) ?? countryCode.toUpperCase() : null;

  if (!hasRank && !hasVolume && !flag) {
    return (
      <Typography variant="body2" color="text.secondary">
        Search metrics are not available.
      </Typography>
    );
  }

  return (
    <Stack direction="row" alignItems="center" spacing={1.5} flexWrap="wrap">
      {hasRank && (
        <Typography component="span" variant="body1" fontWeight={600} sx={{ fontVariantNumeric: 'tabular-nums' }}>
          #{additive.searchRank}
        </Typography>
      )}
      {hasVolume && (
        <Typography component="span" variant="body1" sx={{ fontVariantNumeric: 'tabular-nums' }}>
          {formatMonthlyVolume(additive.searchVolume!)} / mo
        </Typography>
      )}
      {flag && (
        <Typography component="span" variant="body1" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75 }}>
          <Box component="span" role="img" aria-label={countryLabel ?? undefined} sx={{ fontSize: 18 }}>
            {flag}
          </Box>
          {countryLabel}
        </Typography>
      )}
    </Stack>
  );
};

interface SearchHistoryDomain {
  min: number;
  max: number;
}

const renderSearchHistory = (additive: ComparisonAdditive | null, domain?: SearchHistoryDomain | null) => {
  if (!additive) {
    return null;
  }

  const dataset = additive.searchHistory;

  if (!dataset || !Array.isArray(dataset.metrics) || dataset.metrics.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        Search history data is not available.
      </Typography>
    );
  }

  const label = getSearchInterestLabel(dataset);

  return (
    <Stack spacing={2} sx={{ width: '100%' }}>
      <SearchHistoryChart
        metrics={dataset.metrics}
        domain={domain ?? undefined}
      />
      {label && (
        <Typography variant="body2" color="text.secondary" textAlign="center">
          {label}
        </Typography>
      )}
    </Stack>
  );
};

const LARGE_BUTTON_STYLES = {
  fontSize: '1.1rem',
  px: 4,
  py: 1.75,
} as const;

const renderDetailLink = (additive: ComparisonAdditive | null) => {
  if (!additive) {
    return null;
  }

  return (
    <Box sx={{ display: 'flex', justifyContent: 'center' }}>
      <Button
        component={Link}
        href={`/${additive.slug}`}
        variant="contained"
        color="primary"
        sx={LARGE_BUTTON_STYLES}
      >
        Read more
      </Button>
    </Box>
  );
};

const renderArticlePreview = (additive: ComparisonAdditive | null) => {
  if (!additive) {
    return null;
  }

  const { preview, hasMore } = splitArticlePreview(additive.article, 20);

  if (!preview) {
    return (
      <Typography variant="body2" color="text.secondary">
        Article content is not available for this additive.
      </Typography>
    );
  }

  return (
    <Stack spacing={2} sx={{ width: '100%' }}>
      <MarkdownArticle content={preview} />
      {hasMore ? (
        <Typography variant="body2" color="text.secondary">
          Preview truncated. Visit the additive page to read the full article.
        </Typography>
      ) : null}
      <Box sx={{ display: 'flex', justifyContent: 'center' }}>
        <Typography
          component={Link}
          href={`/${additive.slug}`}
          variant="h5"
          sx={{
            color: 'primary.main',
            fontWeight: 600,
            textDecoration: 'none',
            '&:hover': { textDecoration: 'underline' },
          }}
        >
          Read more
        </Typography>
      </Box>
    </Stack>
  );
};

export function AdditiveComparison({ initialSelection, initialAdditives, awarenessScores }: AdditiveComparisonProps) {
  const router = useRouter();
  const pathname = usePathname();

  const [initialLeft, initialRight] = initialSelection;

  const [selection, setSelection] = useState<SelectionState>(() => ({
    left: initialLeft,
    right: initialRight,
  }));

  const [additiveMap, setAdditiveMap] = useState<Map<string, ComparisonAdditive>>(
    () => new Map(Object.entries(initialAdditives)),
  );
  const additiveMapRef = useRef(additiveMap);

  useEffect(() => {
    additiveMapRef.current = additiveMap;
  }, [additiveMap]);

  useEffect(() => {
    setAdditiveMap((prev) => {
      const next = new Map(prev);
      Object.entries(initialAdditives).forEach(([slug, additive]) => {
        next.set(slug, additive);
      });
      return next;
    });
  }, [initialAdditives]);

  useEffect(() => {
    setSelection((prev) => {
      if (prev.left === initialLeft && prev.right === initialRight) {
        return prev;
      }

      return {
        left: initialLeft,
        right: initialRight,
      };
    });
  }, [initialLeft, initialRight]);

  const [hasLoadedSearchData, setHasLoadedSearchData] = useState(() => hasAdditiveSearchDataLoaded());
  const [isSearchLoading, setIsSearchLoading] = useState(() => isAdditiveSearchDataLoading());
  const [searchItems, setSearchItems] = useState<AdditiveSearchItem[]>(() => {
    const cached = getCachedAdditiveSearchItems();
    if (cached && cached.length > 0) {
      return cached;
    }

    return getInitialSearchItems(initialAdditives);
  });

  useEffect(() => {
    if (!hasAdditiveSearchDataLoaded()) {
      setSearchItems(getInitialSearchItems(initialAdditives));
    }
  }, [initialAdditives]);

  useEffect(() => {
    if (!hasLoadedSearchData) {
      if (hasAdditiveSearchDataLoaded()) {
        const cached = getCachedAdditiveSearchItems();
        if (cached) {
          setSearchItems(cached);
        }
        setHasLoadedSearchData(true);
        setIsSearchLoading(false);
      } else if (isAdditiveSearchDataLoading()) {
        setIsSearchLoading(true);
        loadAdditiveSearchItems()
          .then((items) => {
            setSearchItems(items);
            setHasLoadedSearchData(true);
          })
          .catch((error) => {
            console.error('Unable to load additives for comparison search', error);
            setHasLoadedSearchData(false);
          })
          .finally(() => {
            setIsSearchLoading(false);
          });
      }
    }
  }, [hasLoadedSearchData]);

  const ensureSearchData = useCallback(() => {
    if (hasAdditiveSearchDataLoaded()) {
      const cached = getCachedAdditiveSearchItems();
      if (cached) {
        setSearchItems(cached);
      }
      setHasLoadedSearchData(true);
      setIsSearchLoading(false);
      return;
    }

    if (isSearchLoading) {
      return;
    }

    setIsSearchLoading(true);
    loadAdditiveSearchItems()
      .then((items) => {
        setSearchItems(items);
        setHasLoadedSearchData(true);
      })
      .catch((error) => {
        console.error('Unable to load additives for comparison search', error);
        setHasLoadedSearchData(false);
      })
      .finally(() => {
        setIsSearchLoading(false);
      });
  }, [isSearchLoading]);

  const [loadingSlots, setLoadingSlots] = useState<{ left: boolean; right: boolean }>({ left: false, right: false });
  const [slotErrors, setSlotErrors] = useState<{ left: string | null; right: string | null }>({ left: null, right: null });
  const detailPromisesRef = useRef(new Map<string, Promise<ComparisonAdditive | null>>());

  const updateSlotLoading = useCallback((slot: 'left' | 'right', value: boolean) => {
    setLoadingSlots((prev) => (prev[slot] === value ? prev : { ...prev, [slot]: value }));
  }, []);

  const updateSlotError = useCallback((slot: 'left' | 'right', value: string | null) => {
    setSlotErrors((prev) => (prev[slot] === value ? prev : { ...prev, [slot]: value }));
  }, []);

  const loadAdditiveDetail = useCallback(
    async (slot: 'left' | 'right', slug: string) => {
      if (!slug) {
        return;
      }

      if (additiveMapRef.current.has(slug)) {
        updateSlotError(slot, null);
        return;
      }

      const existingPromise = detailPromisesRef.current.get(slug);
      if (existingPromise) {
        updateSlotLoading(slot, true);
        try {
          const additive = await existingPromise;
          if (additive) {
            setAdditiveMap((prev) => {
              if (prev.get(slug) === additive) {
                return prev;
              }
              const next = new Map(prev);
              next.set(slug, additive);
              return next;
            });
            updateSlotError(slot, null);
          } else {
            updateSlotError(slot, 'Additive not found.');
          }
        } catch (error) {
          console.error('Unable to load additive details', error);
          updateSlotError(slot, 'Unable to load additive details.');
        } finally {
          updateSlotLoading(slot, false);
        }
        return;
      }

      const promise = fetchComparisonAdditive(slug);
      detailPromisesRef.current.set(slug, promise);
      updateSlotLoading(slot, true);
      updateSlotError(slot, null);

      try {
        const additive = await promise;
        if (additive) {
          setAdditiveMap((prev) => {
            const existing = prev.get(slug);
            if (existing === additive) {
              return prev;
            }
            const next = new Map(prev);
            next.set(slug, additive);
            return next;
          });
          updateSlotError(slot, null);
        } else {
          updateSlotError(slot, 'Additive not found.');
        }
      } catch (error) {
        console.error('Unable to load additive details', error);
        updateSlotError(slot, 'Unable to load additive details.');
      } finally {
        detailPromisesRef.current.delete(slug);
        updateSlotLoading(slot, false);
      }
    },
    [updateSlotError, updateSlotLoading],
  );

  useEffect(() => {
    if (selection.left) {
      void loadAdditiveDetail('left', selection.left);
    } else {
      updateSlotError('left', null);
      updateSlotLoading('left', false);
    }
  }, [loadAdditiveDetail, selection.left, updateSlotError, updateSlotLoading]);

  useEffect(() => {
    if (selection.right) {
      void loadAdditiveDetail('right', selection.right);
    } else {
      updateSlotError('right', null);
      updateSlotLoading('right', false);
    }
  }, [loadAdditiveDetail, selection.right, updateSlotError, updateSlotLoading]);

  useEffect(() => {
    const leftSlug = selection.left;
    const rightSlug = selection.right;
    const nextPath = leftSlug && rightSlug ? `/compare/${leftSlug}-vs-${rightSlug}` : '/compare';

    if (pathname !== nextPath) {
      router.replace(nextPath);
    }
  }, [pathname, router, selection.left, selection.right]);

  const searchItemMap = useMemo(() => new Map(searchItems.map((item) => [item.slug, item])), [searchItems]);

  const leftAdditive = selection.left ? additiveMap.get(selection.left) ?? null : null;
  const rightAdditive = selection.right ? additiveMap.get(selection.right) ?? null : null;

  const leftSearchItem = selection.left ? searchItemMap.get(selection.left) ?? null : null;
  const rightSearchItem = selection.right ? searchItemMap.get(selection.right) ?? null : null;

  const leftDisplayName = leftAdditive
    ? formatAdditiveDisplayName(leftAdditive.eNumber, leftAdditive.title)
    : leftSearchItem
    ? formatAdditiveDisplayName(leftSearchItem.eNumber, leftSearchItem.title)
    : null;

  const rightDisplayName = rightAdditive
    ? formatAdditiveDisplayName(rightAdditive.eNumber, rightAdditive.title)
    : rightSearchItem
    ? formatAdditiveDisplayName(rightSearchItem.eNumber, rightSearchItem.title)
    : null;

  const leftMetrics = leftAdditive?.searchHistory?.metrics ?? null;
  const rightMetrics = rightAdditive?.searchHistory?.metrics ?? null;

  const searchHistoryDomain = useMemo<SearchHistoryDomain | null>(() => {
    const metricsSets = [leftMetrics, rightMetrics].filter(
      (metrics): metrics is Array<{ date: string; volume: number }> => Array.isArray(metrics) && metrics.length > 0,
    );

    if (metricsSets.length === 0) {
      return null;
    }

    let maxVolume = 0;

    metricsSets.forEach((metrics) => {
      metrics.forEach((point) => {
        if (typeof point.volume === 'number' && Number.isFinite(point.volume)) {
          maxVolume = Math.max(maxVolume, point.volume);
        }
      });
    });

    const paddedMax = maxVolume > 0 ? maxVolume * 1.05 : 1;

    return {
      min: 0,
      max: paddedMax,
    };
  }, [leftMetrics, rightMetrics]);

  const renderProductMetrics = useCallback(
    (additive: ComparisonAdditive | null) => {
      if (!additive) {
        return null;
      }

      const productCount = typeof additive.productCount === 'number' ? additive.productCount : null;
      const awarenessScore = awarenessScores[additive.slug] ?? null;

      if (productCount === null) {
        return (
          <Stack spacing={1}>
            <Typography variant="body2" color="text.secondary">
              Product data is not available.
            </Typography>
            {awarenessScore ? (
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
              >
                <Box component="span" sx={{ fontWeight: 600 }}>
                  Awareness:
                </Box>
                <AwarenessScoreChip score={awarenessScore} />
              </Typography>
            ) : null}
          </Stack>
        );
      }

      const productLabel = formatProductCount(productCount);

      return (
        <Stack spacing={1}>
          <Typography variant="body1" color="text.secondary" sx={{ fontVariantNumeric: 'tabular-nums' }}>
            Found in <Box component="span" sx={{ fontWeight: 600 }}>{productLabel} products</Box>
          </Typography>
          {awarenessScore ? (
            <Typography
              variant="body1"
              color="text.secondary"
              sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
            >
              <Box component="span" sx={{ fontWeight: 600 }}>
                Awareness:
              </Box>
              <AwarenessScoreChip score={awarenessScore} />
            </Typography>
          ) : null}
        </Stack>
      );
    },
    [awarenessScores],
  );

  const overviewSummary = (additive: ComparisonAdditive | null) => {
    if (!additive) {
      return null;
    }

    const summary = extractArticleSummary(additive.article) ?? additive.description;

    return (
      <Stack spacing={1.5}>
        <Typography
          component={Link}
          href={`/${additive.slug}`}
          variant="h4"
          sx={{
            color: 'text.primary',
            textDecoration: 'none',
            '&:hover': { textDecoration: 'underline' },
          }}
        >
          {formatAdditiveDisplayName(additive.eNumber, additive.title)}
        </Typography>
        {summary ? (
          <Typography variant="body1" color="text.secondary" whiteSpace="pre-line">
            {summary}
          </Typography>
        ) : null}
      </Stack>
    );
  };

  const searchLoading = !hasLoadedSearchData && isSearchLoading;

  const leftValue = leftSearchItem ?? null;
  const rightValue = rightSearchItem ?? null;

  const handleLookupInputChange = useCallback(
    (value: string) => {
      if (!hasLoadedSearchData && value.trim().length > 0) {
        ensureSearchData();
      }
    },
    [ensureSearchData, hasLoadedSearchData],
  );

  const renderSectionForSlot = useCallback(
    (slot: 'left' | 'right', render: (additive: ComparisonAdditive | null) => ReactNode) => {
      const slug = slot === 'left' ? selection.left : selection.right;
      const additive = slot === 'left' ? leftAdditive : rightAdditive;
      const isLoading = slot === 'left' ? loadingSlots.left : loadingSlots.right;
      const error = slot === 'left' ? slotErrors.left : slotErrors.right;

      if (!slug) {
        return render(null);
      }

      if (isLoading && !additive) {
        return (
          <Typography variant="body2" color="text.secondary">
            Loading additive…
          </Typography>
        );
      }

      if (!additive) {
        return (
          <Typography variant="body2" color={error ? 'error' : 'text.secondary'}>
            {error ?? 'Additive details are unavailable.'}
          </Typography>
        );
      }

      return render(additive);
    },
    [leftAdditive, loadingSlots.left, rightAdditive, loadingSlots.right, selection.left, selection.right, slotErrors.left, slotErrors.right],
  );

  const sectionItems = [
    {
      key: 'overview',
      label: 'Overview',
      render: overviewSummary,
    },
    {
      key: 'synonyms',
      label: 'Synonyms',
      render: renderSynonymContent,
    },
    {
      key: 'functions',
      label: 'Functions',
      render: renderFunctionContent,
    },
    {
      key: 'origin',
      label: 'Origin',
      render: renderOriginContent,
    },
    {
      key: 'products',
      label: 'Products',
      render: renderProductMetrics,
    },
    {
      key: 'search-metrics',
      label: 'Search rank & volume',
      render: renderSearchMetrics,
    },
    {
      key: 'search-history',
      label: 'Search volume over time',
      render: (additive: ComparisonAdditive | null) => renderSearchHistory(additive, searchHistoryDomain),
    },
    {
      key: 'detail-link',
      label: null,
      render: renderDetailLink,
    },
    {
      key: 'article',
      label: 'Article preview',
      render: renderArticlePreview,
    },
  ];

  return (
    <Stack spacing={4}>
      <Typography component="h1" variant="h1">
        {leftDisplayName && rightDisplayName
          ? `Comparing ${leftDisplayName} vs ${rightDisplayName}`
          : 'Compare additives'}
      </Typography>

      <Box
        sx={{
          display: 'grid',
          gap: { xs: 2, md: 3 },
          gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' },
        }}
        onPointerEnter={ensureSearchData}
      >
        <AdditiveLookup
          additives={searchItems}
          value={leftValue}
          onChange={(value) => setSelection((prev) => ({ ...prev, left: value?.slug ?? null }))}
          label="Select first additive"
          placeholder="Type additive to compare"
          disabledSlugs={selection.right ? [selection.right] : undefined}
          loading={searchLoading}
          onInputValueChange={handleLookupInputChange}
          textFieldProps={{
            onFocus: ensureSearchData,
            onPointerEnter: ensureSearchData,
          }}
        />
        <AdditiveLookup
          additives={searchItems}
          value={rightValue}
          onChange={(value) => setSelection((prev) => ({ ...prev, right: value?.slug ?? null }))}
          label="Select second additive"
          placeholder="Type additive to compare"
          disabledSlugs={selection.left ? [selection.left] : undefined}
          loading={searchLoading}
          onInputValueChange={handleLookupInputChange}
          textFieldProps={{
            onFocus: ensureSearchData,
            onPointerEnter: ensureSearchData,
          }}
        />
      </Box>

      <Box
        sx={{
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 3,
          backgroundColor: 'background.paper',
          overflow: 'hidden',
        }}
      >
        <Stack spacing={0}>
          {sectionItems.map((section, index) => (
            <Box
              key={section.key}
              sx={{
                display: 'grid',
                gap: { xs: 2, sm: 3 },
                columnGap: { md: 0 },
                gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' },
                alignItems: 'flex-start',
                px: { xs: 2, sm: 3, md: 4 },
                py: { xs: 2.5, sm: 3 },
                borderTop: index === 0 ? 'none' : '1px solid',
                borderColor: 'divider',
                backgroundColor: index % 2 === 0 ? 'grey.50' : 'background.paper',
              }}
            >
              {section.label ? (
                <Typography
                  variant="subtitle2"
                  color="text.secondary"
                  sx={{
                    gridColumn: '1 / -1',
                    textTransform: 'uppercase',
                    letterSpacing: 1,
                  }}
                >
                  {section.label}
                </Typography>
              ) : null}
              <Box
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 1.5,
                  pr: { md: 4 },
                }}
              >
                {renderSectionForSlot('left', section.render)}
              </Box>
              <Box
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 1.5,
                  borderLeft: { md: '1px solid' },
                  borderColor: { md: 'divider' },
                  pl: { md: 4 },
                }}
              >
                {renderSectionForSlot('right', section.render)}
              </Box>
            </Box>
          ))}
        </Stack>
      </Box>
    </Stack>
  );
}
