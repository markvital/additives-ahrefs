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

const splitArticleIntoParagraphs = (article: string): string[] =>
  article
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph.length > 0);

export const splitArticlePreview = (
  article: string | null | undefined,
  minimumVisibleParagraphs = 2,
): { preview: string; remainder: string } => {
  if (!article) {
    return { preview: '', remainder: '' };
  }

  const trimmed = article.trim();

  if (!trimmed) {
    return { preview: '', remainder: '' };
  }

  const paragraphs = splitArticleIntoParagraphs(trimmed);

  if (paragraphs.length <= 1) {
    return { preview: trimmed, remainder: '' };
  }

  const visibleCount = Math.min(
    paragraphs.length,
    Math.max(Math.ceil(paragraphs.length / 2), minimumVisibleParagraphs),
  );

  const preview = paragraphs.slice(0, visibleCount).join('\n\n');
  const remainder = paragraphs.slice(visibleCount).join('\n\n');

  return {
    preview,
    remainder,
  };
};
