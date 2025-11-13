import type { Metadata } from 'next';
import Image from 'next/image';
import NextLink from 'next/link';
import { notFound } from 'next/navigation';
import { Box, Chip, Link as MuiLink, Stack, Tooltip, Typography } from '@mui/material';

import { formatAdditiveDisplayName, formatFunctionLabel, formatOriginLabel } from '../../lib/additive-format';
import { extractArticleBody, extractArticleSummary } from '../../lib/article';
import {
  getAdditiveBySlug,
  getAdditiveSlugs,
  getFunctionSlug,
  getOriginSlug,
  getAwarenessScores,
} from '../../lib/additives';

import { formatMonthlyVolume, formatProductCount, getCountryFlagEmoji, getCountryLabel } from '../../lib/format';
import { getSearchHistory } from '../../lib/search-history';
import { getSearchQuestions } from '../../lib/search-questions';
import { getSearchVolumeDataset } from '../../lib/search-volume';
import { getOriginAbbreviation, getOriginIcon } from '../../lib/origin-icons';
import { getOriginDescriptionBySlug, getOriginDescriptionByValue } from '../../lib/origins';
import { AhrefsAttributionTooltip } from '../../components/AhrefsAttributionTooltip';
import { SearchHistoryChart } from '../../components/SearchHistoryChart';
import { SearchKeywordShare } from '../../components/SearchKeywordShare';
import { MarkdownArticle } from '../../components/MarkdownArticle';
import { SearchQuestions } from '../../components/SearchQuestions';
import { ReportMistakeName } from '../../components/ReportMistakeContext';
import { CompareFlapPrefill } from '../../components/CompareFlap';
import { AwarenessScoreChip } from '../../components/AwarenessScoreChip';
import { CopyLinkButton } from '../../components/CopyLinkButton';

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
  const metaTitle = `${displayName} | food additive`;
  const articleSummary = extractArticleSummary(additive.article);
  const metaDescription = articleSummary?.replace(/\s+/g, ' ').trim() || additive.description;
  const cardImageUrl = `/img/card-preview/${additive.slug}.jpg`;

  return {
    title: metaTitle,
    description: metaDescription,
    alternates: {
      canonical: `/${additive.slug}`,
    },
    openGraph: {
      title: metaTitle,
      description: metaDescription,
      url: `/${additive.slug}`,
      type: 'article',
      images: [
        {
          url: cardImageUrl,
          width: 1200,
          height: 630,
          alt: displayName,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: metaTitle,
      description: metaDescription,
      images: [cardImageUrl],
    },
  };
}

export default async function AdditivePage({ params }: AdditivePageProps) {
  const { slug } = await params;
  const additive = getAdditiveBySlug(slug);

  if (!additive) {
    notFound();
  }

  const awarenessResult = getAwarenessScores();
  const awarenessScore = awarenessResult.scores.get(additive.slug) ?? additive.awarenessScore ?? null;

  const synonymList = additive.synonyms.filter((value, index, list) => list.indexOf(value) === index);
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
            keywordConfig={searchVolumeDataset?.keywordConfig ?? null}
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

  const parentAdditives = additive.parentSlugs
    .map((parentSlug) => {
      const parent = getAdditiveBySlug(parentSlug);

      if (!parent || parent.slug === additive.slug) {
        return null;
      }

      return parent;
    })
    .filter((parent): parent is NonNullable<typeof parent> => parent !== null);

  const childAdditives = additive.childSlugs
    .map((childSlug) => {
      const child = getAdditiveBySlug(childSlug);

      if (!child || child.slug === additive.slug) {
        return null;
      }

      return child;
    })
    .filter((child): child is NonNullable<typeof child> => child !== null);

  const hasParentAdditives = parentAdditives.length > 0;
  const hasChildAdditives = childAdditives.length > 0;

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
      {' for the last 10 years from '}
      <AhrefsAttributionTooltip />
      {' search data'}
    </>
  );

  return (
    <>
      <CompareFlapPrefill slug={additive.slug} />
      <ReportMistakeName value={displayName} />
      <Box component="article" display="flex" flexDirection="column" gap={4} alignItems="center" width="100%">
        <Box className="page-hero" width="100%">
          <Box
            className="page-hero-content"
            display="flex"
            flexDirection="column"
            alignItems="center"
            textAlign="center"
            gap={1}
            sx={{ width: '100%', maxWidth: 760, margin: '0 auto' }}
          >
            <Typography component="h1" variant="h1" sx={{ color: 'inherit' }}>
              {displayName}
            </Typography>
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'flex-end',
                width: '100%',
                maxWidth: { xs: 760, md: '50%', lg: 760 },
                m: 0,
                alignSelf: { md: 'flex-end' },
              }}
            >
              <CopyLinkButton />
            </Box>
          </Box>
        </Box>

        <Box sx={{ width: '100%', maxWidth: 760, display: 'flex', flexDirection: 'column', gap: 3 }}>
        <Box display="flex" flexDirection="column" gap={1.5}>
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
          {hasParentAdditives && (
            <Typography variant="body1" color="text.secondary">
              <Box component="span" sx={{ fontWeight: 600 }}>
                Belongs to:
              </Box>{' '}
              {parentAdditives.map((parent, index) => (
                <span key={parent.slug}>
                  {index > 0 ? ', ' : null}
                  <MuiLink
                    component={NextLink}
                    href={`/${parent.slug}`}
                    underline="hover"
                    sx={{ fontWeight: 500 }}
                  >
                    {formatAdditiveDisplayName(parent.eNumber, parent.title)}
                  </MuiLink>
                </span>
              ))}
            </Typography>
          )}
          {hasChildAdditives && (
            <Typography variant="body1" color="text.secondary">
              <Box component="span" sx={{ fontWeight: 600 }}>
                Contains:
              </Box>{' '}
              <Box
                component="span"
                sx={{
                  display: 'inline-flex',
                  flexWrap: 'wrap',
                  gap: 1.5,
                }}
              >
                {childAdditives.map((child) => (
                  <MuiLink
                    key={child.slug}
                    component={NextLink}
                    href={`/${child.slug}`}
                    underline="hover"
                    sx={{ fontWeight: 500 }}
                  >
                    {formatAdditiveDisplayName(child.eNumber, child.title)}
                  </MuiLink>
                ))}
              </Box>
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
                    keywordConfig={searchVolumeDataset?.keywordConfig ?? null}
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
              const label = formatFunctionLabel(fn);

              if (!functionSlug) {
                return <Chip key={fn} label={label} variant="outlined" sx={{ textTransform: 'none' }} />;
              }

              return (
                <Chip
                  key={fn}
                  label={label}
                  variant="outlined"
                  component={NextLink}
                  href={`/function/${functionSlug}`}
                  clickable
                  sx={{ textTransform: 'none' }}
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
              const icon = getOriginIcon(origin);
              const abbreviation = getOriginAbbreviation(origin);
              const originDescription =
                (originSlug ? getOriginDescriptionBySlug(originSlug) : null) ??
                getOriginDescriptionByValue(origin);
              const tooltipTitle = originDescription ?? '';
              const tooltipProps = originDescription
                ? {}
                : {
                    disableFocusListener: true,
                    disableHoverListener: true,
                    disableTouchListener: true,
                  };
              const chipLabel = (
                <Stack direction="row" spacing={0.75} alignItems="center">
                  <Box
                    component="span"
                    aria-hidden="true"
                    sx={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: 18,
                      height: 18,
                    }}
                  >
                    {icon ? (
                      <Image
                        src={icon}
                        alt={`${label} flag`}
                        width={16}
                        height={16}
                        style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                      />
                    ) : (
                      <Box component="span" sx={{ fontSize: 12, fontWeight: 600, lineHeight: 1 }}>
                        {abbreviation}
                      </Box>
                    )}
                  </Box>
                  <Box component="span" sx={{ lineHeight: 1 }}>
                    {label}
                  </Box>
                </Stack>
              );

              if (!originSlug) {
                return (
                  <Tooltip
                    key={origin}
                    title={tooltipTitle}
                    arrow
                    enterTouchDelay={0}
                    leaveTouchDelay={1500}
                    {...tooltipProps}
                  >
                    <Chip label={chipLabel} variant="outlined" sx={{ px: 1 }} />
                  </Tooltip>
                );
              }

              return (
                <Tooltip
                  key={origin}
                  title={tooltipTitle}
                  arrow
                  enterTouchDelay={0}
                  leaveTouchDelay={1500}
                  {...tooltipProps}
                >
                  <Chip
                    label={chipLabel}
                    variant="outlined"
                    component={NextLink}
                    href={`/origin/${originSlug}`}
                    clickable
                    sx={{ px: 1 }}
                  />
                </Tooltip>
              );
            })}
          </Stack>
        )}

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
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
          {awarenessScore ? (
            <Typography
              component="div"
              variant="body1"
              color="text.secondary"
              sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
            >
              <Box component="span" sx={{ fontWeight: 600 }}>
                Awareness:
              </Box>
              <AwarenessScoreChip score={awarenessScore} />
            </Typography>
          ) : null}
        </Box>

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

          <Box sx={{ display: 'flex', justifyContent: 'center' }}>
            <Typography variant="body2" color="text.secondary" textAlign="center">
              {searchInterestCaption}
            </Typography>
          </Box>
        </Box>
      )}

      <Box sx={{ width: '100%', maxWidth: 760, display: 'flex', flexDirection: 'column', gap: 3 }}>
        {articleBody && <MarkdownArticle content={articleBody} />}

        {questionItems.length > 0 && <SearchQuestions questions={questionItems} />}

        <Box
          sx={{
            display: 'flex',
            flexDirection: { xs: 'column', sm: 'row' },
            justifyContent: { xs: 'flex-start', sm: 'space-between' },
            alignItems: { xs: 'flex-start', sm: 'center' },
            gap: { xs: 2, sm: 0 },
            m: 0,
          }}
        >
          {additive.wikipedia ? (
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
          ) : (
            <Box />
          )}
          <CopyLinkButton />
        </Box>
        </Box>
      </Box>
    </>
  );
}
