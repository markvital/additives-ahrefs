#!/usr/bin/env node

const fs = require('fs/promises');
const path = require('path');
const { execFile } = require('child_process');
const { promisify } = require('util');

const { createAdditiveSlug } = require('./utils/slug');

const execFileAsync = promisify(execFile);

const DATA_DIR = path.join(__dirname, '..', 'data');
const ADDITIVES_INDEX_PATH = path.join(DATA_DIR, 'additives.json');
const API_ENDPOINT = 'https://api.nal.usda.gov/fdc/v1/foods/search';
const DEFAULT_API_KEY = 'EHf6ZHx4AhcsX31cgTsB2Avud7ckR6fBJXDF4fDg';

const getApiKey = () => process.env.FDC_API_KEY || DEFAULT_API_KEY;

const readJsonFile = async (filePath) => {
  const raw = await fs.readFile(filePath, 'utf8');
  return JSON.parse(raw);
};

const propsPathForSlug = (slug) => path.join(DATA_DIR, slug, 'props.json');

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
  if (typeof result.searchVolume !== 'number') {
    result.searchVolume = null;
  }
  if (typeof result.searchRank !== 'number') {
    result.searchRank = null;
  }
  if (typeof result.productCount !== 'number') {
    result.productCount = null;
  }

  return result;
};

const readProps = async (slug, fallback) => {
  try {
    const data = await readJsonFile(propsPathForSlug(slug));
    return ensureProps(data, fallback);
  } catch (error) {
    return ensureProps(null, fallback);
  }
};

const writeProps = async (slug, props) => {
  await fs.mkdir(path.join(DATA_DIR, slug), { recursive: true });
  await fs.writeFile(propsPathForSlug(slug), `${JSON.stringify(props, null, 2)}\n`);
};

const readAdditivesIndex = async () => {
  const data = await readJsonFile(ADDITIVES_INDEX_PATH);

  if (!data || !Array.isArray(data.additives)) {
    throw new Error('Unexpected additives index format.');
  }

  return data.additives.map((entry) => ({
    title: typeof entry.title === 'string' ? entry.title : '',
    eNumber: typeof entry.eNumber === 'string' ? entry.eNumber : '',
    slug: createAdditiveSlug({ title: entry.title, eNumber: entry.eNumber }),
  }));
};

const parseArgs = () => {
  const args = process.argv.slice(2);
  const options = {
    additiveSlugs: [],
    debug: false,
    skipExisting: false,
    help: false,
  };

  let index = 0;
  while (index < args.length) {
    const arg = args[index];

    if (arg === '--help' || arg === '-h') {
      options.help = true;
      index += 1;
      continue;
    }

    if (arg === '--debug') {
      options.debug = true;
      index += 1;
      continue;
    }

    if (arg === '--skip-existing') {
      options.skipExisting = true;
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
      options.additiveSlugs.push(...values);
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
        .map((item) => item.trim())
        .filter(Boolean);
      if (parts.length === 0) {
        throw new Error('No additive slug supplied after --additive=.');
      }
      options.additiveSlugs.push(...parts);
      index += 1;
      continue;
    }

    if (arg.startsWith('-')) {
      throw new Error(`Unknown option: ${arg}`);
    }

    options.additiveSlugs.push(arg);
    index += 1;
  }

  options.additiveSlugs = options.additiveSlugs
    .map((slug) => slug.trim().toLowerCase())
    .filter(Boolean);

  return options;
};

const printUsage = () => {
  console.log(
    `Usage: node scripts/fetch-product-count.js [options]\n\n` +
      `Options:\n` +
      `  --additive <slug...>          Fetch product counts for the specified additive slugs.\n` +
      `  --additive=<slug,slug>        Same as above using a comma separated list.\n` +
      `  --skip-existing               Skip additives that already have a productCount value.\n` +
      `  --debug                       Print raw API responses for debugging purposes.\n` +
      `  --help                        Show this message.\n` +
      `\nExamples:\n` +
      `  node scripts/fetch-product-count.js\n` +
      `  node scripts/fetch-product-count.js --additive e345-magnesium-citrate\n` +
      `  node scripts/fetch-product-count.js --additive=e345-magnesium-citrate,e1503-castor-oil\n` +
      `  node scripts/fetch-product-count.js --skip-existing\n`,
  );
};

const createAndQuery = (value) => {
  if (typeof value !== 'string') {
    return '';
  }

  const tokens = value
    .trim()
    .split(/[\s-]+/)
    .map((token) => token.trim())
    .filter(Boolean);

  if (tokens.length <= 1) {
    return value.trim();
  }

  return tokens.join(' AND ');
};

const fetchProductCount = async (title, apiKey, debug = false) => {
  const query = createAndQuery(title);
  const body = {
    query,
    dataType: ['Branded'],
    pageSize: 1,
    pageNumber: 1,
  };

  try {
    const url = `${API_ENDPOINT}?api_key=${encodeURIComponent(apiKey)}`;
    const payload = JSON.stringify(body);
    const { stdout } = await execFileAsync('curl', [
      '-fsS',
      '-X',
      'POST',
      '-H',
      'Content-Type: application/json',
      '-d',
      payload,
      url,
    ]);
    const data = JSON.parse(stdout);

    if (debug) {
      console.log('--- API response start ---');
      console.log(JSON.stringify(data, null, 2));
      console.log('--- API response end ---');
    }

    if (typeof data.totalHits === 'number' && Number.isFinite(data.totalHits)) {
      return Math.max(0, Math.round(data.totalHits));
    }

    return null;
  } catch (error) {
    if (error.stdout) {
      try {
        const data = JSON.parse(error.stdout);
        if (debug) {
          console.log('--- API response start ---');
          console.log(JSON.stringify(data, null, 2));
          console.log('--- API response end ---');
        }
        if (typeof data.totalHits === 'number' && Number.isFinite(data.totalHits)) {
          return Math.max(0, Math.round(data.totalHits));
        }
      } catch (parseError) {
        // ignore parse error, fall through
      }
    }

    const message = error.stderr ? error.stderr.toString() : error.message;
    throw new Error(message.trim() || 'Request failed');
  }
};

const shouldSkipAdditive = (props, options) => {
  if (!options.skipExisting) {
    return false;
  }

  return typeof props.productCount === 'number' && Number.isFinite(props.productCount);
};

async function main() {
  try {
    const options = parseArgs();

    if (options.help) {
      printUsage();
      return;
    }

    const apiKey = getApiKey();
    const additives = await readAdditivesIndex();

    const additiveMap = new Map(additives.map((item) => [item.slug, item]));

    let targets;
    if (options.additiveSlugs.length > 0) {
      targets = options.additiveSlugs
        .map((slug) => additiveMap.get(slug))
        .filter((item) => item);

      const missing = options.additiveSlugs.filter((slug) => !additiveMap.has(slug));
      if (missing.length > 0) {
        console.warn(`⚠️  Skipping unknown additive slugs: ${missing.join(', ')}`);
      }
    } else {
      targets = additives;
    }

    if (targets.length === 0) {
      console.log('No additives to process.');
      return;
    }

    console.log(`Processing ${targets.length} additive${targets.length === 1 ? '' : 's'}...`);

    let processed = 0;
    for (const additive of targets) {
      processed += 1;
      const label = additive.title || additive.slug;
      const props = await readProps(additive.slug, additive);

      if (shouldSkipAdditive(props, options)) {
        console.log(`[${processed}/${targets.length}] ${label}: skipped (existing value).`);
        continue;
      }

      try {
        const count = await fetchProductCount(additive.title, apiKey, options.debug);
        const nextProps = { ...props, productCount: count };
        await writeProps(additive.slug, nextProps);
        console.log(
          `[${processed}/${targets.length}] ${label}: ${
            typeof count === 'number' ? `${count} products` : 'no data'
          }`,
        );
      } catch (error) {
        console.error(`[${processed}/${targets.length}] ${label}: failed to fetch - ${error.message}`);
      }
    }
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exitCode = 1;
  }
}

main();
