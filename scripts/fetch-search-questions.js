#!/usr/bin/env node

const fs = require('fs/promises');
const path = require('path');
const { execFile } = require('child_process');
const { promisify } = require('util');

const { createAdditiveSlug } = require('./utils/slug');
const { toKeywordList } = require('./utils/keywords');

const execFileAsync = promisify(execFile);

const API_BASE_URL = 'https://api.ahrefs.com/v3/keywords-explorer/matching-terms';
const DATA_DIR = path.join(__dirname, '..', 'data');
const ADDITIVES_INDEX_PATH = path.join(DATA_DIR, 'additives.json');
const QUESTIONS_FILENAME = 'search-questions.json';
const ENV_LOCAL_PATH = path.join(__dirname, '..', 'env.local');
const DEFAULT_COUNTRY = 'us';
const FETCH_LIMIT = 50;
const MAX_QUESTIONS = 10;
const REQUEST_DELAY_MS = 200;
const MAX_ATTEMPTS = 5;
const DEFAULT_LIMIT = Infinity;
const DEFAULT_BATCH_SIZE = 5;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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

const loadApiToken = async () => {
  const envKeys = ['AHREFS_API_KEY', 'AHREFS_API_TOKEN', 'AHREFS_TOKEN'];

  for (const key of envKeys) {
    const value = process.env[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }

  if (await fileExists(ENV_LOCAL_PATH)) {
    const raw = await fs.readFile(ENV_LOCAL_PATH, 'utf8');
    const lines = raw.split(/\r?\n/);
    for (const line of lines) {
      const match = line.match(
        /^\s*(AHREFS_API_KEY|AHREFS_API_TOKEN|AHREFS_TOKEN)\s*=\s*(.+)\s*$/,
      );
      if (match) {
        const [, , value] = match;
        const trimmed = value.trim().replace(/^['"]|['"]$/g, '');
        if (trimmed) {
          return trimmed;
        }
      }
    }
  }

  throw new Error(
    'Missing Ahrefs API token. Set AHREFS_API_KEY (or related) in the environment or env.local.',
  );
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
    force: false,
    help: false,
    limit: null,
    batchSize: null,
  };

  let index = 0;

  while (index < args.length) {
    const arg = args[index];

    if (arg === '--help' || arg === '-h' || arg === '-help') {
      result.help = true;
      index += 1;
      continue;
    }

    if (arg === '--force' || arg === '-f') {
      result.force = true;
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
      `  --force                       Re-fetch questions even if the file already exists.\n` +
      `  --limit, -n, --limit=<value>  Process at most <value> additives (ignored with --additive).\n` +
      `  --parallel, --batch, -p <value>  Run up to <value> requests in parallel.\n` +
      `  --help                        Show this message.\n` +
      `\n` +
      `Examples:\n` +
      `  node scripts/fetch-search-questions.js\n` +
      `  node scripts/fetch-search-questions.js --limit 5\n` +
      `  node scripts/fetch-search-questions.js --parallel 3\n` +
      `  node scripts/fetch-search-questions.js --additive e345-magnesium-citrate\n` +
      `  node scripts/fetch-search-questions.js --additive=e345-magnesium-citrate,e1503-castor-oil\n` +
      `  node scripts/fetch-search-questions.js --force\n`,
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
  const filePath = path.join(DATA_DIR, slug, 'props.json');
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

  return toKeywordList({ title, eNumber, synonyms });
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
    parent_topic: parentTopic,
    intents,
  };
};

const fetchQuestions = async (keyword, apiToken) => {
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

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
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

      if (attempt === MAX_ATTEMPTS) {
        throw error;
      }

      await sleep(250 * attempt);
    }
  }

  return [];
};

const writeQuestions = async (slug, dataset) => {
  const dirPath = path.join(DATA_DIR, slug);
  await fs.mkdir(dirPath, { recursive: true });
  const filePath = path.join(dirPath, QUESTIONS_FILENAME);
  const json = `${JSON.stringify(dataset, null, 2)}\n`;
  await fs.writeFile(filePath, json, 'utf8');
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

const questionsPathForSlug = (slug) => path.join(DATA_DIR, slug, QUESTIONS_FILENAME);

const shouldSkip = async (slug, options) => {
  if (options.force || options.targeted) {
    return false;
  }

  return fileExists(questionsPathForSlug(slug));
};

const main = async () => {
  const { additiveSlugs, force, help, limit, batchSize } = parseArgs(process.argv);

  if (help) {
    printUsage();
    return;
  }

  const apiToken = await loadApiToken();
  const additives = await readAdditivesIndex();

  let targets = additives;
  let targeted = false;

  if (additiveSlugs.length > 0) {
    const slugSet = new Set(additiveSlugs);
    targets = additives.filter((entry) => slugSet.has(entry.slug));
    targeted = true;

    const missing = additiveSlugs.filter((slug) => !targets.some((entry) => entry.slug === slug));
    if (missing.length > 0) {
      console.warn(`⚠️  Unknown additive slugs: ${missing.join(', ')}`);
    }

    if (targets.length === 0) {
      console.warn('No valid additives to process.');
      return;
    }
  }

  const resolvedLimit = targeted ? targets.length : limit ?? DEFAULT_LIMIT;
  if (!targeted && Number.isFinite(resolvedLimit)) {
    const sliceEnd = Math.min(resolvedLimit, targets.length);
    targets = targets.slice(0, sliceEnd);
  }

  if (targets.length === 0) {
    console.log('No additives to process.');
    return;
  }

  const total = targets.length;
  const resolvedBatchSize = Math.max(1, Math.min(batchSize ?? DEFAULT_BATCH_SIZE, total));

  let cursor = 0;

  const worker = async () => {
    while (cursor < total) {
      const currentIndex = cursor;
      cursor += 1;
      const additive = targets[currentIndex];
      const position = currentIndex + 1;
      const slug = additive.slug;

      console.log(`[${position}/${total}] ${slug}`);

      try {
        const skip = await shouldSkip(slug, { force, targeted });

        if (skip) {
          console.log('  → Skipping (questions already exist).');
          continue;
        }

        const queryKeywords = await resolveQueryKeywords(slug, additive);

        if (!queryKeywords.length) {
          console.warn('  → Skipping (unable to determine keywords).');
          continue;
        }

        console.log(
          `  → Fetching questions for ${queryKeywords.length} keyword${
            queryKeywords.length === 1 ? '' : 's'
          }`,
        );

        const aggregated = [];

        for (const keyword of queryKeywords) {
          const rawQuestions = await fetchQuestions(keyword, apiToken);
          await sleep(REQUEST_DELAY_MS);
          aggregated.push(...rawQuestions);
        }

        const dataset = ensureDataset(queryKeywords, aggregated);
        await writeQuestions(slug, dataset);
        console.log(`  → Saved ${dataset.questions.length} questions.`);
      } catch (error) {
        console.error(`  → Failed: ${error.message}`);
      }
    }
  };

  const workerCount = Math.min(resolvedBatchSize, total);
  const workers = Array.from({ length: workerCount }, () => worker());
  await Promise.all(workers);
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
