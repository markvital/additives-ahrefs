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
    return article.trim();
  }

  return article.slice(match.index + match[0].length).trimStart();
};

const splitIntoParagraphs = (content: string): string[] => {
  return content
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph.length > 0);
};

export const splitArticlePreview = (
  article: string | null | undefined,
): { preview: string; remainder: string } => {
  if (!article) {
    return { preview: '', remainder: '' };
  }

  const cleanArticle = article.replace(SUMMARY_MARKER_REGEX, '').trim();

  if (!cleanArticle) {
    return { preview: '', remainder: '' };
  }

  const paragraphs = splitIntoParagraphs(cleanArticle);

  if (paragraphs.length <= 1) {
    return { preview: cleanArticle, remainder: '' };
  }

  const splitIndex = Math.max(1, Math.ceil(paragraphs.length / 2));
  const previewParagraphs = paragraphs.slice(0, splitIndex);
  const remainderParagraphs = paragraphs.slice(splitIndex);

  return {
    preview: previewParagraphs.join('\n\n').trim(),
    remainder: remainderParagraphs.join('\n\n').trim(),
  };
};
