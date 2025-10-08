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

const parseArgs = (argv) => {
  const result = {
    additiveSlugs: [],
    help: false,
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
      '  --help                   Show this message.\n',
  );
};

const getApiKey = () => {
  const apiKey = process.env.AHREFS_API_KEY;
  if (!apiKey) {
    throw new Error('Missing AHREFS_API_KEY environment variable.');
  }
  return apiKey;
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
  const { additiveSlugs, help } = parseArgs(process.argv);

  if (help) {
    printUsage();
    return;
  }

  const apiKey = getApiKey();
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

      let keywordVolumes = keywords.map((keyword) => ({ keyword, volume: 0 }));
      let totalVolume = 0;

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
          keywordVolumes = keywords.map((keyword) => ({ keyword, volume: 0 }));
          totalVolume = 0;
        }

        await sleep(REQUEST_DELAY_MS);
      }

      const sortedKeywords = [...keywordVolumes].sort((a, b) => b.volume - a.volume || a.keyword.localeCompare(b.keyword));

      results[currentIndex] = {
        slug,
        props,
        keywordVolumes: sortedKeywords,
        totalVolume,
      };
    }
  };

  await Promise.all(Array.from({ length: Math.min(MAX_CONCURRENCY, total) }, () => worker()));

  const rankMap = assignRanks(
    results.map((entry) => ({ slug: entry.slug, volume: entry.totalVolume })),
  );

  await Promise.all(
    results.map(async (entry) => {
      const hasVolume = entry.keywordVolumes.some((item) => item.volume > 0);
      const dataset = {
        totalSearchVolume: entry.totalVolume,
        keywords: entry.keywordVolumes,
      };

      await writeSearchVolumeDataset(entry.slug, dataset);

      if (hasVolume) {
        entry.props.searchVolume = entry.totalVolume;
        entry.props.searchRank = rankMap.get(entry.slug) ?? null;
      } else {
        entry.props.searchVolume = null;
        entry.props.searchRank = null;
      }

      await writeProps(entry.slug, entry.props);
    }),
  );

  console.log('Additive props updated successfully.');
}

main().catch((error) => {
  if (error?.message) {
    console.error(error.message);
  } else {
    console.error(error);
  }
  process.exitCode = 1;
});
