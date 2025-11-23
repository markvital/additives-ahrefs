#!/usr/bin/env node

const fs = require('fs/promises');
const path = require('path');
const { execFile } = require('child_process');
const { promisify } = require('util');

const { createAdditiveSlug } = require('./utils/slug');
const { toKeywordList } = require('./utils/keywords');
const { loadEnvConfig, resolveAhrefsApiKey } = require('./utils/env');
const { updateLastUpdatedTimestamp } = require('./utils/last-updated');

const execFileAsync = promisify(execFile);

const API_BASE_URL = 'https://api.ahrefs.com/v3/keywords-explorer/matching-terms';
const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const ADDITIVE_DIR = path.join(DATA_DIR, 'additive');
const ADDITIVES_INDEX_PATH = path.join(DATA_DIR, 'additives.json');
const QUESTIONS_FILENAME = 'search-questions.json';
const DEFAULT_COUNTRY = 'us';
const FETCH_LIMIT = 25;
const MAX_QUESTIONS = 10;
const REQUEST_DELAY_MS = 200;
const MAX_ATTEMPTS = 2;
const DEFAULT_LIMIT = Infinity;
const DEFAULT_PARALLEL = 10;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

let DEBUG = false;
let hasChanges = false;
const debugLog = (...args) => {
  if (DEBUG) {
    console.log(...args);
  }
};

const readJsonFile = async (filePath) => {
  const raw = await fs.readFile(filePath, 'utf8');
  return JSON.parse(raw);
};

const fileExists = async (filePath) => {
  try {
    await fs.access(filePath);
    return true;
  } catch (error) {
    return false;
  }
};

const parsePositiveInteger = (value, label) => {
  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Invalid value for ${label}: ${value}`);
  }
  return parsed;
};

const parseArgs = (argv) => {
  const args = Array.isArray(argv) ? argv.slice(2) : [];
  const result = {
    additiveSlugs: [],
    override: false,
    help: false,
    limit: null,
    parallel: null,
    debug: false,
  };

  let index = 0;

  while (index < args.length) {
    const arg = args[index];

    if (arg === '--help' || arg === '-h' || arg === '-help') {
      result.help = true;
      index += 1;
      continue;
    }

    if (arg === '--debug' || arg === '-d') {
      result.debug = true;
      index += 1;
      continue;
    }

    if (arg === '--override' || arg === '--overide' || arg === '--force' || arg === '-f') {
      result.override = true;
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
      result.additiveSlugs.push(...values);
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
      result.additiveSlugs.push(...parts);
      index += 1;
      continue;
    }

    if (arg.startsWith('-')) {
      throw new Error(`Unknown option: ${arg}`);
    }

    result.additiveSlugs.push(arg);
    index += 1;
  }

  result.additiveSlugs = result.additiveSlugs
    .map((slug) => slug.trim().toLowerCase())
    .filter(Boolean);

  return result;
};

const printUsage = () => {
  console.log(
    `Usage: node fetch-search-questions.js [options]\n\n` +
      `Options:\n` +
      `  --additive <slug...>          Fetch questions for the specified additive slugs (bypasses skip logic).\n` +
      `  --additive=<slug,slug>        Same as above using a comma separated list.\n` +
      `  --override                    Re-fetch questions even if they already exist.\n` +
      `  --limit <n>                   Process at most <n> additives (ignored with --additive).\n` +
      `  --parallel <n>                Run up to <n> additives in parallel (default: ${DEFAULT_PARALLEL}).\n` +
      `  --debug                       Enable verbose logging.\n` +
      `  --help                        Show this message.\n` +
      `\n` +
      `Examples:\n` +
      `  node src/scripts/fetch-search-questions.js\n` +
      `  node src/scripts/fetch-search-questions.js --limit 5\n` +
      `  node src/scripts/fetch-search-questions.js --parallel 3\n` +
      `  node src/scripts/fetch-search-questions.js --additive e345-magnesium-citrate\n` +
      `  node src/scripts/fetch-search-questions.js --additive=e345-magnesium-citrate,e1503-castor-oil\n` +
      `  node src/scripts/fetch-search-questions.js --override\n`,
  );
};

const readAdditivesIndex = async () => {
  const data = await readJsonFile(ADDITIVES_INDEX_PATH);
  if (!data || !Array.isArray(data.additives)) {
    throw new Error('Unexpected additives index format.');
  }

  return data.additives.map((entry) => ({
    title: typeof entry.title === 'string' ? entry.title : '',
    eNumber: typeof entry.eNumber === 'string' ? entry.eNumber : '',
    slug: createAdditiveSlug({ eNumber: entry.eNumber, title: entry.title }),
  }));
};

const readProps = async (slug) => {
  const filePath = path.join(ADDITIVE_DIR, slug, 'props.json');
  if (!(await fileExists(filePath))) {
    return null;
  }

  try {
    return await readJsonFile(filePath);
  } catch (error) {
    console.warn(`⚠️  Failed to parse props for ${slug}: ${error.message}`);
    return null;
  }
};

const resolveQueryKeywords = async (slug, additive) => {
  const props = await readProps(slug);
  const titleCandidates = [props?.title, additive.title].filter((value) => typeof value === 'string');
  const eNumberCandidates = [props?.eNumber, additive.eNumber].filter(
    (value) => typeof value === 'string',
  );

  const title = titleCandidates.find((value) => value && value.trim()) ?? '';
  const eNumber = eNumberCandidates.find((value) => value && value.trim()) ?? '';
  const synonyms = Array.isArray(props?.synonyms) ? props.synonyms : [];
  const searchKeywords = Array.isArray(props?.searchKeywords) ? props.searchKeywords : [];
  const searchFilter = Array.isArray(props?.searchFilter) ? props.searchFilter : [];

  return toKeywordList({ title, eNumber, synonyms, searchKeywords, searchFilter });
};

const KNOWN_INTENTS = [
  'informational',
  'navigational',
  'commercial',
  'transactional',
  'branded',
  'local',
];

const extractIntents = (source) => {
  if (!source || typeof source !== 'object') {
    return [];
  }

  const intents = [];
  for (const key of KNOWN_INTENTS) {
    if (source[key]) {
      intents.push(key);
    }
  }
  return intents;
};

const sanitiseQuestion = (entry) => {
  if (!entry || typeof entry !== 'object') {
    return null;
  }

  const keyword = typeof entry.keyword === 'string' ? entry.keyword.trim() : '';
  if (!keyword) {
    return null;
  }

  const rawOriginalKeyword =
    typeof entry.original_keyword === 'string' ? entry.original_keyword.trim() : '';

  const volume = typeof entry.volume === 'number' && Number.isFinite(entry.volume)
    ? Math.max(0, Math.round(entry.volume))
    : null;

  const parentTopic = typeof entry.parent_topic === 'string'
    ? entry.parent_topic.trim()
    : '';

  const intents = extractIntents(entry.intents);

  return {
    keyword,
    volume,
    original_keyword: rawOriginalKeyword || keyword,
    parent_topic: parentTopic,
    intents,
  };
};

const fetchQuestions = async (keyword, apiToken) => {
  const requestUrl = new URL(API_BASE_URL);
  requestUrl.searchParams.set('country', DEFAULT_COUNTRY);
  requestUrl.searchParams.set('keywords', keyword);
  requestUrl.searchParams.set('limit', FETCH_LIMIT);
  requestUrl.searchParams.set('match_mode', 'terms');
  requestUrl.searchParams.set('order_by', 'volume:desc');
  requestUrl.searchParams.set('search_engine', 'google');
  requestUrl.searchParams.set('select', 'keyword,volume,parent_topic,intents');
  requestUrl.searchParams.set('terms', 'questions');

  const args = [
    '-fsS',
    '-H',
    `Authorization: Bearer ${apiToken}`,
    '--get',
    '--data-urlencode',
    `country=${DEFAULT_COUNTRY}`,
    '--data-urlencode',
    `keywords=${keyword}`,
    '--data-urlencode',
    `limit=${FETCH_LIMIT}`,
    '--data-urlencode',
    'match_mode=terms',
    '--data-urlencode',
    'order_by=volume:desc',
    '--data-urlencode',
    'search_engine=google',
    '--data-urlencode',
    'select=keyword,volume,parent_topic,intents',
    '--data-urlencode',
    'terms=questions',
    API_BASE_URL,
  ];

  const curlCommand = `curl ${args
    .map((arg) => (arg.includes(' ') ? `'${arg.replace(/'/g, "'\\''")}'` : arg))
    .join(' ')}`;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      debugLog(`  ↳ Attempt ${attempt}: GET ${requestUrl.toString()}`);
      if (DEBUG) {
        debugLog('    curl command:', curlCommand);
      }
      const { stdout } = await execFileAsync('curl', args);
      const payload = JSON.parse(stdout);
      const questions = Array.isArray(payload?.keywords) ? payload.keywords : [];
      return questions;
    } catch (error) {
      const stderr = error.stderr ? error.stderr.toString() : '';
      if (stderr.includes('404')) {
        return [];
      }

      console.error(
        `Failed to fetch questions for "${keyword}" (attempt ${attempt}): ${error.message.trim()}`,
      );

      if (DEBUG) {
        debugLog('    curl command (failure):', curlCommand);
        if (error.stdout) {
          debugLog('    stdout:', String(error.stdout).trim());
        }
        if (stderr) {
          debugLog('    stderr:', stderr.trim());
        }
      }

      if (attempt === MAX_ATTEMPTS) {
        throw error;
      }

      await sleep(250 * attempt);
    }
  }

  return [];
};

const writeQuestions = async (slug, dataset) => {
  const dirPath = path.join(ADDITIVE_DIR, slug);
  await fs.mkdir(dirPath, { recursive: true });
  const filePath = path.join(dirPath, QUESTIONS_FILENAME);
  const json = `${JSON.stringify(dataset, null, 2)}\n`;
  await fs.writeFile(filePath, json, 'utf8');
  hasChanges = true;
};

const ensureDataset = (keywords, questions) => {
  const seen = new Map();

  questions.forEach((entry) => {
    const sanitised = sanitiseQuestion(entry);
    if (!sanitised) {
      return;
    }
    const key = sanitised.keyword.toLowerCase();
    const existing = seen.get(key);
    if (!existing) {
      seen.set(key, sanitised);
      return;
    }

    const existingVolume = typeof existing.volume === 'number' ? existing.volume : -1;
    const nextVolume = typeof sanitised.volume === 'number' ? sanitised.volume : -1;
    if (nextVolume > existingVolume) {
      seen.set(key, sanitised);
    }
  });

  const cleaned = Array.from(seen.values());

  cleaned.sort((a, b) => {
    const volumeA = typeof a.volume === 'number' ? a.volume : -1;
    const volumeB = typeof b.volume === 'number' ? b.volume : -1;
    if (volumeA === volumeB) {
      return a.keyword.localeCompare(b.keyword);
    }
    return volumeB - volumeA;
  });

  return {
    keywords,
    country: DEFAULT_COUNTRY,
    fetchedAt: new Date().toISOString(),
    questions: cleaned.slice(0, MAX_QUESTIONS),
  };
};

const questionsPathForSlug = (slug) => path.join(ADDITIVE_DIR, slug, QUESTIONS_FILENAME);

const hasExistingQuestions = (slug) => fileExists(questionsPathForSlug(slug));

const main = async () => {
  const { additiveSlugs, override, help, limit, parallel, debug } = parseArgs(process.argv);

  if (help) {
    printUsage();
    return;
  }

  DEBUG = debug;

  await loadEnvConfig({ debug });
  const apiToken = resolveAhrefsApiKey();
  if (!apiToken) {
    throw new Error('Missing Ahrefs API key. Set AHREFS_API_KEY in the environment or env.local.');
  }
  const additives = await readAdditivesIndex();
  const additiveMap = new Map(additives.map((entry) => [entry.slug, entry]));

  const targeted = additiveSlugs.length > 0;
  if (targeted && limit !== null) {
    console.warn('Ignoring --limit because specific additives were provided via --additive.');
  }

  const effectiveOverride = targeted ? true : override;

  const candidates = [];
  const missing = [];
  let skipped = 0;

  if (targeted) {
    for (const slug of additiveSlugs) {
      const additive = additiveMap.get(slug);
      if (!additive) {
        missing.push(slug);
        continue;
      }

      const existing = await hasExistingQuestions(additive.slug);
      if (existing && effectiveOverride) {
        console.log(`Refreshing existing search questions for ${additive.slug}.`);
      }

      if (existing && !effectiveOverride) {
        if (DEBUG) {
          console.log(`Skipping existing search questions for ${additive.slug}.`);
        }
        skipped += 1;
        continue;
      }

      candidates.push(additive);
    }

    if (missing.length > 0) {
      console.warn(`⚠️  Unknown additive slugs: ${missing.join(', ')}`);
    }

    if (candidates.length === 0) {
      if (!DEBUG && skipped > 0) {
        console.log(`skipped: ${skipped}`);
      }
      console.log('No valid additives to process.');
      return;
    }
  } else {
    const resolvedLimit = limit ?? DEFAULT_LIMIT;

    for (const additive of additives) {
      const existing = await hasExistingQuestions(additive.slug);
      if (existing && !effectiveOverride) {
        if (DEBUG) {
          console.log(`Skipping existing search questions: ${additive.slug}`);
        }
        skipped += 1;
        continue;
      }

      if (existing && effectiveOverride) {
        console.log(`Refreshing existing search questions for ${additive.slug}.`);
      }

      candidates.push(additive);
      if (Number.isFinite(resolvedLimit) && candidates.length >= resolvedLimit) {
        break;
      }
    }

    if (candidates.length === 0) {
      if (!DEBUG && skipped > 0) {
        console.log(`skipped: ${skipped}`);
      }
      console.log('No additives require question updates.');
      return;
    }
  }

  if (!DEBUG && skipped > 0) {
    console.log(`skipped: ${skipped}`);
  }

  const total = candidates.length;
  console.log(`Total additives to process: ${total}`);

  const parallelLimit = Math.max(1, Math.min(candidates.length, parallel ?? DEFAULT_PARALLEL));
  let nextIndex = 0;

  const worker = async () => {
    while (true) {
      const currentIndex = nextIndex;
      if (currentIndex >= total) {
        return;
      }
      nextIndex += 1;

      const additive = candidates[currentIndex];
      const position = currentIndex + 1;
      const remaining = targeted ? null : total - position;
      const suffix = targeted ? '' : ` (${remaining} remaining)`;

      try {
        const queryKeywords = await resolveQueryKeywords(additive.slug, additive);
        const keywordSummary = queryKeywords.length > 0 ? queryKeywords.join(', ') : 'none';

        console.log(
          `[${position}/${total}] ${additive.slug} → ${queryKeywords.length} keyword${
            queryKeywords.length === 1 ? '' : 's'
          }: ${keywordSummary}${suffix}`,
        );

        if (!queryKeywords.length) {
          console.warn('  → Skipping (unable to determine keywords).');
          continue;
        }

        if (DEBUG) {
          console.log(
            `  → Fetching questions for ${queryKeywords.length} keyword${
              queryKeywords.length === 1 ? '' : 's'
            }`,
          );
        }

        const aggregated = [];

        for (const keyword of queryKeywords) {
          const rawQuestions = await fetchQuestions(keyword, apiToken);
          await sleep(REQUEST_DELAY_MS);
          const annotatedQuestions = Array.isArray(rawQuestions)
          ? rawQuestions.map((entry) => ({
              ...entry,
              original_keyword: keyword,
            }))
          : [];
        aggregated.push(...annotatedQuestions);
        }

        const dataset = ensureDataset(queryKeywords, aggregated);
        const questionsAbsolutePath = questionsPathForSlug(additive.slug);
        const questionsRelativePath = path.relative(process.cwd(), questionsAbsolutePath);

        await writeQuestions(additive.slug, dataset);

        if (DEBUG) {
          console.log(`  → Saved ${dataset.questions.length} questions in ${questionsRelativePath}.`);
        }
      } catch (error) {
        console.error(`  → Failed: ${error.message}`);
        if (DEBUG && error?.stderr) {
          debugLog('    stderr:', String(error.stderr).trim());
        }
      }
    }
  };

  await Promise.all(Array.from({ length: parallelLimit }, () => worker()));

  if (hasChanges) {
    await updateLastUpdatedTimestamp();
  }
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
