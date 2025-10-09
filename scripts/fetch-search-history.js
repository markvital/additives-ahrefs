#!/usr/bin/env node

const fs = require('fs/promises');
const path = require('path');
const { execFile } = require('child_process');
const { promisify } = require('util');

const { createAdditiveSlug } = require('./utils/slug');
const { toKeywordList } = require('./utils/keywords');
const { loadEnvConfig, resolveAhrefsApiKey } = require('./utils/env');

const execFileAsync = promisify(execFile);

const API_BASE_URL = 'https://api.ahrefs.com/v3/keywords-explorer/volume-history';
const DATA_DIR = path.join(__dirname, '..', 'data');
const ADDITIVES_PATH = path.join(DATA_DIR, 'additives.json');

const REQUEST_DELAY_MS = 200;
const MAX_ATTEMPTS = 2;
const COUNTRY = 'us';
const DEFAULT_PARALLEL = 10;
const DEFAULT_LIMIT = Infinity;

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
    `Usage: node scripts/fetch-search-history.js [options]\n` +
      `\n` +
      `Options:\n` +
      `  --additive <slug...>     Only fetch history for the specified additive slugs.\n` +
      `  --additive=<slug,slug>   Same as above using a comma separated list.\n` +
      `  --limit <n>              Process at most <n> additives (default: unlimited).\n` +
      `  --parallel <n>           Run up to <n> additives in parallel (default: ${DEFAULT_PARALLEL}).\n` +
      `  --override               Re-fetch data even if it already exists.\n` +
      `  --debug                  Enable verbose logging.\n` +
      `  --help                   Show this message.\n`,
  );
};

async function readAdditivesIndex() {
  const raw = await fs.readFile(ADDITIVES_PATH, 'utf8');
  const data = JSON.parse(raw);
  if (!Array.isArray(data.additives)) {
    throw new Error('Unexpected additives index format.');
  }
  return data.additives;
}

const propsPathForSlug = (slug) => path.join(DATA_DIR, slug, 'props.json');
const HISTORY_FILENAME = 'searchHistory.json';
const FULL_HISTORY_FILENAME = 'searchHistoryFull.json';

const historyPathForSlug = (slug) => path.join(DATA_DIR, slug, HISTORY_FILENAME);
const fullHistoryPathForSlug = (slug) => path.join(DATA_DIR, slug, FULL_HISTORY_FILENAME);

async function readProps(slug, fallback) {
  try {
    const raw = await fs.readFile(propsPathForSlug(slug), 'utf8');
    const data = JSON.parse(raw);
    return ensureProps(data, fallback);
  } catch (error) {
    return ensureProps(null, fallback);
  }
}

const ensureProps = (props, additive) => {
  const result = props && typeof props === 'object' ? { ...props } : {};

  if (typeof result.title !== 'string') {
    result.title = additive.title || '';
  }
  if (typeof result.eNumber !== 'string') {
    result.eNumber = additive.eNumber || '';
  }
  if (!Array.isArray(result.synonyms)) {
    result.synonyms = [];
  }
  if (!Array.isArray(result.functions)) {
    result.functions = [];
  }
  if (!Array.isArray(result.origin)) {
    result.origin = [];
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
  if (typeof result.productCount !== 'number') {
    result.productCount = null;
  }

  return result;
};

async function writeProps(slug, props) {
  await fs.mkdir(path.join(DATA_DIR, slug), { recursive: true });
  await fs.writeFile(propsPathForSlug(slug), `${JSON.stringify(props, null, 2)}\n`);
}

async function hasExistingHistory(slug, props) {
  if (await fileExists(historyPathForSlug(slug))) {
    return true;
  }

  if (props && Array.isArray(props.searchSparkline) && props.searchSparkline.length > 0) {
    return true;
  }

  try {
    const raw = await fs.readFile(propsPathForSlug(slug), 'utf8');
    const data = JSON.parse(raw);
    if (Array.isArray(data.searchSparkline) && data.searchSparkline.length > 0) {
      return true;
    }
  } catch (error) {
    // ignore
  }

  return false;
}

async function fetchHistory(keyword, apiToken) {
  const requestUrl = new URL(API_BASE_URL);
  requestUrl.searchParams.set('keyword', keyword);
  requestUrl.searchParams.set('country', COUNTRY);

  const baseArgs = [
    '-fsS',
    '-H',
    `Authorization: Bearer ${apiToken}`,
    '--get',
    '--data-urlencode',
    `keyword=${keyword}`,
    '--data-urlencode',
    `country=${COUNTRY}`,
    API_BASE_URL,
  ];

  const curlCommand = `curl ${baseArgs
    .map((arg) => (arg.includes(' ') ? `'${arg.replace(/'/g, "'\\''")}'` : arg))
    .join(' ')}`;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      debugLog(`  ↳ Attempt ${attempt}: GET ${requestUrl.toString()}`);
      if (DEBUG) {
        debugLog('    curl command:', curlCommand);
      }
      const { stdout } = await execFileAsync('curl', baseArgs);
      return JSON.parse(stdout);
    } catch (error) {
      const stderr = error.stderr ? error.stderr.toString() : '';
      if (stderr.includes('404')) {
        return null;
      }

      console.error(
        `Failed to fetch history for "${keyword}" (attempt ${attempt}): ${error.message.trim()}`,
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

  return null;
}

const sanitiseMetrics = (metrics) => {
  if (!Array.isArray(metrics)) {
    return [];
  }

  return metrics
    .map((entry) => ({
      date: entry?.date,
      volume:
        typeof entry?.volume === 'number' && Number.isFinite(entry.volume)
          ? Math.max(0, Math.round(entry.volume))
          : 0,
    }))
    .filter((entry) => typeof entry.date === 'string' && entry.date.trim().length > 0);
};

function filterLastTenYears(metrics) {
  const sanitised = sanitiseMetrics(metrics);
  if (!sanitised.length) {
    return [];
  }

  const now = new Date();
  const startYear = now.getUTCFullYear() - 9;
  const endYear = now.getUTCFullYear();
  const startDate = new Date(Date.UTC(startYear, 0, 1));
  const endDate = new Date(Date.UTC(endYear, 11, 31, 23, 59, 59));

  return sanitised
    .filter((entry) => {
      const entryDate = new Date(entry.date);
      return (
        !Number.isNaN(entryDate.getTime()) &&
        entryDate >= startDate &&
        entryDate <= endDate
      );
    })
    .sort((a, b) => new Date(a.date) - new Date(b.date));
}

function computeYearlyAverage(metrics) {
  if (!metrics.length) {
    return [];
  }

  const now = new Date();
  const startYear = now.getUTCFullYear() - 9;
  const endYear = now.getUTCFullYear();
  const result = [];

  for (let year = startYear; year <= endYear; year += 1) {
    const points = metrics.filter((entry) => new Date(entry.date).getUTCFullYear() === year);
    if (points.length === 0) {
      result.push(null);
      continue;
    }

    const sum = points.reduce((acc, entry) => acc + entry.volume, 0);
    result.push(Math.round(sum / points.length));
  }

  return result;
}

const aggregateKeywordMetrics = (series) => {
  const dateMap = new Map();

  series.forEach((entry) => {
    if (!entry || !Array.isArray(entry.metrics)) {
      return;
    }
    entry.metrics.forEach((point) => {
      const key = point.date;
      if (!key) {
        return;
      }
      const current = dateMap.get(key) ?? 0;
      dateMap.set(key, current + (typeof point.volume === 'number' ? point.volume : 0));
    });
  });

  return Array.from(dateMap.entries())
    .map(([date, volume]) => ({ date, volume }))
    .sort((a, b) => new Date(a.date) - new Date(b.date));
};

async function main() {
  const { additiveSlugs, help, debug, limit, parallel, override } = parseArgs(process.argv);

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
  const additiveEntries = additives.map((entry) => ({
    additive: entry,
    slug: createAdditiveSlug({ eNumber: entry.eNumber, title: entry.title }),
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
      const hasExisting = await hasExistingHistory(entry.slug, props);

      if (hasExisting && effectiveOverride) {
        console.log(`Refreshing existing search history for ${entry.slug}.`);
      }

      if (hasExisting && !effectiveOverride) {
        if (DEBUG) {
          console.log(`Skipping existing search history for ${entry.slug}.`);
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
      const hasExisting = await hasExistingHistory(entry.slug, props);
      if (hasExisting && !effectiveOverride) {
        if (DEBUG) {
          console.log(`Skipping existing search history: ${entry.slug}`);
        }
        skipped += 1;
        continue;
      }

      if (hasExisting && effectiveOverride) {
        console.log(`Refreshing existing search history for ${entry.slug}.`);
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
      console.log('No additives require new search history.');
      return;
    }
  }

  if (!DEBUG && skipped > 0) {
    console.log(`skipped: ${skipped}`);
  }

  const total = candidates.length;
  console.log(`Total additives to process: ${total}`);

  const parallelLimit = Math.max(1, Math.min(candidates.length, parallel ?? DEFAULT_PARALLEL));
  const failures = [];
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

      const dirPath = path.join(DATA_DIR, slug);
      await fs.mkdir(dirPath, { recursive: true });
      const historyPath = historyPathForSlug(slug);

      try {
        if (keywords.length === 0) {
          console.warn('  → Skipping (unable to determine keywords).');
          continue;
        }

        const keywordSeries = [];

        for (const keyword of keywords) {
          const payload = await fetchHistory(keyword, apiToken);
          await sleep(REQUEST_DELAY_MS);

          if (!payload || !Array.isArray(payload.metrics) || payload.metrics.length === 0) {
            keywordSeries.push({ keyword, metrics: [] });
            continue;
          }

          const filteredMetrics = filterLastTenYears(payload.metrics);
          keywordSeries.push({ keyword, metrics: filteredMetrics });
        }

        const aggregateMetrics = aggregateKeywordMetrics(keywordSeries);
        const sparkline = computeYearlyAverage(aggregateMetrics);

        const totalKeywordMetrics = keywordSeries.reduce(
          (acc, entry) => acc + (Array.isArray(entry.metrics) ? entry.metrics.length : 0),
          0,
        );

        if (DEBUG) {
          console.log(
            `    • Aggregated ${totalKeywordMetrics} keyword metrics into ${aggregateMetrics.length} total data points for history.`,
          );
          console.log(
            `    • Aggregated ${aggregateMetrics.length} history entries into ${sparkline.length} sparkline data points.`,
          );
        }

        const aggregatedPayload = {
          country: COUNTRY,
          fetchedAt: new Date().toISOString(),
          metrics: aggregateMetrics,
          sparkline,
        };

        await fs.writeFile(historyPath, `${JSON.stringify(aggregatedPayload, null, 2)}\n`);

        if (DEBUG) {
          const relativeHistoryPath = path.relative(process.cwd(), historyPath);
          console.log(`  → Saved search history in ${relativeHistoryPath}.`);
        }

        const fullHistoryPath = fullHistoryPathForSlug(slug);
        const fullPayload = {
          country: aggregatedPayload.country,
          fetchedAt: aggregatedPayload.fetchedAt,
          keywords: keywordSeries,
        };

        await fs.writeFile(fullHistoryPath, `${JSON.stringify(fullPayload, null, 2)}\n`);

        if (DEBUG) {
          const relativeFullPath = path.relative(process.cwd(), fullHistoryPath);
          console.log(`  → Saved full keyword history in ${relativeFullPath}.`);
        }
    } catch (error) {
      console.error(`Error processing ${additive.title}: ${error.message}`);
      if (DEBUG && error?.stderr) {
        debugLog('  ↳ stderr:', String(error.stderr).trim());
      }
        failures.push({ slug, error });
      }
    }
  };

  await Promise.all(Array.from({ length: parallelLimit }, () => worker()));

  const successful = total - failures.length;
  console.log(`Completed fetching history for ${successful} of ${total} additives.`);
  if (failures.length > 0) {
    failures.forEach((entry) => {
      console.error(`  • ${entry.slug}: ${entry.error.message}`);
    });
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error('Failed to fetch search history:', error);
  process.exit(1);
});
