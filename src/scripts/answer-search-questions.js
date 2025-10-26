#!/usr/bin/env node

const fs = require('fs/promises');
const path = require('path');
const dns = require('dns');

const OpenAI = require('openai');
const { ProxyAgent, setGlobalDispatcher } = require('undici');

const { createAdditiveSlug } = require('./utils/slug');
const { loadEnvConfig, resolveOpenAiApiKey } = require('./utils/env');
const { shouldExcludeQuestion } = require('../shared/question-filter');

dns.setDefaultResultOrder('ipv4first');

const proxyUrl = process.env.https_proxy || process.env.HTTPS_PROXY || process.env.http_proxy || process.env.HTTP_PROXY;
if (proxyUrl) {
  try {
    setGlobalDispatcher(new ProxyAgent(proxyUrl));
  } catch (error) {
    console.warn(`Failed to configure proxy agent for ${proxyUrl}: ${error.message}`);
  }
}

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const ADDITIVE_DIR = path.join(DATA_DIR, 'additive');
const ADDITIVES_INDEX_PATH = path.join(DATA_DIR, 'additives.json');
const PROMPT_PATH = path.join(__dirname, 'prompts', 'search-question-answer.txt');
const ANSWERS_FILENAME = 'questions-and-answers.json';

const QUESTIONS_PER_ADDITIVE = 5;
const OPENAI_MODEL = 'gpt-5';
const OPENAI_MAX_OUTPUT_TOKENS = 4000;
const MAX_ATTEMPTS = 3;
const BASE_RETRY_DELAY_MS = 1500;
const DEFAULT_PARALLEL = 3;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const parsePositiveInteger = (value, label) => {
  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Invalid value for ${label}: ${value}`);
  }
  return parsed;
};

const normaliseSlug = (value) => {
  if (typeof value !== 'string') {
    return '';
  }
  return value.trim().toLowerCase();
};

const parseArgs = (argv) => {
  const args = Array.isArray(argv) ? argv.slice(2) : [];
  const result = {
    additives: [],
    limit: null,
    override: false,
    delay: 0,
    debug: false,
    parallel: null,
  };

  let index = 0;

  while (index < args.length) {
    const arg = args[index];

    if (arg === '--help' || arg === '-h') {
      result.help = true;
      break;
    }

    if (arg === '--override' || arg === '--force' || arg === '-f') {
      result.override = true;
      index += 1;
      continue;
    }

    if (arg === '--debug' || arg === '-d') {
      result.debug = true;
      index += 1;
      continue;
    }

    if (arg === '--limit' || arg === '-n' || arg === '-limit') {
      if (index + 1 >= args.length) {
        throw new Error('Missing value for --limit.');
      }
      result.limit = parsePositiveInteger(args[index + 1], '--limit');
      index += 2;
      continue;
    }

    if (arg.startsWith('--limit=')) {
      const value = arg.substring(arg.indexOf('=') + 1);
      result.limit = parsePositiveInteger(value, '--limit');
      index += 1;
      continue;
    }

    if (arg === '--delay') {
      if (index + 1 >= args.length) {
        throw new Error('Missing value for --delay.');
      }
      result.delay = parsePositiveInteger(args[index + 1], '--delay');
      index += 2;
      continue;
    }

    if (arg.startsWith('--delay=')) {
      const value = arg.substring(arg.indexOf('=') + 1);
      result.delay = parsePositiveInteger(value, '--delay');
      index += 1;
      continue;
    }

    if (arg === '--parallel' || arg === '--batch' || arg === '-p') {
      if (index + 1 >= args.length) {
        throw new Error('Missing value for --parallel.');
      }
      result.parallel = parsePositiveInteger(args[index + 1], '--parallel');
      index += 2;
      continue;
    }

    if (arg.startsWith('--parallel=') || arg.startsWith('--batch=')) {
      const value = arg.substring(arg.indexOf('=') + 1);
      result.parallel = parsePositiveInteger(value, '--parallel');
      index += 1;
      continue;
    }

    if (arg === '--additive' || arg === '-additive' || arg === '-a') {
      const values = [];
      let next = index + 1;
      while (next < args.length && !args[next].startsWith('-')) {
        values.push(args[next]);
        next += 1;
      }
      if (values.length === 0) {
        throw new Error('No additive slugs supplied after --additive.');
      }
      result.additives.push(...values);
      index = next;
      continue;
    }

    if (arg.startsWith('--additive=') || arg.startsWith('-additive=')) {
      const value = arg.substring(arg.indexOf('=') + 1);
      if (!value) {
        throw new Error('No additive slug supplied after --additive=.');
      }
      const parts = value
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean);
      if (parts.length === 0) {
        throw new Error('No additive slug supplied after --additive=.');
      }
      result.additives.push(...parts);
      index += 1;
      continue;
    }

    if (arg.startsWith('-')) {
      throw new Error(`Unknown option: ${arg}`);
    }

    result.additives.push(arg);
    index += 1;
  }

  if (result.additives.length > 0) {
    const seen = new Set();
    result.additives = result.additives
      .map(normaliseSlug)
      .filter((slug) => {
        if (!slug || seen.has(slug)) {
          return false;
        }
        seen.add(slug);
        return true;
      });
  }

  return result;
};

const fileExists = async (filePath) => {
  try {
    await fs.access(filePath);
    return true;
  } catch (error) {
    return false;
  }
};

const readJson = async (filePath) => {
  const raw = await fs.readFile(filePath, 'utf8');
  return JSON.parse(raw);
};

const readAdditivesIndex = async () => {
  const data = await readJson(ADDITIVES_INDEX_PATH);
  if (!data || !Array.isArray(data.additives)) {
    throw new Error('Unexpected additives index format.');
  }

  return data.additives.map((entry) => ({
    title: typeof entry.title === 'string' ? entry.title : '',
    eNumber: typeof entry.eNumber === 'string' ? entry.eNumber : '',
    slug: createAdditiveSlug({ eNumber: entry.eNumber, title: entry.title }),
  }));
};

const readPrompt = async () => fs.readFile(PROMPT_PATH, 'utf8');

const normaliseArray = (value) => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter((item, index, list) => item.length > 0 && list.indexOf(item) === index);
};

const normaliseText = (value) => {
  if (typeof value !== 'string') {
    return '';
  }

  return value.trim();
};

const createQuestionKey = (value) => normaliseText(value).toLowerCase();

const loadAnswersDataset = async (slug) => {
  const answersPath = path.join(ADDITIVE_DIR, slug, ANSWERS_FILENAME);
  const dataset = {
    updatedAt: '',
    answers: [],
  };
  const map = new Map();

  if (!(await fileExists(answersPath))) {
    return { dataset, map, answersPath };
  }

  try {
    const raw = await readJson(answersPath);
    if (raw && typeof raw === 'object') {
      const updatedAt = normaliseText(raw.updatedAt);
      if (updatedAt) {
        dataset.updatedAt = updatedAt;
      }

      if (Array.isArray(raw.answers)) {
        for (const entry of raw.answers) {
          const question = normaliseText(entry?.q ?? entry?.question ?? '');
          const answer = normaliseText(entry?.a ?? entry?.answer ?? '');
          const answeredAt = normaliseText(entry?.answeredAt ?? '');

          if (!question || !answer) {
            continue;
          }

          const record = {
            q: question,
            a: answer,
          };

          if (answeredAt) {
            record.answeredAt = answeredAt;
          }

          dataset.answers.push(record);
          map.set(createQuestionKey(question), record);
        }
      }
    }
  } catch (error) {
    console.warn(`Failed to parse existing answers for ${slug}: ${error.message}`);
  }

  return { dataset, map, answersPath };
};

const serialiseAnswers = (answers) =>
  answers.map((entry) => {
    const payload = {
      q: entry.q,
      a: entry.a,
    };

    if (entry.answeredAt) {
      payload.answeredAt = entry.answeredAt;
    }

    return payload;
  });

const loadAdditiveMetadata = async (slug) => {
  const propsPath = path.join(ADDITIVE_DIR, slug, 'props.json');
  const articlePath = path.join(ADDITIVE_DIR, slug, 'article.md');

  let props = {};
  if (await fileExists(propsPath)) {
    try {
      props = await readJson(propsPath);
    } catch (error) {
      console.warn(`Failed to parse props for ${slug}: ${error.message}`);
    }
  }

  let article = '';
  if (await fileExists(articlePath)) {
    try {
      const raw = await fs.readFile(articlePath, 'utf8');
      article = raw.trim();
    } catch (error) {
      console.warn(`Failed to read article for ${slug}: ${error.message}`);
    }
  }

  const metadata = {
    title: typeof props.title === 'string' ? props.title : '',
    eNumber: typeof props.eNumber === 'string' ? props.eNumber : '',
    description: typeof props.description === 'string' ? props.description : '',
    functions: normaliseArray(props.functions),
    synonyms: normaliseArray(props.synonyms),
    origin: normaliseArray(props.origin),
    wikipedia: typeof props.wikipedia === 'string' ? props.wikipedia : '',
  };

  const MAX_ARTICLE_LENGTH = 3500;
  const articleSnippet = article.length > MAX_ARTICLE_LENGTH
    ? `${article.slice(0, MAX_ARTICLE_LENGTH)}…`
    : article;

  if (articleSnippet) {
    metadata.article = articleSnippet;
  }

  return metadata;
};

const extractResponseText = (response) => {
  if (!response) {
    return '';
  }

  const segments = [];

  if (typeof response.output_text === 'string' && response.output_text.trim()) {
    segments.push(response.output_text.trim());
  }

  if (Array.isArray(response.output)) {
    for (const item of response.output) {
      if (item?.type === 'message' && Array.isArray(item.content)) {
        for (const contentItem of item.content) {
          if (contentItem?.type === 'output_text' && typeof contentItem.text === 'string' && contentItem.text.trim()) {
            segments.push(contentItem.text.trim());
          }
        }
      }
    }
  }

  const uniqueSegments = segments.filter((segment, index, list) => list.indexOf(segment) === index);
  return uniqueSegments.join('\n').trim();
};
const parseAnswerList = (text, expectedCount) => {
  if (!text) {
    throw new Error('OpenAI API returned an empty answer set.');
  }

  const trimmed = text.trim();
  const startIndex = trimmed.indexOf('[');
  const endIndex = trimmed.lastIndexOf(']');

  if (startIndex === -1 || endIndex === -1 || endIndex <= startIndex) {
    throw new Error('OpenAI API response did not contain a JSON array.');
  }

  const jsonPayload = trimmed.slice(startIndex, endIndex + 1);

  let parsed;
  try {
    parsed = JSON.parse(jsonPayload);
  } catch (error) {
    throw new Error(`Unable to parse JSON answer payload: ${error.message}`);
  }

  if (!Array.isArray(parsed)) {
    throw new Error('OpenAI API response JSON was not an array.');
  }

  if (typeof expectedCount === 'number' && expectedCount > 0 && parsed.length !== expectedCount) {
    throw new Error(`Expected ${expectedCount} answers but received ${parsed.length}.`);
  }

  return parsed.map((entry, index) => {
    const question = normaliseText(entry?.q ?? entry?.question ?? '');
    const answer = normaliseText(entry?.a ?? entry?.answer ?? '');

    if (!answer) {
      throw new Error(`Answer ${index + 1} was empty.`);
    }

    return {
      q: question,
      a: answer,
    };
  });
};

const generateAnswers = async ({
  client,
  prompt,
  additive,
  questions,
  metadata,
  debug = false,
}) => {
  const additiveLabelParts = [normaliseText(additive.eNumber), normaliseText(additive.title)].filter(Boolean);
  const additiveLabel = additiveLabelParts.length > 0 ? additiveLabelParts.join(' - ') : additive.slug;

  const questionLines = questions.map((item) => normaliseText(item.keyword)).filter(Boolean);

  if (questionLines.length === 0) {
    return [];
  }

  const payload = {
    additive,
    metadata,
    questions: questionLines,
  };

  const requestPayload = {
    model: OPENAI_MODEL,
    max_output_tokens: OPENAI_MAX_OUTPUT_TOKENS,
    input: [
      {
        role: 'system',
        content: [{ type: 'input_text', text: prompt }],
      },
      {
        role: 'user',
        content: [
          {
            type: 'input_text',
            text: [`Context:`, JSON.stringify(payload, null, 2), '', `food additive: ${additiveLabel}`, ...questionLines].join('\n'),
          },
        ],
      },
    ],
  };

  if (debug) {
    console.log('[debug] OpenAI request payload:');
    try {
      console.log(JSON.stringify(requestPayload, null, 2));
    } catch (error) {
      console.dir(requestPayload, { depth: null });
    }
  }

  try {
    const response = await client.responses.create(requestPayload);

    if (debug) {
      console.log('[debug] OpenAI response payload:');
      try {
        console.log(JSON.stringify(response, null, 2));
      } catch (error) {
        console.dir(response, { depth: null });
      }
    }

    const answerText = extractResponseText(response);
    const answers = parseAnswerList(answerText, questionLines.length);

    return answers;
  } catch (error) {
    if (error instanceof OpenAI.APIError) {
      const details = error?.error?.message || error.message;
      throw new Error(`OpenAI API request failed (status ${error.status ?? 'unknown'}): ${details}`);
    }

    throw error;
  }
};

const processAdditive = async ({
  additive,
  client,
  prompt,
  override = false,
  delay = 0,
  debug = false,
}) => {
  const questionPath = path.join(ADDITIVE_DIR, additive.slug, 'search-questions.json');

  if (!(await fileExists(questionPath))) {
    console.warn(`Skipping ${additive.slug}: no search-questions.json found.`);
    return;
  }

  let dataset;
  try {
    dataset = await readJson(questionPath);
  } catch (error) {
    console.warn(`Skipping ${additive.slug}: unable to parse search questions (${error.message}).`);
    return;
  }

  if (!dataset || !Array.isArray(dataset.questions)) {
    console.warn(`Skipping ${additive.slug}: unexpected search questions format.`);
    return;
  }

  const keywords = Array.isArray(dataset.keywords)
    ? dataset.keywords
        .map((value) => (typeof value === 'string' ? value.trim() : ''))
        .filter((value) => value.length > 0)
    : [];

  const candidates = dataset.questions
    .map((question, index) => ({ question, index }))
    .filter((entry) => typeof entry.question?.keyword === 'string')
    .filter((entry) => !shouldExcludeQuestion(entry.question.keyword, { keywords }))
    .slice(0, QUESTIONS_PER_ADDITIVE);

  if (candidates.length === 0) {
    console.log(`No eligible questions found for ${additive.slug}.`);
    return;
  }

  const metadata = await loadAdditiveMetadata(additive.slug);
  const { map: existingAnswers, answersPath } = await loadAnswersDataset(additive.slug);
  const answersRelativePath = path.join('data', 'additive', additive.slug, ANSWERS_FILENAME);

  const pending = [];
  for (const { question } of candidates) {
    const keyword = normaliseText(question.keyword);
    if (!keyword) {
      continue;
    }

    const key = createQuestionKey(keyword);
    const existing = existingAnswers.get(key);

    if (existing?.a && !override) {
      continue;
    }

    pending.push({ keyword, key });
  }

  if (pending.length === 0) {
    console.log(`No new answers needed for ${additive.slug}.`);
    return;
  }

  console.log(
    `→ Answering ${pending.length} question(s) for ${additive.slug}: ${pending
      .map((entry) => `“${entry.keyword}”`)
      .join(', ')}`,
  );

  const now = new Date().toISOString();
  let responses = [];
  let attempt = 0;

  while (attempt < MAX_ATTEMPTS) {
    attempt += 1;
    try {
      responses = await generateAnswers({
        client,
        prompt,
        additive,
        questions: pending.map((entry) => ({ keyword: entry.keyword })),
        metadata,
        debug,
      });
      break;
    } catch (error) {
      if (attempt >= MAX_ATTEMPTS) {
        console.warn(`Failed to answer questions for ${additive.slug}: ${error.message}`);
        return;
      }

      const delayMs = BASE_RETRY_DELAY_MS * attempt;
      console.warn(`  Attempt ${attempt} failed: ${error.message || error}. Retrying in ${delayMs} ms...`);
      await sleep(delayMs);
    }
  }

  if (!responses || responses.length === 0) {
    console.log(`No answers returned for ${additive.slug}.`);
    return;
  }

  for (let index = 0; index < pending.length; index += 1) {
    const pendingEntry = pending[index];
    const responseEntry = responses[index];

    if (!responseEntry) {
      continue;
    }

    const questionText = normaliseText(responseEntry.q) || pendingEntry.keyword;
    const record = {
      q: questionText,
      a: responseEntry.a,
      answeredAt: now,
    };

    existingAnswers.set(pendingEntry.key, record);
  }

  const orderedAnswers = [];
  const seen = new Set();

  for (const entry of dataset.questions) {
    const keyword = normaliseText(entry?.keyword ?? '');
    if (!keyword) {
      continue;
    }

    const key = createQuestionKey(keyword);
    const answerRecord = existingAnswers.get(key);
    if (answerRecord && !seen.has(answerRecord)) {
      orderedAnswers.push(answerRecord);
      seen.add(answerRecord);
    }
  }

  for (const answerRecord of existingAnswers.values()) {
    if (!seen.has(answerRecord)) {
      orderedAnswers.push(answerRecord);
      seen.add(answerRecord);
    }
  }

  const output = {
    updatedAt: now,
    answers: serialiseAnswers(orderedAnswers),
  };

  await fs.writeFile(answersPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
  console.log(`Saved ${orderedAnswers.length} answer(s) to ${answersRelativePath}.`);

  if (delay > 0) {
    await sleep(delay);
  }
};

const formatAdditiveLabel = (additive) => {
  const pieces = [additive.eNumber, additive.title].filter((value) => typeof value === 'string' && value.trim());
  return pieces.length > 0 ? pieces.join(' — ') : additive.slug;
};

const run = async () => {
  try {
    const args = parseArgs(process.argv);
    if (args.help) {
      console.log('Usage: node src/scripts/answer-search-questions.js [options]');
      console.log('Options:');
      console.log('  --additive <slug...>      Limit processing to specific additive slugs.');
      console.log('  --limit <number>          Limit the number of additives processed.');
      console.log('  --delay <ms>              Optional delay in milliseconds between answers.');
      console.log(`  --parallel <number>       Run up to <number> additives simultaneously (default: ${DEFAULT_PARALLEL}).`);
      console.log('  --override                Regenerate answers even if one already exists.');
      console.log('  --debug                   Print OpenAI request and response payloads.');
      console.log('  --help                    Show this help message.');
      return;
    }

    await loadEnvConfig({ override: false });
    const apiKey = resolveOpenAiApiKey();
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY is not set. Provide it via the environment or env.local.');
    }

    const client = new OpenAI({ apiKey });
    const prompt = await readPrompt();
    const additives = await readAdditivesIndex();

    let targets = additives;

    if (args.additives.length > 0) {
      const allowed = new Set(args.additives);
      targets = additives.filter((entry) => allowed.has(entry.slug));
      const missing = args.additives.filter((slug) => !targets.find((entry) => entry.slug === slug));
      if (missing.length > 0) {
        console.warn(`Warning: ${missing.join(', ')} not found in additives index.`);
      }
    }

    if (typeof args.limit === 'number' && Number.isFinite(args.limit)) {
      targets = targets.slice(0, args.limit);
    }

    if (targets.length === 0) {
      console.log('No additives to process.');
      return;
    }

    const effectiveOverride = args.override || args.additives.length > 0;
    const total = targets.length;
    const parallelLimit = Math.max(1, Math.min(total, args.parallel ?? DEFAULT_PARALLEL));
    let nextIndex = 0;

    const worker = async () => {
      while (true) {
        const currentIndex = nextIndex;
        if (currentIndex >= total) {
          return;
        }
        nextIndex += 1;

        const additive = targets[currentIndex];
        console.log(`[${currentIndex + 1}/${total}] Processing ${formatAdditiveLabel(additive)} (${additive.slug})`);

        try {
          await processAdditive({
            additive,
            client,
            prompt,
            override: effectiveOverride,
            delay: args.delay,
            debug: args.debug,
          });
        } catch (error) {
          console.error(`  → Failed to process ${additive.slug}: ${error.message || error}`);
        }
      }
    };

    await Promise.all(Array.from({ length: parallelLimit }, () => worker()));
  } catch (error) {
    console.error(error.message || error);
    process.exitCode = 1;
  }
};

run();
