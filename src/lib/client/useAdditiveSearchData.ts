'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  getCachedAdditiveSearchItems,
  hasAdditiveSearchDataLoaded,
  isAdditiveSearchDataLoading,
  loadAdditiveSearchItems,
} from './additive-search-data';
import type { AdditiveSearchItem } from '../additives';

interface AdditiveSearchDataState {
  additives: AdditiveSearchItem[];
  hasLoaded: boolean;
  isLoading: boolean;
  ensureLoaded: () => void;
}

export const useAdditiveSearchData = (): AdditiveSearchDataState => {
  const [additives, setAdditives] = useState<AdditiveSearchItem[]>(() => getCachedAdditiveSearchItems() ?? []);
  const [hasLoaded, setHasLoaded] = useState(() => hasAdditiveSearchDataLoaded());
  const [isLoading, setIsLoading] = useState(() => isAdditiveSearchDataLoading());

  const ensureLoaded = useCallback(() => {
    if (hasAdditiveSearchDataLoaded()) {
      const cached = getCachedAdditiveSearchItems();

      if (cached) {
        setAdditives(cached);
      }

      setHasLoaded(true);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    loadAdditiveSearchItems()
      .then((items) => {
        setAdditives(items);
        setHasLoaded(true);
      })
      .catch((error) => {
        console.error('Unable to load additives for search', error);
        setHasLoaded(false);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  useEffect(() => {
    if (hasLoaded) {
      return;
    }

    if (hasAdditiveSearchDataLoaded()) {
      const cached = getCachedAdditiveSearchItems();

      if (cached) {
        setAdditives(cached);
      }

      setHasLoaded(true);
      setIsLoading(false);
      return;
    }

    if (!isAdditiveSearchDataLoading()) {
      return;
    }

    setIsLoading(true);
    loadAdditiveSearchItems()
      .then((items) => {
        setAdditives(items);
        setHasLoaded(true);
      })
      .catch((error) => {
        console.error('Unable to load additives for search', error);
        setHasLoaded(false);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [hasLoaded]);

  return useMemo(
    () => ({
      additives,
      hasLoaded,
      isLoading,
      ensureLoaded,
    }),
    [additives, ensureLoaded, hasLoaded, isLoading],
  );
};

