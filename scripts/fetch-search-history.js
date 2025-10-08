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
const MAX_ATTEMPTS = 5;
const COUNTRY = 'us';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

let DEBUG = false;
const debugLog = (...args) => {
  if (DEBUG) {
    console.log(...args);
  }
};

const parseArgs = (argv) => {
  const result = {
    additiveSlugs: [],
    help: false,
    debug: false,
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
    'Usage: node scripts/fetch-search-history.js [options]\n' +
      '\n' +
      'Options:\n' +
      '  --additive <slug...>     Only fetch history for the specified additive slugs.\n' +
      '  --additive=<slug,slug>   Same as above using a comma separated list.\n' +
      '  --debug                  Enable verbose logging.\n' +
      '  --help                   Show this message.\n',
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
const historyPathForSlug = (slug) => path.join(DATA_DIR, slug, 'searchHistory.json');

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
  if (typeof result.searchVolume !== 'number') {
    result.searchVolume = result.searchVolume ?? null;
  }
  if (typeof result.searchRank !== 'number') {
    result.searchRank = result.searchRank ?? null;
  }
  if (!Array.isArray(result.searchSparkline)) {
    result.searchSparkline = [];
  }

  return result;
};

async function writeProps(slug, props) {
  await fs.mkdir(path.join(DATA_DIR, slug), { recursive: true });
  await fs.writeFile(propsPathForSlug(slug), `${JSON.stringify(props, null, 2)}\n`);
}

async function fetchHistory(keyword, apiToken) {
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

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      debugLog('  ↳ Fetching history for keyword:', keyword);
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

      if (DEBUG && stderr) {
        debugLog('    stderr:', stderr.trim());
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
  const { additiveSlugs, help, debug } = parseArgs(process.argv);

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

  let targets = additives;
  if (additiveSlugs.length > 0) {
    const slugSet = new Set(additiveSlugs);
    targets = additives.filter((entry) => {
      const slug = createAdditiveSlug({ eNumber: entry.eNumber, title: entry.title });
      return slugSet.has(slug);
    });

    const missing = additiveSlugs.filter((slug) => {
      const match = targets.some((entry) => {
        const derived = createAdditiveSlug({ eNumber: entry.eNumber, title: entry.title });
        return derived === slug;
      });
      return !match;
    });

    if (missing.length > 0) {
      console.warn(`⚠️  Unknown additive slugs: ${missing.join(', ')}`);
    }

    if (targets.length === 0) {
      console.warn('No additives to process.');
      return;
    }
  }

  const total = targets.length;
  let processed = 0;

  const failures = [];

  for (const additive of targets) {
    processed += 1;
    const slug = createAdditiveSlug({ eNumber: additive.eNumber, title: additive.title });
    const dirPath = path.join(DATA_DIR, slug);
    await fs.mkdir(dirPath, { recursive: true });
    const historyPath = historyPathForSlug(slug);

    const props = await readProps(slug, additive);

    try {
      const keywords = toKeywordList(props);

      console.log(
        `[${processed}/${total}] ${slug} → ${keywords.length} keyword${
          keywords.length === 1 ? '' : 's'
        }`,
      );

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

      const dataset = {
        country: COUNTRY,
        fetchedAt: new Date().toISOString(),
        keywords: keywordSeries,
        metrics: aggregateMetrics,
      };

      await fs.writeFile(historyPath, `${JSON.stringify(dataset, null, 2)}\n`);

      const updatedProps = ensureProps(props, additive);
      updatedProps.searchSparkline = sparkline;
      await writeProps(slug, updatedProps);
    } catch (error) {
      console.error(`Error processing ${additive.title}: ${error.message}`);
      if (DEBUG && error?.stderr) {
        debugLog('  ↳ stderr:', String(error.stderr).trim());
      }
      failures.push({ slug, error });
    }
  }

  const successful = processed - failures.length;
  console.log(`Completed fetching history for ${successful} of ${processed} additives.`);
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
