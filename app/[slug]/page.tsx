import type { Metadata } from 'next';
import NextLink from 'next/link';
import { notFound } from 'next/navigation';
import { Box, Chip, Link as MuiLink, Stack, Typography } from '@mui/material';

import { formatAdditiveDisplayName, formatOriginLabel } from '../../lib/additive-format';
import { extractArticleBody, extractArticleSummary } from '../../lib/article';
import {
  getAdditiveBySlug,
  getAdditiveSlugs,
  getFunctionSlug,
  getOriginSlug,
} from '../../lib/additives';

import { formatMonthlyVolume, formatProductCount, getCountryFlagEmoji, getCountryLabel } from '../../lib/format';
import { getSearchHistory } from '../../lib/search-history';
import { getSearchQuestions } from '../../lib/search-questions';
import { getSearchVolumeDataset } from '../../lib/search-volume';
import { SearchHistoryChart } from '../../components/SearchHistoryChart';
import { SearchKeywordShare } from '../../components/SearchKeywordShare';
import { MarkdownArticle } from '../../components/MarkdownArticle';
import { SearchQuestions } from '../../components/SearchQuestions';

interface AdditivePageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return getAdditiveSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: AdditivePageProps): Promise<Metadata> {
  const { slug } = await params;
  const additive = getAdditiveBySlug(slug);

  if (!additive) {
    return {
      title: 'Additive not found',
    };
  }

  const displayName = formatAdditiveDisplayName(additive.eNumber, additive.title);
  const articleSummary = extractArticleSummary(additive.article);
  const metaDescription = articleSummary?.replace(/\s+/g, ' ').trim() || additive.description;

  return {
    title: displayName,
    description: metaDescription,
    alternates: {
      canonical: `/${additive.slug}`,
    },
  };
}

export default async function AdditivePage({ params }: AdditivePageProps) {
  const { slug } = await params;
  const additive = getAdditiveBySlug(slug);

  if (!additive) {
    notFound();
  }

  const synonymList = additive.synonyms.filter((value, index, list) => list.indexOf(value) === index);
  const parentRelations = additive.parents;
  const childRelations = additive.children;
  const hasParents = parentRelations.length > 0;
  const hasChildren = childRelations.length > 0;
  const searchHistory = getSearchHistory(additive.slug);
  const searchHistoryKeywords = searchHistory?.keywords ?? [];
  const hasSearchHistory =
    !!searchHistory &&
    searchHistory.metrics.length > 0 &&
    (Array.isArray(searchHistoryKeywords) ? searchHistoryKeywords.length > 0 : false);
  const searchQuestions = getSearchQuestions(additive.slug);
  const questionItems = searchQuestions?.questions ?? [];
  const displayName = formatAdditiveDisplayName(additive.eNumber, additive.title);
  const searchRank = typeof additive.searchRank === 'number' ? additive.searchRank : null;
  const searchVolumeDataset = getSearchVolumeDataset(additive.slug);
  const keywordVolumeEntries = searchVolumeDataset?.keywords ?? [];
  const resolvedSearchVolume =
    typeof searchVolumeDataset?.totalSearchVolume === 'number'
      ? searchVolumeDataset.totalSearchVolume
      : typeof additive.searchVolume === 'number'
        ? additive.searchVolume
        : null;
  const searchVolume =
    typeof resolvedSearchVolume === 'number' && Number.isFinite(resolvedSearchVolume)
      ? resolvedSearchVolume
      : null;
  const normalizedKeywordShareSegments = keywordVolumeEntries
    .map((entry) => {
      const keyword = typeof entry?.keyword === 'string' ? entry.keyword.trim() : '';
      const volume =
        typeof entry?.volume === 'number' && Number.isFinite(entry.volume) ? Math.max(0, entry.volume) : 0;
      return { keyword, volume };
    })
    .filter((entry) => entry.keyword.length > 0);
  const uniqueKeywordCount = normalizedKeywordShareSegments
    .map((entry) => entry.keyword)
    .filter((keyword, index, list) => keyword.length > 0 && list.indexOf(keyword) === index).length;
  const aggregatedKeywordShareTotal =
    typeof searchVolumeDataset?.totalSearchVolume === 'number' &&
    Number.isFinite(searchVolumeDataset.totalSearchVolume) &&
    searchVolumeDataset.totalSearchVolume > 0
      ? searchVolumeDataset.totalSearchVolume
      : normalizedKeywordShareSegments.reduce((acc, entry) => acc + entry.volume, 0);
  const keywordShareTotal =
    aggregatedKeywordShareTotal > 0
      ? aggregatedKeywordShareTotal
      : typeof searchVolume === 'number' && Number.isFinite(searchVolume) && searchVolume > 0
        ? searchVolume
        : 0;
  const hasKeywordShare = normalizedKeywordShareSegments.length > 0 && keywordShareTotal > 0;
  const searchCountryCode = searchHistory?.country;
  const searchFlagEmoji = searchCountryCode ? getCountryFlagEmoji(searchCountryCode) : null;
  const searchCountryLabel =
    searchCountryCode && searchFlagEmoji ? getCountryLabel(searchCountryCode) ?? searchCountryCode.toUpperCase() : null;
  const searchCountryText =
    searchCountryLabel ?? (searchCountryCode ? searchCountryCode.trim().toUpperCase() : null);
  const productCount = typeof additive.productCount === 'number' ? additive.productCount : null;
  const productSearchUrl = `https://us.openfoodfacts.org/facets/additives/${additive.slug}`;
  const renderRelationLinks = (relations: typeof parentRelations) =>
    relations.map((relation) => {
      const label = formatAdditiveDisplayName(relation.eNumber, relation.title);

      return (
        <Box
          component="span"
          key={relation.slug}
          sx={{
            display: 'inline-block',
            '&:not(:last-of-type)::after': {
              content: '", "',
            },
          }}
        >
          <MuiLink
            component={NextLink}
            href={`/${relation.slug}`}
            underline="hover"
            sx={{ fontWeight: 500 }}
          >
            {label}
          </MuiLink>
        </Box>
      );
    });
  const articleSummary = extractArticleSummary(additive.article);
  const articleBody = extractArticleBody(additive.article);
  const originList = additive.origin.filter((value, index, list) => list.indexOf(value) === index);
  const searchHistoryKeywordNames = searchHistoryKeywords
    .map((entry) => (typeof entry?.keyword === 'string' ? entry.keyword.trim() : ''))
    .filter((keyword, index, list) => keyword.length > 0 && list.indexOf(keyword) === index);
  let searchKeywordLabel: string | null = null;
  let searchKeywordPrefix: string | null = null;
  if (searchHistoryKeywordNames.length === 1) {
    searchKeywordLabel = `“${searchHistoryKeywordNames[0]}”`;
    searchKeywordPrefix = 'for';
  } else if (searchHistoryKeywordNames.length > 1) {
    searchKeywordLabel = `${searchHistoryKeywordNames.length} keywords`;
    searchKeywordPrefix = 'across';
  } else if (displayName) {
    searchKeywordLabel = `“${displayName}”`;
    searchKeywordPrefix = 'for';
  }

  const searchInterestKeywordTrigger =
    hasKeywordShare && searchKeywordLabel
      ? (
          <SearchKeywordShare
            keywords={normalizedKeywordShareSegments}
            total={keywordShareTotal}
            label={searchKeywordLabel}
            sx={{ fontSize: 'inherit', lineHeight: 'inherit' }}
          />
        )
      : searchKeywordLabel
        ? (
            <Box component="span" sx={{ color: 'text.primary' }}>
              {searchKeywordLabel}
            </Box>
          )
        : null;

  const searchInterestCaption = (
    <>
      Interest over time
      {searchKeywordLabel && searchKeywordPrefix && searchInterestKeywordTrigger && (
        <>
          {' '}
          {searchKeywordPrefix}{' '}
          {searchInterestKeywordTrigger}
        </>
      )}
      {searchCountryText && (
        <>
          {' '}
          in {searchCountryText}
        </>
      )}
      {' for the last 10 years'}
    </>
  );

  return (
    <Box component="article" display="flex" flexDirection="column" gap={4} alignItems="center" width="100%">
      <Box sx={{ width: '100%', maxWidth: 760, display: 'flex', flexDirection: 'column', gap: 3 }}>
        <Box display="flex" flexDirection="column" gap={1.5}>
          <Typography component="h1" variant="h1">
            {displayName}
          </Typography>
          {synonymList.length > 0 && (
            <Typography variant="body1" color="text.secondary">
              <Box component="span" sx={{ fontWeight: 600 }}>
                Synonyms:
              </Box>{' '}
              {synonymList.map((synonym) => (
                <Box
                  component="span"
                  key={synonym}
                  sx={{
                    display: 'inline-block',
                    whiteSpace: 'nowrap',
                    '&:not(:last-of-type)': {
                      marginRight: 2,
                      '&::after': {
                        content: '", "',
                      },
                    },
                  }}
                >
                  {synonym}
                </Box>
              ))}
            </Typography>
          )}
          {hasParents && (
            <Typography variant="body1" color="text.secondary">
              <Box component="span" sx={{ fontWeight: 600 }}>
                Belongs to:
              </Box>{' '}
              {renderRelationLinks(parentRelations)}
            </Typography>
          )}
          {hasChildren && (
            <Typography variant="body1" color="text.secondary">
              <Box component="span" sx={{ fontWeight: 600 }}>
                Contains:
              </Box>{' '}
              {renderRelationLinks(childRelations)}
            </Typography>
          )}
          {(searchRank !== null || searchVolume !== null || searchCountryText || hasKeywordShare) && (
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 1,
                color: 'text.secondary',
                typography: 'body1',
              }}
            >
              <Box component="span" sx={{ fontWeight: 600 }}>
                Search interest:
              </Box>
              {searchRank !== null && (
                <Box component="span" sx={{ fontVariantNumeric: 'tabular-nums', color: 'text.primary' }}>
                  #{searchRank}
                </Box>
              )}
              {searchVolume !== null && (
                <Box component="span" sx={{ fontVariantNumeric: 'tabular-nums', color: 'text.primary' }}>
                  {formatMonthlyVolume(searchVolume)} / mo
                </Box>
              )}
              {(searchCountryText || searchFlagEmoji) && (
                <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
                  {searchCountryText ? `in ${searchCountryText}` : null}
                  {searchFlagEmoji && (
                    <Box
                      component="span"
                      role="img"
                      aria-label={searchCountryLabel ?? undefined}
                      sx={{ fontSize: '1rem', lineHeight: 1 }}
                    >
                      {searchFlagEmoji}
                    </Box>
                  )}
                </Box>
              )}
              {hasKeywordShare && (
                <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
                  <Box component="span">data from</Box>
                  <SearchKeywordShare
                    keywords={normalizedKeywordShareSegments}
                    total={keywordShareTotal}
                    label={`${uniqueKeywordCount} ${uniqueKeywordCount === 1 ? 'keyword' : 'keywords'}`}
                  />
                </Box>
              )}
            </Box>
          )}
        </Box>

        {additive.functions.length > 0 && (
          <Stack direction="row" flexWrap="wrap" gap={1} alignItems="center">
            <Typography
              variant="body1"
              color="text.secondary"
              sx={{ fontWeight: 600, whiteSpace: 'nowrap', marginRight: 1.5 }}
            >
              Function:
            </Typography>
            {additive.functions.map((fn) => {
              const functionSlug = getFunctionSlug(fn);

              if (!functionSlug) {
                return <Chip key={fn} label={fn} variant="outlined" />;
              }

              return (
                <Chip
                  key={fn}
                  label={fn}
                  variant="outlined"
                  component={NextLink}
                  href={`/function/${functionSlug}`}
                  clickable
                />
              );
            })}
          </Stack>
        )}

        {originList.length > 0 && (
          <Stack direction="row" flexWrap="wrap" gap={1} alignItems="center">
            <Typography
              variant="body1"
              color="text.secondary"
              sx={{ fontWeight: 600, whiteSpace: 'nowrap', marginRight: 1.5 }}
            >
              Origin:
            </Typography>
            {originList.map((origin) => {
              const originSlug = getOriginSlug(origin);
              const label = formatOriginLabel(origin);

              if (!originSlug) {
                return <Chip key={origin} label={label} variant="outlined" />;
              }

              return (
                <Chip
                  key={origin}
                  label={label}
                  variant="outlined"
                  component={NextLink}
                  href={`/origin/${originSlug}`}
                  clickable
                />
              );
            })}
          </Stack>
        )}

        <Typography variant="body1" color="text.secondary">
          <Box component="span" sx={{ fontWeight: 600 }}>
            Products:
          </Box>{' '}
          {productCount !== null ? (
            <MuiLink
              href={productSearchUrl}
              target="_blank"
              rel="noopener noreferrer"
              underline="hover"
              sx={{ fontWeight: 500 }}
            >
              Found in {formatProductCount(productCount)} products
            </MuiLink>
          ) : (
            'Data not available.'
          )}
        </Typography>

        {articleSummary && (
          <Typography variant="body1" color="text.primary" whiteSpace="pre-line">
            {articleSummary}
          </Typography>
        )}
      </Box>

      {hasSearchHistory && searchHistory && (
        <Box
          id="search-history"
          sx={{
            width: '100%',
            maxWidth: { xs: 760, md: 960 },
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
            px: { xs: 0, md: 2 },
          }}
        >
          <SearchHistoryChart metrics={searchHistory.metrics} />

          <Typography variant="body2" color="text.secondary" textAlign="center">
            {searchInterestCaption}
          </Typography>
        </Box>
      )}

      <Box sx={{ width: '100%', maxWidth: 760, display: 'flex', flexDirection: 'column', gap: 3 }}>
        {articleBody && <MarkdownArticle content={articleBody} />}

        {questionItems.length > 0 && <SearchQuestions questions={questionItems} />}

        {additive.wikipedia && (
          <Typography variant="body1">
            <MuiLink
              href={additive.wikipedia}
              target="_blank"
              rel="noopener noreferrer"
              underline="hover"
              sx={{ fontWeight: 500 }}
            >
              Read more on Wikipedia
            </MuiLink>
          </Typography>
        )}
      </Box>
    </Box>
  );
}
