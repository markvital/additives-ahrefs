'use server';

import {
  type AdditiveGridItem,
  type AdditiveSortMode,
  filterAdditivesByClassVisibility,
  getAdditives,
  getAdditivesByFunctionSlug,
  getAdditivesByOriginSlug,
  mapAdditivesToGridItems,
  sortAdditivesByMode,
} from '../../lib/additives';

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 200;

interface LoadAdditivesBatchInput {
  offset: number;
  limit?: number;
  sortMode: AdditiveSortMode;
  showClasses: boolean;
  filter?: {
    type: 'function' | 'origin';
    slug: string;
  } | null;
}

export async function loadAdditivesBatch({
  offset,
  limit = DEFAULT_LIMIT,
  sortMode,
  showClasses,
  filter = null,
}: LoadAdditivesBatchInput): Promise<{
  items: AdditiveGridItem[];
  nextOffset: number | null;
  totalCount: number;
}> {
  const safeOffset = Number.isFinite(offset) && offset > 0 ? Math.floor(offset) : 0;
  const boundedLimit = Number.isFinite(limit) && limit > 0 ? Math.floor(Math.min(limit, MAX_LIMIT)) : DEFAULT_LIMIT;

  const additives =
    filter?.type === 'function'
      ? getAdditivesByFunctionSlug(filter.slug)
      : filter?.type === 'origin'
      ? getAdditivesByOriginSlug(filter.slug)
      : getAdditives();

  const filtered = filterAdditivesByClassVisibility(additives, showClasses);
  const sorted = sortAdditivesByMode(filtered, sortMode);
  const totalCount = sorted.length;

  if (safeOffset >= totalCount) {
    return {
      items: [],
      nextOffset: null,
      totalCount,
    };
  }

  const end = Math.min(totalCount, safeOffset + boundedLimit);
  const slice = sorted.slice(safeOffset, end);

  return {
    items: mapAdditivesToGridItems(slice),
    nextOffset: end < totalCount ? end : null,
    totalCount,
  };
}
