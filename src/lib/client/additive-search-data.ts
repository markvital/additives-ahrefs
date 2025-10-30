'use client';

import type { AdditiveSearchItem } from '../additives';

interface SearchAdditivesResponse {
  additives?: AdditiveSearchItem[];
}

let cachedItems: AdditiveSearchItem[] | null = null;
let inFlightPromise: Promise<AdditiveSearchItem[]> | null = null;

const normaliseSearchItems = (
  items: AdditiveSearchItem[] | undefined,
): AdditiveSearchItem[] => {
  if (!Array.isArray(items)) {
    return [];
  }

  return items.map((item) => ({
    slug: item.slug,
    title: item.title,
    eNumber: item.eNumber,
    synonyms: Array.isArray(item.synonyms)
      ? item.synonyms.filter((value) => typeof value === 'string')
      : [],
    searchRank:
      typeof item.searchRank === 'number' && Number.isFinite(item.searchRank)
        ? item.searchRank
        : null,
  }));
};

const fetchSearchItems = async (): Promise<AdditiveSearchItem[]> => {
  const response = await fetch('/api/additives/search', {
    credentials: 'same-origin',
  });

  if (!response.ok) {
    throw new Error(`Failed to load additive search data: ${response.status}`);
  }

  const payload = (await response.json()) as SearchAdditivesResponse;
  const items = normaliseSearchItems(payload.additives);
  cachedItems = items;
  return items;
};

export const getCachedAdditiveSearchItems = (): AdditiveSearchItem[] | null => cachedItems;

export const hasAdditiveSearchDataLoaded = (): boolean => cachedItems !== null;

export const isAdditiveSearchDataLoading = (): boolean => inFlightPromise !== null && cachedItems === null;

export const loadAdditiveSearchItems = async (): Promise<AdditiveSearchItem[]> => {
  if (cachedItems) {
    return cachedItems;
  }

  if (!inFlightPromise) {
    inFlightPromise = fetchSearchItems().catch((error) => {
      cachedItems = null;
      throw error;
    });
  }

  try {
    const items = await inFlightPromise;
    return items;
  } finally {
    inFlightPromise = null;
  }
};

export const prefetchAdditiveSearchItems = (): void => {
  void loadAdditiveSearchItems().catch((error) => {
    console.error(error);
  });
};
