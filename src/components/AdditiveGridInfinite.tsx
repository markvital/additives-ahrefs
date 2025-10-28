'use client';

import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import { Box, Button, CircularProgress, Typography } from '@mui/material';

import type { AdditiveGridItem, AdditiveSortMode } from '../lib/additives';
import { AdditiveGrid } from './AdditiveGrid';
import { loadAdditivesBatch } from '../app/actions/additives';
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
  sortMode: AdditiveSortMode;
  showClasses: boolean;
  chunkSize?: number;
  filter?: AdditiveGridFilter | null;
  awarenessScores?: Map<string, AwarenessScoreResult>;
}

const DEFAULT_CHUNK_SIZE = 50;

export function AdditiveGridInfinite({
  initialItems,
  totalCount,
  sortMode,
  showClasses,
  chunkSize = DEFAULT_CHUNK_SIZE,
  filter = null,
  awarenessScores,
}: AdditiveGridInfiniteProps) {
  const [items, setItems] = useState<AdditiveGridItem[]>(initialItems);
  const [count, setCount] = useState(totalCount);
  const [offset, setOffset] = useState(initialItems.length);
  const [hasMore, setHasMore] = useState(initialItems.length < totalCount);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const isFetchingRef = useRef(false);
  const safeChunkSize = Number.isFinite(chunkSize) && chunkSize > 0 ? Math.floor(chunkSize) : DEFAULT_CHUNK_SIZE;
  const filterKey = filter ? `${filter.type}:${filter.slug}` : 'none';

  useEffect(() => {
    setItems(initialItems);
    setCount(totalCount);
    setOffset(initialItems.length);
    setHasMore(initialItems.length < totalCount);
    setError(null);
    isFetchingRef.current = false;
  }, [initialItems, totalCount, sortMode, showClasses, filterKey]);

  const fetchNext = useCallback(
    (force = false) => {
      if ((!force && error) || !hasMore || isFetchingRef.current) {
        return;
      }

      if (force || !error) {
        setError(null);
      }

      isFetchingRef.current = true;

      startTransition(async () => {
        try {
          const result = await loadAdditivesBatch({
            offset,
            limit: safeChunkSize,
            sortMode,
            showClasses,
            filter,
          });

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
        } catch (loadError) {
          console.error('Failed to load additives chunk', loadError);
          setError('Unable to load more additives. Try again?');
          isFetchingRef.current = false;
          return;
        }

        isFetchingRef.current = false;
      });
    },
    [count, error, filter, hasMore, offset, safeChunkSize, showClasses, sortMode],
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

  const showLoader = (hasMore && !error) || isPending || isFetchingRef.current;
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
