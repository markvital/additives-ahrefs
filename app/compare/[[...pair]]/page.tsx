import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import {
  CompareView,
  type ComparisonAdditiveData,
  type ComparisonOption,
} from '../../../components/CompareView';
import { getAdditives } from '../../../lib/additives';
import { getSearchHistory } from '../../../lib/search-history';
import { extractArticleBody, extractArticleSummary, splitArticlePreview } from '../../../lib/article';
import { formatAdditiveDisplayName, formatOriginLabel } from '../../../lib/additive-format';
import { getCountryLabel } from '../../../lib/format';

interface ComparePageParams {
  pair?: string[];
}

interface ComparePageProps {
  params: Promise<ComparePageParams>;
}

const baseAdditives = getAdditives();

export async function generateStaticParams(): Promise<ComparePageParams[]> {
  return [{ pair: [] }];
}

const comparisonAdditives: ComparisonAdditiveData[] = baseAdditives.map((additive) => {
  const displayName = formatAdditiveDisplayName(additive.eNumber, additive.title);
  const articleSummary = extractArticleSummary(additive.article);
  const articleBody = extractArticleBody(additive.article);
  const { preview: articlePreview, remainder: articleRemainder } = splitArticlePreview(articleBody);
  const searchHistory = getSearchHistory(additive.slug);
  const searchKeyword = searchHistory?.keyword?.trim() || null;
  const rawCountryCode = searchHistory?.country?.trim() || '';
  const searchCountryCode = rawCountryCode ? rawCountryCode.toUpperCase() : null;
  const searchCountryLabel = searchCountryCode ? getCountryLabel(searchCountryCode) : null;
  const searchMetrics = Array.isArray(searchHistory?.metrics)
    ? searchHistory.metrics.map((metric) => ({
        date: metric.date,
        volume: metric.volume,
      }))
    : [];

  const originValues = additive.origin
    .map((origin) => formatOriginLabel(origin))
    .filter((value, index, list) => value.length > 0 && list.indexOf(value) === index);

  const synonymValues = additive.synonyms.filter(
    (value, index, list) => value.trim().length > 0 && list.indexOf(value) === index,
  );

  const functionValues = additive.functions.filter(
    (value, index, list) => value.trim().length > 0 && list.indexOf(value) === index,
  );

  return {
    slug: additive.slug,
    displayName,
    eNumber: additive.eNumber,
    title: additive.title,
    synonyms: synonymValues,
    functions: functionValues,
    origin: originValues,
    description: additive.description,
    articleSummary,
    articlePreview,
    articleRemainder,
    searchRank: additive.searchRank,
    searchVolume: additive.searchVolume,
    searchKeyword,
    searchCountryCode,
    searchCountryLabel,
    searchMetrics,
  } satisfies ComparisonAdditiveData;
});

const additiveRecord: Record<string, ComparisonAdditiveData> = comparisonAdditives.reduce(
  (acc, additive) => {
    acc[additive.slug] = additive;
    return acc;
  },
  {} as Record<string, ComparisonAdditiveData>,
);

const comparisonOptions: ComparisonOption[] = comparisonAdditives
  .map((additive) => ({
    slug: additive.slug,
    label: additive.displayName,
    eNumber: additive.eNumber,
    title: additive.title,
    synonyms: additive.synonyms,
  }))
  .sort((a, b) => a.label.localeCompare(b.label));

const parsePairValue = (value: string | undefined): string[] => {
  if (!value) {
    return [];
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return [];
  }

  const segments = trimmed.split('-vs-');

  if (segments.length !== 2) {
    return [];
  }

  const [first, second] = segments.map((segment) => segment.trim());

  if (!first || !second) {
    return [];
  }

  return [first, second];
};

const getSelectionFromParams = (pair?: string[]): string[] => {
  if (!pair || pair.length === 0) {
    return [];
  }

  if (pair.length > 1) {
    return [];
  }

  return parsePairValue(pair[0]);
};

const ensureValidSelection = (selection: string[]) => {
  if (selection.length === 0) {
    return;
  }

  if (selection.length !== 2) {
    notFound();
  }

  const [first, second] = selection;
  const firstExists = !!additiveRecord[first];
  const secondExists = !!additiveRecord[second];

  if (!firstExists || !secondExists) {
    notFound();
  }
};

export async function generateMetadata({ params }: ComparePageProps): Promise<Metadata> {
  const { pair } = await params;
  const selection = getSelectionFromParams(pair);

  if (selection.length === 2) {
    const [first, second] = selection;
    const firstAdditive = additiveRecord[first];
    const secondAdditive = additiveRecord[second];

    if (!firstAdditive || !secondAdditive) {
      return {
        title: 'Compare food additives',
      };
    }

    const title = `Comparing ${firstAdditive.displayName} vs ${secondAdditive.displayName}`;

    return {
      title,
      description: `Side-by-side comparison of ${firstAdditive.displayName} and ${secondAdditive.displayName}, covering synonyms, functions, origins, and search interest metrics.`,
      alternates: {
        canonical: `/compare/${firstAdditive.slug}-vs-${secondAdditive.slug}`,
      },
    };
  }

  return {
    title: 'Compare food additives',
    description:
      'Choose two food additives to compare their synonyms, functions, origins, and search popularity side by side.',
    alternates: {
      canonical: '/compare',
    },
  };
}

export default async function ComparePage({ params }: ComparePageProps) {
  const { pair } = await params;
  const selection = getSelectionFromParams(pair);

  ensureValidSelection(selection);

  return <CompareView options={comparisonOptions} additives={additiveRecord} initialSelection={selection} />;
}
