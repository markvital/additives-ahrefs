const SUMMARY_MARKER_REGEX = /<!--\s*more\s*-->/i;

export const extractArticleSummary = (article: string | null | undefined): string | null => {
  if (!article) {
    return null;
  }

  const match = SUMMARY_MARKER_REGEX.exec(article);

  if (!match) {
    return null;
  }

  return article.slice(0, match.index).trim() || null;
};

export const extractArticleBody = (article: string | null | undefined): string => {
  if (!article) {
    return '';
  }

  const match = SUMMARY_MARKER_REGEX.exec(article);

  if (!match) {
    return article;
  }

  return article.slice(match.index + match[0].length).trimStart();
};

export const splitArticlePreview = (
  article: string | null | undefined,
  maxVisibleLines = 20,
): { preview: string; hasMore: boolean } => {
  if (!article) {
    return { preview: '', hasMore: false };
  }

  const source = extractArticleBody(article).trim();

  if (!source) {
    return { preview: '', hasMore: false };
  }

  const lines = source.split('\n');

  let startIndex = 0;
  while (startIndex < lines.length && lines[startIndex].trim().length === 0) {
    startIndex += 1;
  }

  const relevantLines = lines.slice(startIndex);

  if (relevantLines.length === 0) {
    return { preview: '', hasMore: false };
  }

  const previewLines = relevantLines.slice(0, Math.max(0, maxVisibleLines));
  const hasMore = relevantLines.length > previewLines.length;
  const preview = previewLines.join('\n').replace(/\s+$/, '');

  return {
    preview,
    hasMore,
  };
};
