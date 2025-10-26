import fs from 'fs';
import path from 'path';

import { shouldExcludeQuestion } from '../shared/question-filter';

export interface SearchQuestionItem {
  keyword: string;
  volume: number | null;
  parent_topic: string;
  intents: string[];
  answer?: string;
  answeredAt?: string;
}

export interface SearchQuestionsDataset {
  keywords: string[];
  country: string;
  fetchedAt: string;
  questions: SearchQuestionItem[];
}

const questionsCache = new Map<string, SearchQuestionsDataset | null>();
const answersCache = new Map<string, Map<string, { answer: string; answeredAt?: string }>>();

const getQuestionsPath = (slug: string): string =>
  path.join(process.cwd(), 'data', 'additive', slug, 'search-questions.json');

const getAnswersPath = (slug: string): string =>
  path.join(process.cwd(), 'data', 'additive', slug, 'questions-and-answers.json');

const normaliseQuestionKey = (value: string): string => value.trim().toLowerCase();

const KNOWN_INTENTS = [
  'informational',
  'navigational',
  'commercial',
  'transactional',
  'branded',
  'local',
] as const;

type KnownIntent = (typeof KNOWN_INTENTS)[number];

const normaliseIntents = (intents: unknown): KnownIntent[] => {
  if (!Array.isArray(intents)) {
    return [];
  }

  const seen = new Set<string>();
  const result: KnownIntent[] = [];

  for (const value of intents) {
    if (typeof value !== 'string') {
      continue;
    }
    const normalised = value.trim().toLowerCase();
    if (!normalised || seen.has(normalised)) {
      continue;
    }
    if ((KNOWN_INTENTS as readonly string[]).includes(normalised)) {
      seen.add(normalised);
      result.push(normalised as KnownIntent);
    }
  }

  return result;
};

const normaliseQuestion = (entry: SearchQuestionItem): SearchQuestionItem | null => {
  if (!entry || typeof entry !== 'object') {
    return null;
  }

  const keyword = typeof entry.keyword === 'string' ? entry.keyword.trim() : '';
  if (!keyword) {
    return null;
  }

  const volume = typeof entry.volume === 'number' && Number.isFinite(entry.volume)
    ? entry.volume
    : null;

  const parentTopic = typeof entry.parent_topic === 'string'
    ? entry.parent_topic.trim()
    : '';

  const intents = normaliseIntents(entry.intents);
  const answer = typeof (entry as any).answer === 'string' ? (entry as any).answer.trim() : '';
  const answeredAt = typeof (entry as any).answeredAt === 'string' ? (entry as any).answeredAt.trim() : '';

  const normalised: SearchQuestionItem = {
    keyword,
    volume,
    parent_topic: parentTopic,
    intents,
  };

  if (answer) {
    normalised.answer = answer;
  }

  if (answeredAt) {
    normalised.answeredAt = answeredAt;
  }

  return normalised;
};

const loadAnswerMap = (slug: string): Map<string, { answer: string; answeredAt?: string }> => {
  if (answersCache.has(slug)) {
    return answersCache.get(slug) ?? new Map();
  }

  const filePath = getAnswersPath(slug);
  const map = new Map<string, { answer: string; answeredAt?: string }>();

  if (!fs.existsSync(filePath)) {
    answersCache.set(slug, map);
    return map;
  }

  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw) as { answers?: { q?: string; a?: string; answeredAt?: string }[] };

    if (Array.isArray(parsed?.answers)) {
      for (const entry of parsed.answers) {
        if (!entry || typeof entry !== 'object') {
          continue;
        }

        const question = typeof entry.q === 'string' ? entry.q.trim() : typeof (entry as any).question === 'string'
          ? (entry as any).question.trim()
          : '';
        const answer = typeof entry.a === 'string' ? entry.a.trim() : typeof (entry as any).answer === 'string'
          ? (entry as any).answer.trim()
          : '';
        const answeredAt = typeof entry.answeredAt === 'string' ? entry.answeredAt.trim() : '';

        if (!question || !answer) {
          continue;
        }

        map.set(normaliseQuestionKey(question), {
          answer,
          answeredAt: answeredAt || undefined,
        });
      }
    }
  } catch (error) {
    console.error(`Failed to parse question answers for ${slug}:`, error);
  }

  answersCache.set(slug, map);
  return map;
};

export const getSearchQuestions = (slug: string): SearchQuestionsDataset | null => {
  if (questionsCache.has(slug)) {
    return questionsCache.get(slug) ?? null;
  }

  const filePath = getQuestionsPath(slug);

  if (!fs.existsSync(filePath)) {
    questionsCache.set(slug, null);
    return null;
  }

  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw) as SearchQuestionsDataset;

    if (!parsed || !Array.isArray(parsed.questions)) {
      questionsCache.set(slug, null);
      return null;
    }

    const keywords = Array.isArray((parsed as any)?.keywords)
      ? ((parsed as any).keywords as unknown[])
          .map((value) => (typeof value === 'string' ? value.trim() : ''))
          .filter((value): value is string => value.length > 0)
      : [];

    const questions = parsed.questions
      .map((entry) => normaliseQuestion(entry))
      .filter((entry): entry is SearchQuestionItem => entry !== null)
      .filter((entry) => !shouldExcludeQuestion(entry.keyword, { keywords }));

    const answerMap = loadAnswerMap(slug);

    if (answerMap.size > 0) {
      for (const question of questions) {
        const key = normaliseQuestionKey(question.keyword);
        const answerRecord = answerMap.get(key);

        if (!answerRecord) {
          continue;
        }

        question.answer = answerRecord.answer;
        if (answerRecord.answeredAt) {
          question.answeredAt = answerRecord.answeredAt;
        }
      }
    }

    const keywordList: string[] = keywords;

    if (keywordList.length === 0 && typeof (parsed as any)?.keyword === 'string') {
      const keyword = (parsed as any).keyword.trim();
      if (keyword) {
        keywordList.push(keyword);
      }
    }

    const uniqueKeywords = keywordList.filter(
      (value, index, list) => list.findIndex((item) => item.toLowerCase() === value.toLowerCase()) === index,
    );

    const dataset: SearchQuestionsDataset = {
      keywords: uniqueKeywords,
      country: typeof parsed.country === 'string' ? parsed.country : '',
      fetchedAt: typeof parsed.fetchedAt === 'string' ? parsed.fetchedAt : '',
      questions,
    };

    questionsCache.set(slug, dataset);
    return dataset;
  } catch (error) {
    console.error(`Failed to parse search questions for ${slug}:`, error);
    questionsCache.set(slug, null);
    return null;
  }
};
