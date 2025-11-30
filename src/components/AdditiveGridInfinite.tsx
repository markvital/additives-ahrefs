'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Box, Button, CircularProgress, Typography } from '@mui/material';

import type { AdditiveGridItem, AdditiveSortMode } from '../lib/additives';
import { AdditiveGrid } from './AdditiveGrid';
import type { AwarenessScoreResult } from '../lib/awareness';

type AdditiveGridFilter =
  | {
      type: 'function';
      slug: string;
    }
  | {
      type: 'origin';
      slug: string;
    };

interface AdditiveGridInfiniteProps {
  initialItems: AdditiveGridItem[];
  totalCount: number;
  initialSortMode: AdditiveSortMode;
  initialShowClasses: boolean;
  chunkSize?: number;
  filter?: AdditiveGridFilter | null;
  awarenessScores?: Map<string, AwarenessScoreResult>;
}

const DEFAULT_CHUNK_SIZE = 100;

export function AdditiveGridInfinite({
  initialItems,
  totalCount,
  initialSortMode,
  initialShowClasses,
  chunkSize = DEFAULT_CHUNK_SIZE,
  filter = null,
  awarenessScores,
}: AdditiveGridInfiniteProps) {
  const searchParams = useSearchParams();
  const sortParam = searchParams.get('sort');
  const classesParam = searchParams.get('classes');
  const filterKey = filter ? `${filter.type}:${filter.slug}` : 'none';
  const [items, setItems] = useState<AdditiveGridItem[]>(initialItems);
  const [count, setCount] = useState(totalCount);
  const [offset, setOffset] = useState(initialItems.length);
  const [hasMore, setHasMore] = useState(initialItems.length < totalCount);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const isFetchingRef = useRef(false);
  const safeChunkSize = Number.isFinite(chunkSize) && chunkSize > 0 ? Math.floor(chunkSize) : DEFAULT_CHUNK_SIZE;
  const parseSortMode = useCallback(
    (value: string | null): AdditiveSortMode => {
      const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';

      if (normalized === 'products' || normalized === 'product-count') {
        return 'product-count';
      }

      if (normalized === 'search-rank' || normalized === 'rank') {
        return 'search-rank';
      }

      if (normalized === 'awareness' || normalized === 'awareness-score') {
        return 'awareness';
      }

      if (normalized === 'e-number' || normalized === 'enumber' || normalized === 'e') {
        return 'e-number';
      }

      return initialSortMode;
    },
    [initialSortMode],
  );

  const parseShowClasses = useCallback((value: string | null): boolean => {
    const raw = typeof value === 'string' ? value.trim().toLowerCase() : '';

    if (!raw) {
      return initialShowClasses;
    }

    return raw === '1' || raw === 'true' || raw === 'yes' || raw === 'show';
  }, [initialShowClasses]);

  const sortMode = useMemo(() => parseSortMode(sortParam), [parseSortMode, sortParam]);
  const showClasses = useMemo(() => parseShowClasses(classesParam), [classesParam, parseShowClasses]);

  const fetchBatch = useCallback(
    async (requestedOffset: number, signal?: AbortSignal) => {
      const params = new URLSearchParams();
      params.set('offset', Number.isFinite(requestedOffset) && requestedOffset > 0 ? `${requestedOffset}` : '0');
      params.set('sort', sortMode);

      if (showClasses) {
        params.set('classes', '1');
      }

      if (filter) {
        params.set('filterType', filter.type);
        params.set('filterSlug', filter.slug);
      }

      const response = await fetch(`/api/additives?${params.toString()}`, {
        headers: { Accept: 'application/json' },
        signal,
      });

      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
      }

      return (await response.json()) as {
        items: AdditiveGridItem[];
        nextOffset: number | null;
        totalCount: number;
      };
    },
    [filter, showClasses, sortMode],
  );

  useEffect(() => {
    const currentConfigKey = `${sortMode}|${showClasses}|${filterKey}`;
    const initialConfigKey = `${initialSortMode}|${initialShowClasses}|${filterKey}`;

    isFetchingRef.current = false;

    if (currentConfigKey === initialConfigKey) {
      setItems(initialItems);
      setCount(totalCount);
      setOffset(initialItems.length);
      setHasMore(initialItems.length < totalCount);
      setError(null);
      return;
    }

    const abortController = new AbortController();

    const loadInitial = async () => {
      setIsRefreshing(true);
      try {
        const result = await fetchBatch(0, abortController.signal);
        const nextCount = typeof result.totalCount === 'number' ? result.totalCount : 0;
        const nextOffset =
          typeof result.nextOffset === 'number'
            ? result.nextOffset
            : Math.min(nextCount, result.items.length);

        setItems(Array.isArray(result.items) ? result.items : []);
        setCount(nextCount);
        setOffset(nextOffset);
        setHasMore(nextOffset < nextCount);
        setError(null);
      } catch (loadError) {
        if ((loadError as Error).name !== 'AbortError') {
          console.error('Failed to load additives chunk', loadError);
          setError('Unable to load additives. Try again?');
        }
      } finally {
        isFetchingRef.current = false;
        setIsRefreshing(false);
      }
    };

    loadInitial();

    return () => {
      abortController.abort();
    };
  }, [
    fetchBatch,
    filterKey,
    initialItems,
    initialShowClasses,
    initialSortMode,
    showClasses,
    sortMode,
    totalCount,
  ]);

  const fetchNext = useCallback(
    (force = false) => {
      if ((!force && error) || !hasMore || isFetchingRef.current || isRefreshing) {
        return;
      }

      if (force || !error) {
        setError(null);
      }

      isFetchingRef.current = true;

      fetchBatch(offset)
        .then((result) => {
          if (Array.isArray(result.items) && result.items.length > 0) {
            setItems((current) => [...current, ...result.items]);
          }

          const nextCount = typeof result.totalCount === 'number' ? result.totalCount : count;
          const nextOffset =
            typeof result.nextOffset === 'number'
              ? result.nextOffset
              : Math.min(nextCount, offset + safeChunkSize);

          setCount(nextCount);
          setOffset(nextOffset);
          setHasMore(nextOffset < nextCount);
          setError(null);
        })
        .catch((loadError) => {
          console.error('Failed to load additives chunk', loadError);
          setError('Unable to load more additives. Try again?');
        })
        .finally(() => {
          isFetchingRef.current = false;
        });
    },
    [error, hasMore, isRefreshing, fetchBatch, offset, safeChunkSize, count],
  );

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) {
      return undefined;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry?.isIntersecting) {
          fetchNext(false);
        }
      },
      { rootMargin: '200px', threshold: 0 },
    );

    observer.observe(sentinel);

    return () => {
      observer.disconnect();
    };
  }, [fetchNext]);

  const handleRetry = useCallback(() => {
    if (isFetchingRef.current) {
      return;
    }
    fetchNext(true);
  }, [fetchNext]);

  const showLoader = (hasMore && !error) || isRefreshing || isFetchingRef.current;
  const showEndLabel = !hasMore && items.length > 0;

  return (
    <Box display="flex" flexDirection="column" gap={3}>
      <AdditiveGrid items={items} sortMode={sortMode} awarenessScores={awarenessScores} />

      <Box
        ref={sentinelRef}
        display="flex"
        flexDirection="column"
        alignItems="center"
        gap={1}
        minHeight={40}
        sx={{ pb: 2 }}
      >
        {showLoader ? <CircularProgress size={24} aria-label="Loading more additives" /> : null}

        {error ? (
          <Button variant="outlined" size="small" onClick={handleRetry}>
            Retry loading additives
          </Button>
        ) : null}

        {showEndLabel ? (
          <Typography variant="body2" color="text.secondary">
            Showing {items.length} of {count} additives.
          </Typography>
        ) : null}
      </Box>
    </Box>
  );
}
