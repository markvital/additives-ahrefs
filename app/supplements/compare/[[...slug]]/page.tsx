import type { Metadata } from 'next';

import { AdditiveComparison } from '../../../../components/AdditiveComparison';
import { formatAdditiveDisplayName } from '../../../../lib/additive-format';
import { getSearchHistory } from '../../../../lib/search-history';
import { getSupplementAdditiveBySlug, getSupplementAdditives } from '../../../../lib/supplement-additives';

interface ComparePageProps {
  params: Promise<{ slug?: string[] }>;
}

const DEFAULT_DESCRIPTION =
  'Compare supplement-focused additives side by side to evaluate their synonyms, functions, and search interest.';

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
    const firstAdditive = getSupplementAdditiveBySlug(firstSlug);
    const secondAdditive = getSupplementAdditiveBySlug(secondSlug);

    if (firstAdditive && secondAdditive) {
      const firstName = formatAdditiveDisplayName(firstAdditive.eNumber, firstAdditive.title);
      const secondName = formatAdditiveDisplayName(secondAdditive.eNumber, secondAdditive.title);
      const canonical = `/supplements/compare/${firstAdditive.slug}-vs-${secondAdditive.slug}`;

      return {
        title: `Compare ${firstName} vs ${secondName}`,
        description: `Side-by-side comparison of ${firstName} and ${secondName} for supplement applications, including origins, search demand, and supporting content.`,
        alternates: {
          canonical,
        },
      };
    }
  }

  return {
    title: 'Compare supplement additives',
    description: DEFAULT_DESCRIPTION,
    alternates: {
      canonical: '/supplements/compare',
    },
  };
}

export default async function SupplementComparePage({ params }: ComparePageProps) {
  const { slug } = await params;
  const pairSegment = Array.isArray(slug) ? slug[0] : undefined;
  const [requestedLeft, requestedRight] = parseComparisonParam(pairSegment);

  const additives = getSupplementAdditives().map((additive) => ({
    ...additive,
    searchHistory: getSearchHistory(additive.slug),
  }));

  const additiveMap = new Map(additives.map((item) => [item.slug, item]));

  const initialSelection: [string | null, string | null] = [
    requestedLeft && additiveMap.has(requestedLeft) ? requestedLeft : null,
    requestedRight && additiveMap.has(requestedRight) ? requestedRight : null,
  ];

  return <AdditiveComparison additives={additives} initialSelection={initialSelection} />;
}
