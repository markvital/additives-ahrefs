#!/usr/bin/env node

const fs = require('fs/promises');
const path = require('path');
const { execFile } = require('child_process');
const { promisify } = require('util');

const { createAdditiveSlug } = require('./utils/slug');
const { collectAdditiveKeywords } = require('./utils/keywords');

const execFileAsync = promisify(execFile);

const API_BASE_URL = 'https://api.ahrefs.com/v3/keywords-explorer/volume-history';
const DATA_DIR = path.join(__dirname, '..', 'data');
const ADDITIVES_PATH = path.join(DATA_DIR, 'additives.json');

const API_TOKEN =
  process.env.AHREFS_API_KEY ||
  process.env.AHREFS_API_TOKEN ||
  process.env.AHREFS_TOKEN ||
  'ktGhsM5um6O9vQFyYtUTiLd-Vd1MLZah-3etMqHF';

const REQUEST_DELAY_MS = 200;
const MAX_ATTEMPTS = 5;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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
    limit: null,
    help: false,
  };

  let index = 0;

  while (index < args.length) {
    const arg = args[index];

    if (arg === '--help' || arg === '-h' || arg === '-help') {
      result.help = true;
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

    if (arg === '--additive' || arg === '-a' || arg === '-additive') {
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

  result.additiveSlugs = Array.from(
    new Set(
      result.additiveSlugs
        .map((slug) => slug.trim().toLowerCase())
        .filter(Boolean),
    ),
  );

  return result;
};

const printUsage = () => {
  console.log(
    `Usage: node fetch-search-history.js [options]\n\n` +
      `Options:\n` +
      `  --additive <slug...>          Fetch history for the specified additive slugs.\n` +
      `  --additive=<slug,slug>        Same as above using a comma separated list.\n` +
      `  --limit, -n <number>          Process at most <number> additives.\n` +
      `  --help                        Show this message.\n` +
      `\n` +
      `Examples:\n` +
      `  node scripts/fetch-search-history.js\n` +
      `  node scripts/fetch-search-history.js --limit 5\n` +
      `  node scripts/fetch-search-history.js --additive e500ii-sodium-hydrogen-carbonate\n`,
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

async function readProps(slug) {
  try {
    const raw = await fs.readFile(propsPathForSlug(slug), 'utf8');
    return JSON.parse(raw);
  } catch (error) {
    return null;
  }
}

async function writeProps(slug, props) {
  await fs.mkdir(path.join(DATA_DIR, slug), { recursive: true });
  await fs.writeFile(propsPathForSlug(slug), `${JSON.stringify(props, null, 2)}\n`);
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
    result.searchVolume = null;
  }
  if (typeof result.searchRank !== 'number') {
    result.searchRank = null;
  }
  if (!Array.isArray(result.searchSparkline)) {
    result.searchSparkline = [];
  }

  return result;
};

async function fetchHistory(keyword) {
  const baseArgs = [
    '-fsS',
    '-H',
    `Authorization: Bearer ${API_TOKEN}`,
    '--get',
    '--data-urlencode',
    `keyword=${keyword}`,
    '--data-urlencode',
    'country=us',
    API_BASE_URL,
  ];

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
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

      if (attempt === MAX_ATTEMPTS) {
        throw error;
      }

      await sleep(250 * attempt);
    }
  }

  return null;
}

function filterLastTenYears(metrics) {
  if (!Array.isArray(metrics)) {
    return [];
  }

  const now = new Date();
  const startYear = now.getUTCFullYear() - 9;
  const endYear = now.getUTCFullYear();
  const startDate = new Date(Date.UTC(startYear, 0, 1));
  const endDate = new Date(Date.UTC(endYear, 11, 31, 23, 59, 59));

  return metrics
    .map((entry) => ({
      date: entry.date,
      volume: typeof entry.volume === 'number' ? entry.volume : 0,
    }))
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

const normaliseMetricDate = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date.toISOString();
};

const aggregateKeywordMetrics = (keywordMetrics) => {
  const totals = new Map();

  keywordMetrics.forEach((metrics) => {
    metrics.forEach((entry) => {
      const normalisedDate = normaliseMetricDate(entry.date);
      if (!normalisedDate) {
        return;
      }

      const volume = typeof entry.volume === 'number' && Number.isFinite(entry.volume)
        ? Math.max(0, Math.round(entry.volume))
        : 0;

      totals.set(normalisedDate, (totals.get(normalisedDate) ?? 0) + volume);
    });
  });

  return Array.from(totals.entries())
    .map(([date, volume]) => ({ date, volume }))
    .sort((a, b) => new Date(a.date) - new Date(b.date));
};

const createHistoryDataset = (keywords, metrics) => ({
  keywords,
  country: 'us',
  fetchedAt: new Date().toISOString(),
  metrics,
});

async function main() {
  const options = parseArgs(process.argv);

  if (options.help) {
    printUsage();
    return;
  }

  if (!API_TOKEN) {
    throw new Error('Missing Ahrefs API token. Set AHREFS_API_KEY or related env variable.');
  }

  const additives = await readAdditivesIndex();
  const enrichedAdditives = additives.map((item) => ({
    ...item,
    slug: createAdditiveSlug({ eNumber: item.eNumber, title: item.title }),
  }));

  let targets = enrichedAdditives;

  if (options.additiveSlugs.length > 0) {
    const slugSet = new Set(options.additiveSlugs);
    targets = enrichedAdditives.filter((entry) => slugSet.has(entry.slug));

    const missing = options.additiveSlugs.filter(
      (slug) => !targets.some((entry) => entry.slug === slug),
    );
    if (missing.length > 0) {
      console.warn(`⚠️  Unknown additive slugs: ${missing.join(', ')}`);
    }
  }

  if (options.limit !== null && Number.isFinite(options.limit)) {
    targets = targets.slice(0, options.limit);
  }

  if (targets.length === 0) {
    console.log('No additives to process.');
    return;
  }

  const total = targets.length;
  let processed = 0;

  for (const additive of targets) {
    processed += 1;
    const slug = additive.slug;
    const dirPath = path.join(DATA_DIR, slug);
    await fs.mkdir(dirPath, { recursive: true });
    const historyPath = historyPathForSlug(slug);

    try {
      console.log(`[${processed}/${total}] ${slug}`);

      const props = ensureProps(await readProps(slug), additive);
      const keywords = collectAdditiveKeywords(additive, props);

      if (keywords.length === 0) {
        console.log('  → No keywords available.');
        props.searchSparkline = [];
        await writeProps(slug, props);
        const dataset = createHistoryDataset([], []);
        await fs.writeFile(historyPath, `${JSON.stringify(dataset, null, 2)}\n`);
        continue;
      }

      console.log(`  → Fetching data for ${keywords.length} keywords.`);

      const keywordMetrics = [];
      for (const keyword of keywords) {
        try {
          const payload = await fetchHistory(keyword);
          await sleep(REQUEST_DELAY_MS);

          if (!payload || !Array.isArray(payload.metrics) || payload.metrics.length === 0) {
            console.log(`    · ${keyword}: no data`);
            continue;
          }

          const filtered = filterLastTenYears(payload.metrics);
          if (filtered.length === 0) {
            console.log(`    · ${keyword}: no recent data`);
            continue;
          }

          keywordMetrics.push(filtered);
          console.log(`    · ${keyword}: ${filtered.length} points`);
        } catch (error) {
          const message = error.message ? error.message.trim() : 'Unknown error';
          console.error(`    · ${keyword}: failed (${message})`);
          await sleep(REQUEST_DELAY_MS);
        }
      }

      const aggregatedMetrics = aggregateKeywordMetrics(keywordMetrics);
      const metrics = filterLastTenYears(aggregatedMetrics);
      const sparkline = computeYearlyAverage(metrics);

      const dataset = createHistoryDataset(keywords, metrics);
      await fs.writeFile(historyPath, `${JSON.stringify(dataset, null, 2)}\n`);

      props.searchSparkline = sparkline;
      await writeProps(slug, props);

      console.log(`  → Saved ${metrics.length} data points.`);
    } catch (error) {
      console.error(`  → Failed: ${error.message}`);
    }
  }

  console.log(`Completed fetching history for ${processed} additives.`);
}

main().catch((error) => {
  console.error('Failed to fetch search history:', error);
  process.exit(1);
});
