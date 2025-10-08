import fs from 'fs';
import path from 'path';

export interface SearchQuestionItem {
  keyword: string;
  volume: number | null;
  parent_topic: string;
  intents: string[];
}

export interface SearchQuestionsDataset {
  keywords: string[];
  country: string;
  fetchedAt: string;
  questions: SearchQuestionItem[];
}

const questionsCache = new Map<string, SearchQuestionsDataset | null>();

const getQuestionsPath = (slug: string): string =>
  path.join(process.cwd(), 'data', slug, 'search-questions.json');

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

  return {
    keyword,
    volume,
    parent_topic: parentTopic,
    intents,
  };
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

    const questions = parsed.questions
      .map((entry) => normaliseQuestion(entry))
      .filter((entry): entry is SearchQuestionItem => entry !== null);

    const keywordList: string[] = Array.isArray((parsed as any)?.keywords)
      ? ((parsed as any).keywords as unknown[])
          .map((value) => (typeof value === 'string' ? value.trim() : ''))
          .filter((value): value is string => value.length > 0)
      : [];

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
