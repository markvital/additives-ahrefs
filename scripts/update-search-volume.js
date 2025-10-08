#!/usr/bin/env node

/**
 * Fetches Ahrefs Keywords Explorer search volume data for each additive
 * and updates the per-additive `props.json` file with aggregated
 * `searchVolume` and `searchRank` properties. The per-additive
 * `searchVolume.json` file stores the keyword level breakdown.
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
const MAX_CONCURRENCY = 3;
const MAX_RETRIES = 3;
const REQUEST_DELAY_MS = 200;
const SEARCH_VOLUME_FILENAME = 'searchVolume.json';

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
    'Usage: node scripts/update-search-volume.js [options]\n' +
      '\n' +
      'Options:\n' +
      '  --additive <slug...>     Only update the specified additive slugs.\n' +
      '  --additive=<slug,slug>   Same as above using a comma separated list.\n' +
      '  --debug                  Enable verbose logging.\n' +
      '  --help                   Show this message.\n',
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

const fetchVolumesForKeywords = async (apiKey, keywords) => {
  if (!keywords.length) {
    return new Map();
  }

  const params = new URLSearchParams();
  params.set('country', COUNTRY);
  params.set('select', 'keyword,volume');
  params.set('keywords', keywords.join(','));

  const url = `${API_URL}?${params.toString()}`;

  try {
    debugLog('  ↳ Requesting volumes with URL:', url);
    const { stdout } = await execFileAsync('curl', [
      '-fsS',
      '-H',
      `Authorization: Bearer ${apiKey}`,
      url,
    ]);

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
  } catch (error) {
    const stderr = error.stderr ? error.stderr.toString() : '';
    const message = stderr || error.message || 'Unknown error';
    throw new Error(message.trim());
  }
};

const fetchVolumesForKeywordsWithRetry = async (apiKey, keywords, attempt = 1) => {
  try {
    return await fetchVolumesForKeywords(apiKey, keywords);
  } catch (error) {
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

const assignRanks = (items) => {
  const sorted = items
    .filter((item) => typeof item.volume === 'number' && item.volume > 0)
    .sort((a, b) => b.volume - a.volume);

  const rankMap = new Map();
  sorted.forEach((item, index) => {
    rankMap.set(item.slug, index + 1);
  });
  return rankMap;
};

const searchVolumePathForSlug = (slug) => path.join(DATA_DIR, slug, SEARCH_VOLUME_FILENAME);

const writeSearchVolumeDataset = async (slug, dataset) => {
  await fs.mkdir(path.join(DATA_DIR, slug), { recursive: true });
  await fs.writeFile(searchVolumePathForSlug(slug), `${JSON.stringify(dataset, null, 2)}\n`);
};

async function main() {
  const { additiveSlugs, help, debug } = parseArgs(process.argv);

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

  let targets = additives;
  if (additiveSlugs.length > 0) {
    const slugSet = new Set(additiveSlugs);
    targets = additives.filter((item) => {
      const slug = createAdditiveSlug({ eNumber: item.eNumber, title: item.title });
      return slugSet.has(slug);
    });

    const missing = additiveSlugs.filter((slug) => {
      const match = targets.some((item) => {
        const derived = createAdditiveSlug({ eNumber: item.eNumber, title: item.title });
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
  console.log(`Total additives to update: ${total}`);

  const results = new Array(total);
  let nextIndex = 0;

  const worker = async () => {
    while (nextIndex < total) {
      const currentIndex = nextIndex;
      nextIndex += 1;

      const additive = targets[currentIndex];
      const slug = createAdditiveSlug({ eNumber: additive.eNumber, title: additive.title });
      const props = await readProps(slug, additive);
      const keywords = toKeywordList(props);

      console.log(
        `[${currentIndex + 1}/${total}] ${slug} → ${keywords.length} keyword${
          keywords.length === 1 ? '' : 's'
        }`,
      );

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

  await Promise.all(Array.from({ length: Math.min(MAX_CONCURRENCY, total) }, () => worker()));

  const successfulEntries = results.filter(
    (entry) => !entry.error && typeof entry.totalVolume === 'number',
  );

  const rankMap = assignRanks(successfulEntries.map((entry) => ({
    slug: entry.slug,
    volume: entry.totalVolume,
  })));

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

      const hasVolume = Array.isArray(entry.keywordVolumes)
        ? entry.keywordVolumes.some((item) => item.volume > 0)
        : false;

      if (typeof entry.totalVolume === 'number') {
        entry.props.searchVolume = entry.totalVolume;
        entry.props.searchRank = hasVolume ? rankMap.get(entry.slug) ?? null : null;
      } else {
        entry.props.searchVolume = null;
        entry.props.searchRank = null;
      }

      await writeProps(entry.slug, entry.props);
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
    console.log('Additive props updated successfully.');
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
