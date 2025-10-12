#!/usr/bin/env node

/**
 * Popular questions answer generator script
 *
 * Behaviour
 * - Loads search questions for additives (`data/<slug>/search-questions.json`) and filters
 *   the top questions that match editorial rules.
 * - Calls the OpenAI Responses API (model `gpt-5`) to generate concise answers and stores
 *   them in `data/<slug>/questions-answers.json`.
 * - Existing answers are skipped by default. Use --override to regenerate them.
 * - Targeted mode (--additive) processes only the requested slugs.
 *
 * Defaults & overrides
 * - Default limit: 10 additives per run (ignored when --additive is supplied).
 * - Default parallelism: 10 concurrent workers.
 * - Environment overrides: `GENERATOR_LIMIT`, `GENERATOR_BATCH` (positive integers).
 * - CLI overrides:
 *     --limit, -n, --limit=<value>          → set number of additives to process (ignored with --additive).
 *     --parallel, --batch, -p, --parallel=<value>
 *                                          → set parallel worker count.
 *     --additive/-additive/-a <slug...> or --additive=<slug[,slug...]>
 *                                          → process specific additive slugs.
 *     --override, --mode=override          → regenerate answers even if already present.
 *     --skip, --mode=skip                  → skip additives with existing answers (default).
 *     --debug                              → print OpenAI request/response payloads.
 */

const fs = require('fs/promises');
const path = require('path');
const dns = require('dns');
const { execFile } = require('child_process');

const { createAdditiveSlug } = require('./utils/slug');

dns.setDefaultResultOrder('ipv4first');

const DEFAULT_LIMIT = 10;
const DEFAULT_BATCH_SIZE = 10;
const OPENAI_MODEL = 'gpt-5';
const OPENAI_MAX_OUTPUT_TOKENS = 2000;
const PROMPT_PATH = path.join(__dirname, 'prompts', 'questions-answers.txt');
const DATA_DIR = path.join(__dirname, '..', 'data');
const ADDITIVES_INDEX_PATH = path.join(DATA_DIR, 'additives.json');
const ENV_LOCAL_PATH = path.join(__dirname, '..', 'env.local');
const SEARCH_QUESTIONS_FILENAME = 'search-questions.json';
const QUESTIONS_ANSWERS_FILENAME = 'questions-answers.json';

const QUESTION_FILTER_PATTERNS = [
  /^\s*what\s+is\b/i,
  /^\s*what\s+are\b/i,
  /^\s*how\s+much[^?]*\b(cost|price)\b/i,
  /\bwhere\s+(can\s+)?(i\s+)?(buy|get|purchase)\b/i,
  /\bwhere\s+to\s+(buy|get|purchase)\b/i,
  /\bwhere\s+do\s+i\s+(buy|get|purchase)\b/i,
];

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch (error) {
    return false;
  }
}

async function readJson(filePath) {
  const raw = await fs.readFile(filePath, 'utf8');
  return JSON.parse(raw);
}

async function loadApiKey() {
  const fromEnv = process.env.OPENAI_API_KEY;
  if (fromEnv && fromEnv.trim()) {
    return fromEnv.trim();
  }

  if (await fileExists(ENV_LOCAL_PATH)) {
    const raw = await fs.readFile(ENV_LOCAL_PATH, 'utf8');
    const lines = raw.split(/\r?\n/);
    for (const line of lines) {
      const match = line.match(/^\s*OPENAI_API_KEY\s*=\s*(.+)\s*$/);
      if (match) {
        const value = match[1].trim().replace(/^['\"]|['\"]$/g, '');
        if (value) {
          return value;
        }
      }
    }
  }

  throw new Error('OPENAI_API_KEY not found in environment or env.local.');
}

async function readPromptTemplate() {
  return fs.readFile(PROMPT_PATH, 'utf8');
}

async function readAdditivesIndex() {
  const data = await readJson(ADDITIVES_INDEX_PATH);
  if (!data || !Array.isArray(data.additives)) {
    throw new Error('Unexpected additives index format.');
  }

  return data.additives.map((entry) => ({
    title: typeof entry.title === 'string' ? entry.title : '',
    eNumber: typeof entry.eNumber === 'string' ? entry.eNumber : '',
    slug: createAdditiveSlug({ eNumber: entry.eNumber, title: entry.title }),
  }));
}

function parsePositiveInteger(value, label) {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed <= 0) {
    throw new Error(`Invalid value for ${label}: ${value}`);
  }
  return parsed;
}

function normaliseAdditiveSlug(value) {
  if (typeof value !== 'string') {
    return '';
  }
  return value.trim().toLowerCase();
}

function parseCommandLineArgs(argv) {
  const result = {
    limit: null,
    batchSize: null,
    additives: [],
    mode: 'skip',
    debug: false,
  };

  const args = Array.isArray(argv) ? argv.slice(2) : [];
  let index = 0;

  while (index < args.length) {
    const arg = args[index];

    if (arg === '--limit' || arg === '-n' || arg === '-limit') {
      if (index + 1 >= args.length) {
        throw new Error('Missing value for --limit.');
      }
      result.limit = parsePositiveInteger(args[index + 1], '--limit');
      index += 2;
      continue;
    }

    if (arg.startsWith('--limit=')) {
      const value = arg.split('=')[1];
      result.limit = parsePositiveInteger(value, '--limit');
      index += 1;
      continue;
    }

    if (arg === '--parallel' || arg === '--batch' || arg === '-p') {
      if (index + 1 >= args.length) {
        throw new Error('Missing value for --parallel.');
      }
      result.batchSize = parsePositiveInteger(args[index + 1], '--parallel');
      index += 2;
      continue;
    }

    if (arg.startsWith('--parallel=') || arg.startsWith('--batch=')) {
      const value = arg.substring(arg.indexOf('=') + 1);
      result.batchSize = parsePositiveInteger(value, '--parallel');
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
      result.additives.push(...values.map(normaliseAdditiveSlug));
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
        .map((entry) => normaliseAdditiveSlug(entry))
        .filter(Boolean);
      if (parts.length === 0) {
        throw new Error('No additive slug supplied after --additive=.');
      }
      result.additives.push(...parts);
      index += 1;
      continue;
    }

    if (arg === '--mode=override' || arg === '--override' || arg === '-override') {
      result.mode = 'override';
      index += 1;
      continue;
    }

    if (arg === '--mode=skip' || arg === '--skip' || arg === '-skip') {
      result.mode = 'skip';
      index += 1;
      continue;
    }

    if (arg === '--debug' || arg === '-debug') {
      result.debug = true;
      index += 1;
      continue;
    }

    if (!arg.startsWith('-')) {
      result.additives.push(normaliseAdditiveSlug(arg));
      index += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  result.additives = result.additives.filter(Boolean);

  return result;
}

function formatQuestion(raw) {
  const trimmed = typeof raw === 'string' ? raw.trim() : '';
  if (!trimmed) {
    return '';
  }
  const capitalised = `${trimmed.charAt(0).toUpperCase()}${trimmed.slice(1)}`;
  return /[?？]\s*$/.test(capitalised) ? capitalised : `${capitalised}?`;
}

function shouldExcludeQuestion(raw) {
  if (!raw || typeof raw !== 'string') {
    return true;
  }
  const normalised = raw.trim();
  if (!normalised) {
    return true;
  }

  for (const pattern of QUESTION_FILTER_PATTERNS) {
    if (pattern.test(normalised)) {
      return true;
    }
  }

  return false;
}

function selectTopQuestions(dataset) {
  if (!dataset || !Array.isArray(dataset.questions)) {
    return [];
  }

  const unique = [];
  const seen = new Set();

  for (const entry of dataset.questions) {
    if (!entry || typeof entry !== 'object') {
      continue;
    }
    const keyword = typeof entry.keyword === 'string' ? entry.keyword.trim() : '';
    if (!keyword) {
      continue;
    }

    const normalisedKey = keyword.toLowerCase();
    if (seen.has(normalisedKey)) {
      continue;
    }

    if (shouldExcludeQuestion(keyword)) {
      continue;
    }

    seen.add(normalisedKey);
    unique.push({
      keyword,
      volume:
        typeof entry.volume === 'number' && Number.isFinite(entry.volume) ? Math.max(0, entry.volume) : 0,
      parent_topic: typeof entry.parent_topic === 'string' ? entry.parent_topic : '',
    });
  }

  unique.sort((a, b) => b.volume - a.volume);

  return unique.slice(0, 5).map((entry) => ({
    keyword: entry.keyword,
    question: formatQuestion(entry.keyword),
    volume: entry.volume,
    parent_topic: entry.parent_topic,
  }));
}

async function readSearchQuestions(slug) {
  const filePath = path.join(DATA_DIR, slug, SEARCH_QUESTIONS_FILENAME);
  if (!(await fileExists(filePath))) {
    return null;
  }

  try {
    const raw = await fs.readFile(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.questions)) {
      return null;
    }
    return parsed;
  } catch (error) {
    console.warn(`Failed to parse ${SEARCH_QUESTIONS_FILENAME} for ${slug}: ${error.message}`);
    return null;
  }
}

async function readQuestionsAnswers(slug) {
  const filePath = path.join(DATA_DIR, slug, QUESTIONS_ANSWERS_FILENAME);
  if (!(await fileExists(filePath))) {
    return null;
  }

  try {
    const raw = await fs.readFile(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.items)) {
      return null;
    }
    return parsed;
  } catch (error) {
    console.warn(`Failed to parse ${QUESTIONS_ANSWERS_FILENAME} for ${slug}: ${error.message}`);
    return null;
  }
}

function extractTextOutput(response) {
  if (response && typeof response.output_text === 'string' && response.output_text.trim()) {
    return response.output_text.trim();
  }

  if (response && Array.isArray(response.output)) {
    for (const item of response.output) {
      if (item?.type === 'message' && Array.isArray(item.content)) {
        const textPart = item.content.find((contentItem) => contentItem?.type === 'output_text');
        if (textPart && typeof textPart.text === 'string' && textPart.text.trim()) {
          return textPart.text.trim();
        }
      }
    }
  }

  return '';
}

function sanitiseJsonCandidate(candidate) {
  if (!candidate) {
    return null;
  }

  let text = candidate.trim();

  if (!text) {
    return null;
  }

  if (text.startsWith('```')) {
    const blockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (blockMatch) {
      text = blockMatch[1].trim();
    }
  }

  if (!text.startsWith('{') && !text.startsWith('[')) {
    const bracesMatch = text.match(/\[[\s\S]*\]/);
    if (bracesMatch) {
      text = bracesMatch[0];
    } else {
      const objectMatch = text.match(/\{[\s\S]*\}/);
      if (objectMatch) {
        text = objectMatch[0];
      } else {
        return null;
      }
    }
  }

  text = text.replace(/^[\ufeff\s]+/, '').replace(/;?\s*$/, '');

  const withQuotedKeys = text.replace(/([,{]\s*)([A-Za-z0-9_-]+)\s*:/g, (match, prefix, key) => {
    return `${prefix}\"${key}\":`;
  });

  const withNormalisedQuotes = withQuotedKeys.replace(/'([^'\\]*)'/g, (match, value) => {
    return `\"${value.replace(/\"/g, '\\\"')}\"`;
  });

  const withoutTrailingCommas = withNormalisedQuotes.replace(/,\s*([}\]])/g, '$1');

  return withoutTrailingCommas;
}

function extractJsonPayload(rawText) {
  if (!rawText) {
    return null;
  }

  const candidates = [];
  const trimmed = rawText.trim();

  if (trimmed) {
    candidates.push(trimmed);
  }

  const codeBlockMatches = trimmed.match(/```(?:json)?\s*[\s\S]*?```/gi);
  if (Array.isArray(codeBlockMatches)) {
    codeBlockMatches.forEach((match) => {
      candidates.push(match);
    });
  }

  const arrayMatch = trimmed.match(/\[[\s\S]*\]/);
  if (arrayMatch) {
    candidates.push(arrayMatch[0]);
  }

  for (const candidate of candidates) {
    const sanitised = sanitiseJsonCandidate(candidate);
    if (!sanitised) {
      continue;
    }

    try {
      return JSON.parse(sanitised);
    } catch (error) {
      // continue searching
    }
  }

  return null;
}

function normaliseAnswerItems(payload) {
  if (!Array.isArray(payload)) {
    return [];
  }

  const result = [];

  for (const entry of payload) {
    if (!entry || typeof entry !== 'object') {
      continue;
    }

    const question = typeof entry.q === 'string' ? entry.q.trim() : '';
    const answer = typeof entry.a === 'string' ? entry.a.trim() : '';

    if (!question || !answer) {
      continue;
    }

    result.push({
      question: formatQuestion(question),
      answer,
    });
  }

  return result;
}

function callOpenAi({ apiKey, systemPrompt, additive, questions, debug = false }) {
  const additiveLabel = [additive.eNumber, additive.title].filter(Boolean).join(' - ') || additive.slug;
  const inputLines = [`food additive: ${additiveLabel}`];
  questions.forEach((item) => {
    inputLines.push(item.question);
  });

  const requestPayload = {
    model: OPENAI_MODEL,
    max_output_tokens: OPENAI_MAX_OUTPUT_TOKENS,
    input: [
      {
        role: 'system',
        content: [{ type: 'input_text', text: systemPrompt }],
      },
      {
        role: 'user',
        content: [
          {
            type: 'input_text',
            text: inputLines.join('\n'),
          },
        ],
      },
    ],
  };

  if (debug) {
    console.log('[debug] OpenAI request payload:');
    try {
      console.log(JSON.stringify(requestPayload, null, 2));
    } catch (stringifyError) {
      console.dir(requestPayload, { depth: null });
    }
  }

  const requestBody = JSON.stringify(requestPayload);

  return new Promise((resolve, reject) => {
    const args = [
      '--silent',
      '--show-error',
      '--fail-with-body',
      '--request',
      'POST',
      '--header',
      'Content-Type: application/json',
      '--header',
      `Authorization: Bearer ${apiKey}`,
      '--data-binary',
      requestBody,
      'https://api.openai.com/v1/responses',
    ];

    const child = execFile('curl', args, { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (debug) {
        console.log('[debug] curl stdout:', stdout);
        if (stderr) {
          console.log('[debug] curl stderr:', stderr);
        }
      }

      if (error) {
        const message = stderr || error.message;
        reject(new Error(`OpenAI API request failed: ${message.trim()}`));
        return;
      }

      if (!stdout) {
        reject(new Error('OpenAI API returned an empty response body.'));
        return;
      }

      let parsedResponse;
      try {
        parsedResponse = JSON.parse(stdout);
      } catch (parseError) {
        reject(new Error(`Failed to parse OpenAI API response JSON: ${parseError.message}`));
        return;
      }

      const outputText = extractTextOutput(parsedResponse);
      if (!outputText) {
        reject(new Error('OpenAI API returned an empty response.'));
        return;
      }

      const parsedPayload = extractJsonPayload(outputText);
      if (!parsedPayload) {
        reject(new Error('OpenAI API response did not contain a valid JSON array.'));
        return;
      }

      const items = normaliseAnswerItems(parsedPayload);
      if (items.length === 0) {
        reject(new Error('OpenAI API response did not contain recognised question/answer pairs.'));
        return;
      }

      resolve(items);
    });

    child.stdin?.end();
  });
}

async function ensureDataDirectory(slug) {
  const directoryPath = path.join(DATA_DIR, slug);
  await fs.mkdir(directoryPath, { recursive: true });
  return directoryPath;
}

async function writeQuestionsAnswers({ slug, items, questions }) {
  const directoryPath = await ensureDataDirectory(slug);
  const filePath = path.join(directoryPath, QUESTIONS_ANSWERS_FILENAME);
  const payload = {
    generatedAt: new Date().toISOString(),
    model: OPENAI_MODEL,
    items: items.map((entry, index) => ({
      question: entry.question,
      answer: entry.answer,
      source: questions[index] ? questions[index].keyword : null,
    })),
    questions: questions.map((entry) => ({
      keyword: entry.keyword,
      question: entry.question,
      volume: entry.volume,
      parent_topic: entry.parent_topic,
    })),
  };

  await fs.writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

async function processAdditive({ additive, promptTemplate, apiKey, mode, index, total, debug = false }) {
  const additiveLabel = [additive.eNumber, additive.title].filter(Boolean).join(' - ') || additive.slug;
  const searchQuestions = await readSearchQuestions(additive.slug);

  if (!searchQuestions) {
    console.log(`[${index + 1}/${total}] No search questions found for ${additiveLabel}, skipping.`);
    return;
  }

  const selectedQuestions = selectTopQuestions(searchQuestions);

  if (selectedQuestions.length === 0) {
    console.log(`[${index + 1}/${total}] No eligible questions for ${additiveLabel}, skipping.`);
    return;
  }

  const existing = await readQuestionsAnswers(additive.slug);
  if (mode === 'skip' && existing && Array.isArray(existing.items) && existing.items.length > 0) {
    console.log(`[${index + 1}/${total}] Answers already exist for ${additiveLabel}. Use --override to regenerate.`);
    return;
  }

  if (mode === 'override' && existing) {
    console.log(`[${index + 1}/${total}] Regenerating answers for ${additiveLabel}.`);
  } else {
    console.log(`[${index + 1}/${total}] Generating answers for ${additiveLabel}...`);
  }

  const items = await callOpenAi({
    apiKey,
    systemPrompt: promptTemplate,
    additive,
    questions: selectedQuestions,
    debug,
  });

  await writeQuestionsAnswers({ slug: additive.slug, items, questions: selectedQuestions });

  console.log(
    `[${index + 1}/${total}] Saved answers for ${additiveLabel} (${items.length} question${items.length === 1 ? '' : 's'}).`,
  );
}

async function collectCandidates({ additives, limit, cliArgs }) {
  const additiveMap = new Map(additives.map((entry) => [entry.slug, entry]));
  const candidates = [];

  if (cliArgs.additives.length > 0) {
    if (cliArgs.limit !== null) {
      console.warn('Ignoring --limit because specific additives were provided via --additive.');
    }

    const missingSlugs = [];

    for (const slug of cliArgs.additives) {
      const additive = additiveMap.get(slug);
      if (!additive) {
        missingSlugs.push(slug);
        continue;
      }

      candidates.push(additive);
    }

    if (missingSlugs.length) {
      missingSlugs.forEach((slug) => {
        console.warn(`No additive found for slug: ${slug}`);
      });
    }

    return candidates;
  }

  for (const additive of additives) {
    const existing = await readQuestionsAnswers(additive.slug);
    if (cliArgs.mode === 'skip' && existing && Array.isArray(existing.items) && existing.items.length > 0) {
      continue;
    }

    const searchQuestions = await readSearchQuestions(additive.slug);
    if (!searchQuestions) {
      continue;
    }

    const selected = selectTopQuestions(searchQuestions);
    if (selected.length === 0) {
      continue;
    }

    candidates.push(additive);

    if (candidates.length >= limit) {
      break;
    }
  }

  return candidates;
}

async function run() {
  try {
    const apiKey = await loadApiKey();
    const promptTemplate = await readPromptTemplate();
    const additives = await readAdditivesIndex();
    const cliArgs = parseCommandLineArgs(process.argv);

    const envLimitRaw = process.env.GENERATOR_LIMIT;
    const envBatchRaw = process.env.GENERATOR_BATCH;

    let limit = DEFAULT_LIMIT;
    if (cliArgs.limit !== null) {
      limit = cliArgs.limit;
      console.log(`Using CLI limit=${limit}`);
    } else if (envLimitRaw) {
      const parsed = Number.parseInt(envLimitRaw, 10);
      if (!Number.isNaN(parsed) && parsed > 0) {
        limit = parsed;
        console.log(`Using GENERATOR_LIMIT=${parsed}`);
      } else {
        console.warn(`Ignoring invalid GENERATOR_LIMIT value: ${envLimitRaw}`);
      }
    }

    let batchSize = DEFAULT_BATCH_SIZE;
    if (cliArgs.batchSize !== null) {
      batchSize = cliArgs.batchSize;
      console.log(`Using CLI parallel=${batchSize}`);
    } else if (envBatchRaw) {
      const parsed = Number.parseInt(envBatchRaw, 10);
      if (!Number.isNaN(parsed) && parsed > 0) {
        batchSize = parsed;
        console.log(`Using GENERATOR_BATCH=${parsed}`);
      } else {
        console.warn(`Ignoring invalid GENERATOR_BATCH value: ${envBatchRaw}`);
      }
    }

    const candidates = await collectCandidates({ additives, limit, cliArgs });

    if (candidates.length === 0) {
      console.log('No additives require new question answers. Exiting.');
      return;
    }

    console.log(
      `Preparing to update question answers for ${candidates.length} additive(s) with batch size ${Math.min(
        batchSize,
        candidates.length,
      )}...`,
    );

    let currentIndex = 0;
    const total = candidates.length;
    const errors = [];

    const workers = Array.from({ length: Math.min(batchSize, candidates.length) }, async () => {
      while (true) {
        if (currentIndex >= candidates.length) {
          return;
        }

        const localIndex = currentIndex;
        currentIndex += 1;
        const additive = candidates[localIndex];

        try {
          await processAdditive({
            additive,
            promptTemplate,
            apiKey,
            mode: cliArgs.mode,
            index: localIndex,
            total,
            debug: cliArgs.debug,
          });
        } catch (error) {
          console.error(
            `[${localIndex + 1}/${total}] Failed to generate answers for ${additive.slug}: ${error.message}`,
          );
          errors.push({ slug: additive.slug, error });
        }
      }
    });

    await Promise.all(workers);

    if (errors.length > 0) {
      console.error(`Completed with ${errors.length} error(s).`);
      process.exitCode = 1;
    } else {
      console.log('Completed updating question answers for all additives.');
    }
  } catch (error) {
    console.error('Fatal error:', error.message);
    process.exitCode = 1;
  }
}

run();
