export type AdditiveSortMode = 'search' | 'products';

export const DEFAULT_ADDITIVE_SORT_MODE: AdditiveSortMode = 'search';

export const parseAdditiveSortMode = (value: unknown): AdditiveSortMode => {
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'products' || normalized === 'product' || normalized === 'productcount') {
      return 'products';
    }
  }

  return DEFAULT_ADDITIVE_SORT_MODE;
};

type SortableAdditive = {
  title: string;
  searchRank: number | null;
  productCount: number | null;
};

const compareByTitle = (a: SortableAdditive, b: SortableAdditive): number =>
  a.title.localeCompare(b.title);

export const sortAdditives = <T extends SortableAdditive>(
  items: readonly T[],
  mode: AdditiveSortMode,
): T[] => {
  const sorted = [...items];

  if (mode === 'products') {
    sorted.sort((a, b) => {
      const aCount = typeof a.productCount === 'number' && Number.isFinite(a.productCount)
        ? a.productCount
        : -1;
      const bCount = typeof b.productCount === 'number' && Number.isFinite(b.productCount)
        ? b.productCount
        : -1;

      if (aCount === bCount) {
        const aRank = typeof a.searchRank === 'number' ? a.searchRank : Number.POSITIVE_INFINITY;
        const bRank = typeof b.searchRank === 'number' ? b.searchRank : Number.POSITIVE_INFINITY;

        if (aRank === bRank) {
          return compareByTitle(a, b);
        }

        return aRank - bRank;
      }

      return bCount - aCount;
    });

    return sorted;
  }

  sorted.sort((a, b) => {
    const aHasRank = typeof a.searchRank === 'number';
    const bHasRank = typeof b.searchRank === 'number';

    if (aHasRank && bHasRank) {
      if (a.searchRank === b.searchRank) {
        return compareByTitle(a, b);
      }

      return (a.searchRank ?? 0) - (b.searchRank ?? 0);
    }

    if (aHasRank) {
      return -1;
    }

    if (bHasRank) {
      return 1;
    }

    return compareByTitle(a, b);
  });

  return sorted;
};
