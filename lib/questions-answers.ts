import fs from 'fs';
import path from 'path';

export interface QuestionAnswerItem {
  question: string;
  answer: string;
  source: string | null;
}

export interface QuestionAnswerDataset {
  generatedAt: string;
  model: string;
  items: QuestionAnswerItem[];
}

const answersCache = new Map<string, QuestionAnswerDataset | null>();

const getAnswersPath = (slug: string): string => path.join(process.cwd(), 'data', slug, 'questions-answers.json');

const formatQuestion = (raw: unknown): string => {
  if (typeof raw !== 'string') {
    return '';
  }

  const trimmed = raw.trim();
  if (!trimmed) {
    return '';
  }

  const capitalised = `${trimmed.charAt(0).toUpperCase()}${trimmed.slice(1)}`;
  return /[?？]\s*$/.test(capitalised) ? capitalised : `${capitalised}?`;
};

export const getQuestionAnswers = (slug: string): QuestionAnswerDataset | null => {
  if (answersCache.has(slug)) {
    return answersCache.get(slug) ?? null;
  }

  const filePath = getAnswersPath(slug);

  if (!fs.existsSync(filePath)) {
    answersCache.set(slug, null);
    return null;
  }

  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw) as {
      generatedAt?: unknown;
      model?: unknown;
      items?: unknown;
    };

    if (!parsed || !Array.isArray(parsed.items)) {
      answersCache.set(slug, null);
      return null;
    }

    const items: QuestionAnswerItem[] = parsed.items
      .map((item) => {
        if (!item || typeof item !== 'object') {
          return null;
        }

        const question = formatQuestion((item as any).question);
        const answer = typeof (item as any).answer === 'string' ? (item as any).answer.trim() : '';
        const sourceRaw = (item as any).source;
        const source = typeof sourceRaw === 'string' ? sourceRaw.trim() : null;

        if (!question || !answer) {
          return null;
        }

        return {
          question,
          answer,
          source: source && source.length > 0 ? source : null,
        };
      })
      .filter((entry): entry is QuestionAnswerItem => entry !== null);

    if (items.length === 0) {
      answersCache.set(slug, null);
      return null;
    }

    const dataset: QuestionAnswerDataset = {
      generatedAt: typeof parsed.generatedAt === 'string' ? parsed.generatedAt : '',
      model: typeof parsed.model === 'string' ? parsed.model : '',
      items,
    };

    answersCache.set(slug, dataset);
    return dataset;
  } catch (error) {
    console.error(`Failed to parse question answers for ${slug}:`, error);
    answersCache.set(slug, null);
    return null;
  }
};
