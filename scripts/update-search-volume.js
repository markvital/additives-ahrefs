#!/usr/bin/env node

/**
 * Fetches Ahrefs Keywords Explorer search volume data for each additive
 * and updates the per-additive `props.json` file with `searchVolume` and
 * `searchRank` properties.
 */

const fs = require('fs/promises');
const path = require('path');
const { execFile } = require('child_process');
const { promisify } = require('util');

const { createAdditiveSlug } = require('./utils/slug');
const { collectAdditiveKeywords } = require('./utils/keywords');

const execFileAsync = promisify(execFile);

const DATA_DIR = path.join(__dirname, '..', 'data');
const ADDITIVES_INDEX_PATH = path.join(DATA_DIR, 'additives.json');
const API_URL = 'https://api.ahrefs.com/v3/keywords-explorer/overview';
const COUNTRY = 'us';
const MAX_CONCURRENCY = 3;
const MAX_RETRIES = 3;
const KEYWORD_BATCH_SIZE = 10;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const getApiKey = () => {
  const envKeys = ['AHREFS_API_KEY', 'AHREFS_API_TOKEN', 'AHREFS_TOKEN'];

  for (const key of envKeys) {
    const value = process.env[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }

  throw new Error('Missing Ahrefs API token. Set AHREFS_API_KEY (or related) in the environment.');
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
  if (typeof result.searchVolume !== 'number') {
    result.searchVolume = null;
  }
  if (typeof result.searchRank !== 'number') {
    result.searchRank = null;
  }

  return result;
};

const writeProps = async (slug, props) => {
  await fs.mkdir(path.join(DATA_DIR, slug), { recursive: true });
  await fs.writeFile(propsPathForSlug(slug), `${JSON.stringify(props, null, 2)}\n`);
};

const chunkArray = (items, size) => {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
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
    `Usage: node update-search-volume.js [options]\n\n` +
      `Options:\n` +
      `  --additive <slug...>          Process only the specified additive slugs.\n` +
      `  --additive=<slug,slug>        Same as above using a comma separated list.\n` +
      `  --limit, -n <number>          Process at most <number> additives.\n` +
      `  --help                        Show this message.\n` +
      `\n` +
      `Examples:\n` +
      `  node scripts/update-search-volume.js\n` +
      `  node scripts/update-search-volume.js --limit 5\n` +
      `  node scripts/update-search-volume.js --additive e500ii-sodium-hydrogen-carbonate\n`,
  );
};

const createKeywordBatchRequest = async (apiKey, keywords) => {
  const params = new URLSearchParams();
  params.set('country', COUNTRY);
  params.set('select', 'keyword,volume');
  params.set('keywords', keywords.join(','));

  const url = `${API_URL}?${params.toString()}`;

  try {
    const { stdout } = await execFileAsync('curl', [
      '-fsS',
      '-H',
      `Authorization: Bearer ${apiKey}`,
      url,
    ]);

    const payload = JSON.parse(stdout);
    const entries = Array.isArray(payload?.keywords) ? payload.keywords : [];
    const result = new Map();

    entries.forEach((entry) => {
      if (entry && typeof entry.keyword === 'string') {
        const normalised = entry.keyword.trim().toLowerCase();
        const volume = typeof entry.volume === 'number' && Number.isFinite(entry.volume)
          ? Math.max(0, Math.round(entry.volume))
          : 0;
        result.set(normalised, volume);
      }
    });

    return result;
  } catch (error) {
    const stderr = error.stderr ? error.stderr.toString() : '';
    const message = stderr || error.message || 'Unknown error';
    throw new Error(message.trim());
  }
};

const fetchKeywordBatchWithRetry = async (apiKey, keywords, attempt = 1) => {
  try {
    return await createKeywordBatchRequest(apiKey, keywords);
  } catch (error) {
    if (attempt >= MAX_RETRIES) {
      throw error;
    }

    const delay = 500 * attempt;
    console.warn(
      `Keyword batch failed (attempt ${attempt}): ${error.message}. Retrying in ${delay}ms...`,
    );
    await sleep(delay);
    return fetchKeywordBatchWithRetry(apiKey, keywords, attempt + 1);
  }
};

const fetchKeywordVolumes = async (apiKey, keywords) => {
  const uniqueKeywords = keywords
    .map((keyword) => keyword.trim())
    .filter((keyword, index, list) => keyword.length > 0 && list.indexOf(keyword) === index);

  if (uniqueKeywords.length === 0) {
    return [];
  }

  const keywordIndex = uniqueKeywords.map((keyword) => ({
    keyword,
    normalised: keyword.toLowerCase(),
  }));

  const batches = chunkArray(keywordIndex, KEYWORD_BATCH_SIZE);
  const volumeMap = new Map();

  for (const batch of batches) {
    const batchKeywords = batch.map((entry) => entry.keyword);
    const batchResult = await fetchKeywordBatchWithRetry(apiKey, batchKeywords);
    batch.forEach((entry) => {
      if (!volumeMap.has(entry.normalised) && batchResult.has(entry.normalised)) {
        volumeMap.set(entry.normalised, batchResult.get(entry.normalised) ?? 0);
      }
    });
  }

  return keywordIndex.map((entry) => ({
    keyword: entry.keyword,
    volume: volumeMap.has(entry.normalised) ? volumeMap.get(entry.normalised) ?? 0 : 0,
  }));
};

const searchVolumePathForSlug = (slug) => path.join(DATA_DIR, slug, 'searchVolume.json');

const writeSearchVolumeDataset = async (slug, dataset) => {
  await fs.mkdir(path.join(DATA_DIR, slug), { recursive: true });
  await fs.writeFile(searchVolumePathForSlug(slug), `${JSON.stringify(dataset, null, 2)}\n`);
};

const createSearchVolumeDataset = (keywordVolumes) => {
  const keywords = keywordVolumes
    .map((entry) => ({
      keyword: entry.keyword,
      volume: Math.max(0, Math.round(entry.volume || 0)),
    }))
    .sort((a, b) => b.volume - a.volume);

  const totalSearchVolume = keywords.reduce((acc, entry) => acc + entry.volume, 0);

  return {
    country: COUNTRY,
    fetchedAt: new Date().toISOString(),
    totalSearchVolume,
    keywords,
  };
};

const assignRanks = (volumes) => {
  const sorted = volumes
    .filter((item) => typeof item.volume === 'number' && item.volume > 0)
    .sort((a, b) => (b.volume ?? 0) - (a.volume ?? 0));

  const rankMap = new Map();
  sorted.forEach((item, index) => {
    rankMap.set(item.slug, index + 1);
  });
  return rankMap;
};

async function main() {
  const options = parseArgs(process.argv);

  if (options.help) {
    printUsage();
    return;
  }

  const apiKey = getApiKey();
  const additives = await readAdditivesIndex();

  const enrichedAdditives = additives.map((item) => ({
    ...item,
    slug: createAdditiveSlug({ eNumber: item.eNumber, title: item.title }),
  }));

  let targets = enrichedAdditives;

  if (options.additiveSlugs.length > 0) {
    const slugSet = new Set(options.additiveSlugs);
    targets = enrichedAdditives.filter((item) => slugSet.has(item.slug));

    const missing = options.additiveSlugs.filter(
      (slug) => !targets.some((item) => item.slug === slug),
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

  console.log(`Processing ${targets.length} additives.`);

  const results = new Array(targets.length);
  let cursor = 0;
  let processed = 0;

  const worker = async () => {
    while (cursor < targets.length) {
      const currentIndex = cursor;
      cursor += 1;

      if (currentIndex >= targets.length) {
        break;
      }

      const additive = targets[currentIndex];
      const slug = additive.slug;

      try {
        const props = await readProps(slug, additive);
        const keywords = collectAdditiveKeywords(additive, props);

        if (keywords.length === 0) {
          console.log(`[${processed + 1}/${targets.length}] ${slug} – no keywords`);
          results[currentIndex] = {
            additive,
            slug,
            props,
            keywordVolumes: [],
            totalVolume: null,
            dataset: createSearchVolumeDataset([]),
          };
          processed += 1;
          continue;
        }

        const keywordVolumes = await fetchKeywordVolumes(apiKey, keywords);
        const dataset = createSearchVolumeDataset(keywordVolumes);
        const totalVolume = dataset.totalSearchVolume;

        console.log(
          `[${processed + 1}/${targets.length}] ${slug} – fetched ${keywordVolumes.length} keywords`,
        );

        results[currentIndex] = {
          additive,
          slug,
          props,
          keywordVolumes,
          totalVolume,
          dataset,
        };
        processed += 1;
      } catch (error) {
        console.error(`Failed to process ${slug}: ${error.message}`);
        const props = await readProps(slug, additive);
        results[currentIndex] = {
          additive,
          slug,
          props,
          keywordVolumes: [],
          totalVolume: null,
          dataset: null,
          error,
        };
        processed += 1;
      }
    }
  };

  const workerCount = Math.min(MAX_CONCURRENCY, targets.length);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));

  const rankMap = assignRanks(
    results.map((entry) => ({ slug: entry.slug, volume: entry.totalVolume ?? null })),
  );

  await Promise.all(
    results.map(async (entry) => {
      if (entry.error) {
        console.warn(`Skipping ${entry.slug} due to previous error.`);
        return;
      }

      const { slug, props, totalVolume, dataset } = entry;
      const hasVolume = typeof totalVolume === 'number' && totalVolume > 0;
      props.searchVolume = hasVolume ? totalVolume : null;
      props.searchRank = hasVolume && rankMap.has(slug) ? rankMap.get(slug) ?? null : null;

      await writeProps(slug, props);
      if (dataset) {
        await writeSearchVolumeDataset(slug, dataset);
      }
    }),
  );

  console.log('Search volume data updated successfully.');
}

main().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});
