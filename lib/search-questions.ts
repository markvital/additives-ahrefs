import fs from 'fs';
import path from 'path';

export interface SearchQuestionIntents {
  informational: boolean;
  navigational: boolean;
  commercial: boolean;
  transactional: boolean;
  branded: boolean;
  local: boolean;
}

export interface SearchQuestionItem {
  keyword: string;
  volume: number | null;
  parent_topic: string;
  intents: SearchQuestionIntents;
}

export interface SearchQuestionsDataset {
  keyword: string;
  country: string;
  fetchedAt: string;
  questions: SearchQuestionItem[];
}

const questionsCache = new Map<string, SearchQuestionsDataset | null>();

const getQuestionsPath = (slug: string): string =>
  path.join(process.cwd(), 'data', slug, 'search-questions.json');

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

  const intents = entry.intents && typeof entry.intents === 'object'
    ? {
        informational: Boolean(entry.intents.informational),
        navigational: Boolean(entry.intents.navigational),
        commercial: Boolean(entry.intents.commercial),
        transactional: Boolean(entry.intents.transactional),
        branded: Boolean(entry.intents.branded),
        local: Boolean(entry.intents.local),
      }
    : {
        informational: false,
        navigational: false,
        commercial: false,
        transactional: false,
        branded: false,
        local: false,
      };

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

    const dataset: SearchQuestionsDataset = {
      keyword: typeof parsed.keyword === 'string' ? parsed.keyword : '',
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
