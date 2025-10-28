import type { Metadata } from 'next';

import { AdditiveComparison } from '../../../components/AdditiveComparison';
import type { Additive } from '../../../lib/additives';
import { getAdditives, getAdditiveBySlug, getAwarenessScores } from '../../../lib/additives';
import { formatAdditiveDisplayName } from '../../../lib/additive-format';
import { getSearchHistory } from '../../../lib/search-history';

interface ComparePageProps {
  params: Promise<{ slug?: string[] }>;
}

interface ComparisonAdditive extends Additive {
  searchHistory: ReturnType<typeof getSearchHistory>;
}

const DEFAULT_DESCRIPTION =
  'Compare food additives side by side to review their synonyms, functions, origins, and search trends.';

const parseComparisonParam = (segment?: string | null): [string | null, string | null] => {
  if (!segment) {
    return [null, null];
  }

  const delimiter = '-vs-';
  const delimiterIndex = segment.indexOf(delimiter);

  if (delimiterIndex <= 0) {
    return [null, null];
  }

  const first = segment.slice(0, delimiterIndex);
  const second = segment.slice(delimiterIndex + delimiter.length);

  if (!first || !second) {
    return [null, null];
  }

  return [first, second];
};

export async function generateMetadata({ params }: ComparePageProps): Promise<Metadata> {
  const { slug } = await params;
  const pairSegment = Array.isArray(slug) ? slug[0] : undefined;
  const [firstSlug, secondSlug] = parseComparisonParam(pairSegment);

  if (firstSlug && secondSlug) {
    const firstAdditive = getAdditiveBySlug(firstSlug);
    const secondAdditive = getAdditiveBySlug(secondSlug);

    if (firstAdditive && secondAdditive) {
      const firstName = formatAdditiveDisplayName(firstAdditive.eNumber, firstAdditive.title);
      const secondName = formatAdditiveDisplayName(secondAdditive.eNumber, secondAdditive.title);
      const canonical = `/compare/${firstAdditive.slug}-vs-${secondAdditive.slug}`;

      return {
        title: `Compare ${firstName} vs ${secondName}`,
        description: `Side-by-side comparison of ${firstName} and ${secondName}, including synonyms, origin, search interest, and article highlights.`,
        alternates: {
          canonical,
        },
      };
    }
  }

  return {
    title: 'Compare food additives',
    description: DEFAULT_DESCRIPTION,
    alternates: {
      canonical: '/compare',
    },
  };
}

export default async function ComparePage({ params }: ComparePageProps) {
  const { slug } = await params;
  const pairSegment = Array.isArray(slug) ? slug[0] : undefined;
  const [requestedLeft, requestedRight] = parseComparisonParam(pairSegment);

  const awarenessResult = getAwarenessScores();
  const awarenessScores = Object.fromEntries(awarenessResult.scores.entries());

  const additives = getAdditives().map<ComparisonAdditive>((additive) => ({
    ...additive,
    searchHistory: getSearchHistory(additive.slug),
  }));

  const additiveMap = new Map(additives.map((item) => [item.slug, item]));

  const initialSelection: [string | null, string | null] = [
    requestedLeft && additiveMap.has(requestedLeft) ? requestedLeft : null,
    requestedRight && additiveMap.has(requestedRight) ? requestedRight : null,
  ];

  return (
    <AdditiveComparison
      additives={additives}
      initialSelection={initialSelection}
      awarenessScores={awarenessScores}
    />
  );
}
