#!/usr/bin/env node

/**
 * Fetches Ahrefs Keywords Explorer search volume data for each additive
 * and writes the per-additive `searchVolume.json` file containing the
 * aggregated total and keyword-level breakdown.
*/

const fs = require('fs/promises');
const path = require('path');
const { execFile } = require('child_process');
const { promisify } = require('util');

const { createAdditiveSlug } = require('./utils/slug');
const { toKeywordList } = require('./utils/keywords');
const { loadEnvConfig, resolveAhrefsApiKey } = require('./utils/env');

const execFileAsync = promisify(execFile);

const DATA_DIR = path.join(__dirname, '..', 'data');
const ADDITIVES_INDEX_PATH = path.join(DATA_DIR, 'additives.json');
const API_URL = 'https://api.ahrefs.com/v3/keywords-explorer/overview';
const COUNTRY = 'us';
const DEFAULT_PARALLEL = 10;
const DEFAULT_LIMIT = Infinity;
const MAX_RETRIES = 3;
const REQUEST_DELAY_MS = 200;
const REQUEST_SPACING_MS = 500;
const SEARCH_VOLUME_FILENAME = 'searchVolume.json';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

let DEBUG = false;
const debugLog = (...args) => {
  if (DEBUG) {
    console.log(...args);
  }
};

const parsePositiveInteger = (value, label) => {
  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Invalid value for ${label}: ${value}`);
  }
  return parsed;
};

let requestChain = Promise.resolve();
let lastRequestTimestamp = 0;

const runWithRequestSpacing = (task) => {
  const invoke = async () => {
    const now = Date.now();
    const wait = Math.max(0, lastRequestTimestamp + REQUEST_SPACING_MS - now);
    if (wait > 0) {
      debugLog(`    ↳ Waiting ${wait}ms before issuing request to respect pacing.`);
      await sleep(wait);
    }

    try {
      return await task();
    } finally {
      lastRequestTimestamp = Date.now();
    }
  };

  const result = requestChain.then(invoke, invoke);
  requestChain = result.catch(() => {});
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

const parseArgs = (argv) => {
  const result = {
    additiveSlugs: [],
    help: false,
    debug: false,
    limit: null,
    parallel: null,
    override: false,
  };

  const args = Array.isArray(argv) ? argv.slice(2) : [];
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

    if (arg === '--override' || arg === '--overide' || arg === '--force') {
      result.override = true;
      index += 1;
      continue;
    }

    if (arg === '--additive' || arg === '-a') {
      const values = [];
      let cursor = index + 1;
      while (cursor < args.length && !args[cursor].startsWith('-')) {
        values.push(args[cursor]);
        cursor += 1;
      }

      if (values.length === 0) {
        throw new Error('No additive slugs supplied after --additive.');
      }

      result.additiveSlugs.push(
        ...values.map((value) => value.trim().toLowerCase()).filter(Boolean),
      );
      index = cursor;
      continue;
    }

    if (arg.startsWith('--additive=')) {
      const value = arg.substring(arg.indexOf('=') + 1);
      if (!value) {
        throw new Error('No additive slug supplied after --additive=.');
      }

      const parts = value
        .split(',')
        .map((entry) => entry.trim().toLowerCase())
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

    result.additiveSlugs.push(arg.trim().toLowerCase());
    index += 1;
  }

  result.additiveSlugs = result.additiveSlugs.filter(Boolean);

  return result;
};

const printUsage = () => {
  console.log(
    `Usage: node scripts/update-search-volume.js [options]\n` +
      `\n` +
      `Options:\n` +
      `  --additive <slug...>     Only update the specified additive slugs.\n` +
      `  --additive=<slug,slug>   Same as above using a comma separated list.\n` +
      `  --limit <n>              Process at most <n> additives (default: unlimited).\n` +
      `  --parallel <n>           Run up to <n> additives in parallel (default: ${DEFAULT_PARALLEL}).\n` +
      `  --override               Re-fetch data even if it already exists.\n` +
      `  --debug                  Enable verbose logging.\n` +
      `  --help                   Show this message.\n`,
  );
};

const readAdditivesIndex = async () => {
  const raw = await fs.readFile(ADDITIVES_INDEX_PATH, 'utf8');
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed.additives)) {
    throw new Error('Unexpected additives.json format.');
  }
  return parsed.additives;
};

const propsPathForSlug = (slug) => path.join(DATA_DIR, slug, 'props.json');

const readProps = async (slug, fallback) => {
  try {
    const raw = await fs.readFile(propsPathForSlug(slug), 'utf8');
    const data = JSON.parse(raw);
    return ensureProps(data, fallback);
  } catch (error) {
    return ensureProps(null, fallback);
  }
};

const ensureProps = (props, fallback) => {
  const result = props && typeof props === 'object' ? { ...props } : {};

  if (typeof result.title !== 'string') {
    result.title = fallback.title || '';
  }
  if (typeof result.eNumber !== 'string') {
    result.eNumber = fallback.eNumber || '';
  }
  if (!Array.isArray(result.synonyms)) {
    result.synonyms = [];
  }
  if (!Array.isArray(result.functions)) {
    result.functions = [];
  }
  if (typeof result.origin === 'undefined' || !Array.isArray(result.origin)) {
    result.origin = Array.isArray(result.origin) ? result.origin : [];
  }
  if (typeof result.description !== 'string') {
    result.description = '';
  }
  if (typeof result.wikipedia !== 'string') {
    result.wikipedia = '';
  }
  if (typeof result.wikidata !== 'string') {
    result.wikidata = '';
  }
  if (!Array.isArray(result.searchSparkline)) {
    result.searchSparkline = [];
  }
  return result;
};

const hasExistingSearchVolume = async (slug, props) => {
  if (await fileExists(searchVolumePathForSlug(slug))) {
    return true;
  }

  if (props && typeof props === 'object') {
    if (typeof props.searchVolume === 'number' && Number.isFinite(props.searchVolume)) {
      return true;
    }
  }

  try {
    const raw = await fs.readFile(propsPathForSlug(slug), 'utf8');
    const data = JSON.parse(raw);
    if (typeof data.searchVolume === 'number' && Number.isFinite(data.searchVolume)) {
      return true;
    }
  } catch (error) {
    // ignore
  }

  return false;
};

const fetchVolumesForKeywords = async (apiKey, keywords, attempt = 1) => {
  if (!keywords.length) {
    return new Map();
  }

  const params = new URLSearchParams();
  params.set('country', COUNTRY);
  params.set('select', 'keyword,volume');
  params.set('keywords', keywords.join(','));

  const url = `${API_URL}?${params.toString()}`;

  const curlArgs = [
    '-fsS',
    '-H',
    `Authorization: Bearer ${apiKey}`,
    url,
  ];
  const curlCommand = `curl ${curlArgs
    .map((arg) => (arg.includes(' ') ? `'${arg.replace(/'/g, "'\\''")}'` : arg))
    .join(' ')}`;

  try {
    return await runWithRequestSpacing(async () => {
      debugLog(`  ↳ Attempt ${attempt}: GET ${url}`);
      if (DEBUG) {
        debugLog('    curl command:', curlCommand);
      }

      const { stdout } = await execFileAsync('curl', curlArgs);

      debugLog(`    ↳ Attempt ${attempt} succeeded (${stdout.length} bytes).`);

      const data = JSON.parse(stdout);
      const entries = Array.isArray(data.keywords) ? data.keywords : [];
      const result = new Map();

      entries.forEach((entry) => {
        if (entry && typeof entry.keyword === 'string') {
          const normalised = entry.keyword.trim().toLowerCase();
          if (!normalised) {
            return;
          }
          const volume =
            typeof entry.volume === 'number' && Number.isFinite(entry.volume)
              ? Math.max(0, Math.round(entry.volume))
              : 0;
          result.set(normalised, volume);
        }
      });

      return result;
    });
  } catch (error) {
    const stderr = error.stderr ? error.stderr.toString() : '';
    const message = stderr || error.message || 'Unknown error';
    if (DEBUG) {
      debugLog('    curl command (failure):', curlCommand);
      if (error.stdout) {
        debugLog('    stdout:', String(error.stdout).trim());
      }
      if (stderr) {
        debugLog('    stderr:', stderr.trim());
      }
    }
    throw new Error(message.trim());
  }
};

const fetchVolumesForKeywordsWithRetry = async (apiKey, keywords, attempt = 1) => {
  try {
    return await fetchVolumesForKeywords(apiKey, keywords, attempt);
  } catch (error) {
    debugLog(`    ↳ Attempt ${attempt} failed: ${error.message}`);
    if (attempt >= MAX_RETRIES) {
      throw error;
    }
    const delay = 500 * attempt;
    console.warn(
      `Request failed for ${keywords.join(', ')} (attempt ${attempt}): ${error.message}. Retrying in ${delay}ms...`,
    );
    if (DEBUG && error?.stderr) {
      debugLog('    stderr:', String(error.stderr).trim());
    }
    await sleep(delay);
    return fetchVolumesForKeywordsWithRetry(apiKey, keywords, attempt + 1);
  }
};

const searchVolumePathForSlug = (slug) => path.join(DATA_DIR, slug, SEARCH_VOLUME_FILENAME);

const writeSearchVolumeDataset = async (slug, dataset) => {
  await fs.mkdir(path.join(DATA_DIR, slug), { recursive: true });
  await fs.writeFile(searchVolumePathForSlug(slug), `${JSON.stringify(dataset, null, 2)}\n`);
};

async function main() {
  const { additiveSlugs, help, debug, limit, parallel, override } = parseArgs(process.argv);

  if (help) {
    printUsage();
    return;
  }

  DEBUG = debug;

  await loadEnvConfig({ debug });
  const apiKey = resolveAhrefsApiKey();
  if (!apiKey) {
    throw new Error('Missing Ahrefs API key. Set AHREFS_API_KEY in the environment or env.local.');
  }
  const additives = await readAdditivesIndex();
  const additiveEntries = additives.map((item) => ({
    additive: item,
    slug: createAdditiveSlug({ eNumber: item.eNumber, title: item.title }),
  }));
  const additiveMap = new Map(additiveEntries.map((entry) => [entry.slug, entry]));

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
      const entry = additiveMap.get(slug);
      if (!entry) {
        missing.push(slug);
        continue;
      }

      const props = await readProps(entry.slug, entry.additive);
      const hasExisting = await hasExistingSearchVolume(entry.slug, props);

      if (hasExisting && effectiveOverride) {
        console.log(`Refreshing existing search volume for ${entry.slug}.`);
      }

      if (hasExisting && !effectiveOverride) {
        if (DEBUG) {
          console.log(`Skipping existing search volume for ${entry.slug}.`);
        }
        skipped += 1;
        continue;
      }

      candidates.push({ slug: entry.slug, additive: entry.additive, props });
    }

    if (missing.length > 0) {
      console.warn(`⚠️  Unknown additive slugs: ${missing.join(', ')}`);
    }

    if (candidates.length === 0) {
      if (!DEBUG && skipped > 0) {
        console.log(`skipped: ${skipped}`);
      }
      console.log('No additives to process.');
      return;
    }
  } else {
    const resolvedLimit = limit ?? DEFAULT_LIMIT;

    for (const entry of additiveEntries) {
      const props = await readProps(entry.slug, entry.additive);
      const hasExisting = await hasExistingSearchVolume(entry.slug, props);
      if (hasExisting && !effectiveOverride) {
        if (DEBUG) {
          console.log(`Skipping existing search volume: ${entry.slug}`);
        }
        skipped += 1;
        continue;
      }

      if (hasExisting && effectiveOverride) {
        console.log(`Refreshing existing search volume for ${entry.slug}.`);
      }

      candidates.push({ slug: entry.slug, additive: entry.additive, props });
      if (Number.isFinite(resolvedLimit) && candidates.length >= resolvedLimit) {
        break;
      }
    }

    if (candidates.length === 0) {
      if (!DEBUG && skipped > 0) {
        console.log(`skipped: ${skipped}`);
      }
      console.log('No additives require search volume updates.');
      return;
    }
  }

  if (!DEBUG && skipped > 0) {
    console.log(`skipped: ${skipped}`);
  }

  const total = candidates.length;
  console.log(`Total additives to update: ${total}`);

  const parallelLimit = Math.max(1, Math.min(candidates.length, parallel ?? DEFAULT_PARALLEL));
  const results = new Array(total);
  let nextIndex = 0;

  const worker = async () => {
    while (true) {
      const currentIndex = nextIndex;
      if (currentIndex >= total) {
        return;
      }
      nextIndex += 1;

      const entry = candidates[currentIndex];
      const { slug, additive, props } = entry;
      const keywords = toKeywordList(props);
      const position = currentIndex + 1;
      const remaining = targeted ? null : total - position;
      const suffix = targeted ? '' : ` (${remaining} remaining)`;
      const keywordSummary = keywords.length > 0 ? keywords.join(', ') : 'none';

      console.log(
        `[${position}/${total}] ${slug} → ${keywords.length} keyword${
          keywords.length === 1 ? '' : 's'
        }: ${keywordSummary}${suffix}`,
      );

      if (DEBUG && keywords.length > 0) {
        keywords.forEach((keyword, keywordIndex) => {
          console.log(`    • [${keywordIndex + 1}] ${keyword}`);
        });
      }

      let keywordVolumes = null;
      let totalVolume = null;
      let fetchError = null;

      if (keywords.length > 0) {
        try {
          const volumeMap = await fetchVolumesForKeywordsWithRetry(apiKey, keywords);
          keywordVolumes = keywords.map((keyword) => {
            const normalised = keyword.trim().toLowerCase();
            const raw = volumeMap.has(normalised) ? volumeMap.get(normalised) : 0;
            const volume =
              typeof raw === 'number' && Number.isFinite(raw) && raw >= 0 ? Math.round(raw) : 0;
            return { keyword, volume };
          });
          totalVolume = keywordVolumes.reduce((acc, item) => acc + item.volume, 0);
        } catch (error) {
          console.error(`  → Failed to fetch volumes: ${error.message}`);
          if (DEBUG && error?.stderr) {
            debugLog('    stderr:', String(error.stderr).trim());
          }
          fetchError = error;
        }

        await sleep(REQUEST_DELAY_MS);
      }

      results[currentIndex] = {
        slug,
        props,
        keywordVolumes: Array.isArray(keywordVolumes)
          ? [...keywordVolumes].sort(
              (a, b) => b.volume - a.volume || a.keyword.localeCompare(b.keyword),
            )
          : null,
        totalVolume,
        error: fetchError,
        keywords,
      };
    }
  };

  await Promise.all(Array.from({ length: parallelLimit }, () => worker()));

  await Promise.all(
    results.map(async (entry) => {
      if (entry.error) {
        console.warn(`⚠️  Skipping ${entry.slug} due to previous errors.`);
        return;
      }

      const dataset = {
        totalSearchVolume: entry.totalVolume ?? 0,
        keywords: entry.keywordVolumes ?? [],
      };

      await writeSearchVolumeDataset(entry.slug, dataset);

      if (DEBUG) {
        const relativeDatasetPath = path.relative(process.cwd(), searchVolumePathForSlug(entry.slug));
        console.log(`  → Saved search volume dataset in ${relativeDatasetPath}.`);
      }
    }),
  );

  const failures = results.filter((entry) => entry.error);

  if (failures.length > 0) {
    console.error(`Encountered errors for ${failures.length} additive(s).`);
    failures.forEach((entry) => {
      console.error(`  • ${entry.slug}: ${entry.error.message}`);
    });
    process.exitCode = 1;
  } else {
    console.log('Search volume datasets updated successfully.');
  }
}

main().catch((error) => {
  if (error?.message) {
    console.error(error.message);
  } else {
    console.error(error);
  }
  process.exitCode = 1;
});
