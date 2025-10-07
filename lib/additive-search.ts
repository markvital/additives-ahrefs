import type { Additive } from './additives';

export interface HighlightRange {
  start: number;
  end: number;
}

export interface AdditiveSearchMatch<TAdditive extends Additive = Additive> {
  additive: TAdditive;
  matches: {
    eNumber: HighlightRange[];
    title: HighlightRange[];
    synonyms: SynonymMatch[];
  };
  priority: number;
  index: number;
}

export interface SynonymMatch {
  value: string;
  ranges: HighlightRange[];
  index: number;
}

const findMatches = (source: string, query: string): HighlightRange[] => {
  const normalizedSource = source.toLowerCase();
  const normalizedQuery = query.toLowerCase();

  if (!normalizedQuery || !normalizedSource.includes(normalizedQuery)) {
    return [];
  }

  const ranges: HighlightRange[] = [];
  let searchIndex = 0;

  while (searchIndex <= normalizedSource.length) {
    const matchIndex = normalizedSource.indexOf(normalizedQuery, searchIndex);

    if (matchIndex === -1) {
      break;
    }

    ranges.push({
      start: matchIndex,
      end: matchIndex + normalizedQuery.length,
    });

    searchIndex = matchIndex + normalizedQuery.length;
  }

  return ranges;
};

const sanitize = (value: string): string => value.normalize('NFKC');

export interface SearchAdditivesOptions {
  maxResults?: number;
}

export const searchAdditives = <TAdditive extends Additive>(
  additives: TAdditive[],
  rawQuery: string,
  { maxResults }: SearchAdditivesOptions = {},
): AdditiveSearchMatch<TAdditive>[] => {
  const trimmed = rawQuery.trim();

  if (!trimmed) {
    return [];
  }

  const query = sanitize(trimmed).toLowerCase();
  const matches: AdditiveSearchMatch<TAdditive>[] = [];

  additives.forEach((additive, index) => {
    const eNumber = sanitize(additive.eNumber ?? '');
    const title = sanitize(additive.title ?? '');
    const synonyms = Array.isArray(additive.synonyms) ? additive.synonyms : [];

    const eNumberMatches = findMatches(eNumber, query);
    const titleMatches = findMatches(title, query);

    const synonymMatches: SynonymMatch[] = [];

    for (let synonymIndex = 0; synonymIndex < synonyms.length; synonymIndex += 1) {
      const synonym = sanitize(String(synonyms[synonymIndex] ?? ''));
      const synonymRanges = findMatches(synonym, query);

      if (synonymRanges.length > 0) {
        synonymMatches.push({
          value: synonym,
          ranges: synonymRanges,
          index: synonymIndex,
        });
      }
    }

    if (eNumberMatches.length === 0 && titleMatches.length === 0 && synonymMatches.length === 0) {
      return;
    }

    const priority = eNumberMatches.length > 0 ? 0 : titleMatches.length > 0 ? 1 : 2;

    matches.push({
      additive,
      matches: {
        eNumber: eNumberMatches,
        title: titleMatches,
        synonyms: synonymMatches,
      },
      priority,
      index,
    });
  });

  matches.sort((a, b) => {
    if (a.priority !== b.priority) {
      return a.priority - b.priority;
    }

    const aRank = typeof a.additive.searchRank === 'number' ? a.additive.searchRank : null;
    const bRank = typeof b.additive.searchRank === 'number' ? b.additive.searchRank : null;

    if (aRank !== null && bRank !== null && aRank !== bRank) {
      return aRank - bRank;
    }

    if (aRank !== null) {
      return -1;
    }

    if (bRank !== null) {
      return 1;
    }

    if (a.index !== b.index) {
      return a.index - b.index;
    }

    return a.additive.title.localeCompare(b.additive.title);
  });

  if (typeof maxResults === 'number' && Number.isFinite(maxResults) && maxResults > 0) {
    return matches.slice(0, maxResults);
  }

  return matches;
};
