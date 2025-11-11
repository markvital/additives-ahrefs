import type { Metadata } from 'next';

import { AdditiveComparison, type ComparisonAdditive } from '../../../components/AdditiveComparison';
import { getAdditiveBySlug, getAwarenessScores } from '../../../lib/additives';
import { formatAdditiveDisplayName } from '../../../lib/additive-format';
import { getSearchHistory } from '../../../lib/search-history';
interface ComparePageProps {
  params: Promise<{ slug?: string[] }>;
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
      const firstImageUrl = `/card-previews/${firstAdditive.slug}.jpg`;
      const secondImageUrl = `/card-previews/${secondAdditive.slug}.jpg`;

      return {
        title: `Compare ${firstName} vs ${secondName}`,
        description: `Side-by-side comparison of ${firstName} and ${secondName}, including synonyms, origin, search interest, and article highlights.`,
        alternates: {
          canonical,
        },
        openGraph: {
          title: `Compare ${firstName} vs ${secondName}`,
          description: `Side-by-side comparison of ${firstName} and ${secondName}, including synonyms, origin, search interest, and article highlights.`,
          url: canonical,
          type: 'article',
          images: [
            {
              url: firstImageUrl,
              width: 1200,
              height: 630,
              alt: firstName,
            },
            {
              url: secondImageUrl,
              width: 1200,
              height: 630,
              alt: secondName,
            },
          ],
        },
        twitter: {
          card: 'summary_large_image',
          title: `Compare ${firstName} vs ${secondName}`,
          description: `Side-by-side comparison of ${firstName} and ${secondName}, including synonyms, origin, search interest, and article highlights.`,
          images: [firstImageUrl, secondImageUrl],
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

  const requestedSlugs = [requestedLeft, requestedRight].filter(
    (value): value is string => typeof value === 'string' && value.length > 0,
  );

  const uniqueRequestedSlugs = Array.from(new Set(requestedSlugs));

  const initialAdditivesEntries = uniqueRequestedSlugs
    .map<[string, ComparisonAdditive] | null>((slugValue) => {
      const additive = getAdditiveBySlug(slugValue);

      if (!additive) {
        return null;
      }

      return [
        slugValue,
        {
          ...additive,
          searchHistory: getSearchHistory(slugValue),
        },
      ];
    })
    .filter((entry): entry is [string, ComparisonAdditive] => Array.isArray(entry));

  const initialAdditives: Record<string, ComparisonAdditive> = Object.fromEntries(initialAdditivesEntries);

  const initialSelection: [string | null, string | null] = [
    requestedLeft && initialAdditives[requestedLeft] ? requestedLeft : null,
    requestedRight && initialAdditives[requestedRight] ? requestedRight : null,
  ];

  return (
    <AdditiveComparison
      initialSelection={initialSelection}
      initialAdditives={initialAdditives}
      awarenessScores={awarenessScores}
    />
  );
}
