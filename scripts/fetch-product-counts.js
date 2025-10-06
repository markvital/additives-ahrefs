#!/usr/bin/env node

/**
 * Fetches the number of branded products from the USDA FoodData Central API
 * for each additive and stores the total hit count in `data/<slug>/props.json`
 * under the `productCount` property.
 *
 * Usage examples:
 *   node scripts/fetch-product-counts.js --additive e345-magnesium-citrate
 *   node scripts/fetch-product-counts.js --skip-existing
 *   node scripts/fetch-product-counts.js --additive=e345-magnesium-citrate,e1503-castor-oil --debug
 */

const fs = require('fs/promises');
const path = require('path');
const { execFile } = require('child_process');
const { promisify } = require('util');

const { createAdditiveSlug } = require('./utils/slug');

const execFileAsync = promisify(execFile);

const DATA_DIR = path.join(__dirname, '..', 'data');
const ADDITIVES_INDEX_PATH = path.join(DATA_DIR, 'additives.json');
const API_URL = 'https://api.nal.usda.gov/fdc/v1/foods/search';
const DEFAULT_API_KEY = 'EHf6ZHx4AhcsX31cgTsB2Avud7ckR6fBJXDF4fDg';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const getApiKey = () => process.env.FDC_API_KEY || DEFAULT_API_KEY;

const propsPathForSlug = (slug) => path.join(DATA_DIR, slug, 'props.json');

const readAdditivesIndex = async () => {
  const raw = await fs.readFile(ADDITIVES_INDEX_PATH, 'utf8');
  const parsed = JSON.parse(raw);

  if (!Array.isArray(parsed.additives)) {
    throw new Error('Unexpected additives index format.');
  }

  return parsed.additives.map((entry) => ({
    title: typeof entry.title === 'string' ? entry.title : '',
    eNumber: typeof entry.eNumber === 'string' ? entry.eNumber : '',
    slug: createAdditiveSlug({ eNumber: entry.eNumber, title: entry.title }),
  }));
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
    const raw = await fs.readFile(propsPathForSlug(slug), 'utf8');
    const parsed = JSON.parse(raw);
    return ensureProps(parsed, fallback);
  } catch (error) {
    return ensureProps(null, fallback);
  }
};

const writeProps = async (slug, props) => {
  await fs.mkdir(path.join(DATA_DIR, slug), { recursive: true });
  await fs.writeFile(propsPathForSlug(slug), `${JSON.stringify(props, null, 2)}\n`);
};

const parseArgs = (argv) => {
  const args = argv.slice(2);
  const result = {
    additiveSlugs: [],
    debug: false,
    skipExisting: false,
    help: false,
  };

  const pushSlugValues = (value) => {
    if (!value) {
      return;
    }

    value
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean)
      .forEach((part) => {
        if (!result.additiveSlugs.includes(part)) {
          result.additiveSlugs.push(part);
        }
      });
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    switch (arg) {
      case '--help':
      case '-h':
        result.help = true;
        break;
      case '--debug':
      case '-d':
        result.debug = true;
        break;
      case '--skip-existing':
      case '--skip':
        result.skipExisting = true;
        break;
      case '--additive':
      case '-additive':
      case '-a': {
        const next = args[index + 1];
        if (!next) {
          throw new Error('Missing value for --additive flag.');
        }
        pushSlugValues(next);
        index += 1;
        break;
      }
      default:
        if (arg.startsWith('--additive=')) {
          pushSlugValues(arg.slice('--additive='.length));
          break;
        }
        if (arg.startsWith('-additive=')) {
          pushSlugValues(arg.slice('-additive='.length));
          break;
        }
        if (arg.startsWith('-a=')) {
          pushSlugValues(arg.slice(3));
          break;
        }
        if (arg.startsWith('--')) {
          throw new Error(`Unknown option: ${arg}`);
        }
        pushSlugValues(arg);
        break;
    }
  }

  return result;
};

const printHelp = () => {
  console.log(`Usage: node fetch-product-counts.js [options]\n\nOptions:\n  --additive, -a <slug[,slug...]>  Only process specific additive slugs.\n  --skip-existing                 Skip additives that already have a productCount.\n  --debug                         Log API requests and responses.\n  --help                          Show this message.`);
};

const fetchProductCount = async ({ apiKey, title, debug = false }) => {
  const payload = {
    query: title,
    dataType: ['Branded'],
    pageSize: 200,
    pageNumber: 1,
  };

  const url = `${API_URL}?api_key=${encodeURIComponent(apiKey)}`;
  const body = JSON.stringify(payload);

  if (debug) {
    console.log(`→ Requesting products for "${title}"`);
  }

  try {
    const { stdout } = await execFileAsync(
      'curl',
      [
        '-fsS',
        '-X',
        'POST',
        '-H',
        'Content-Type: application/json',
        '-d',
        body,
        url,
      ],
      { maxBuffer: 10 * 1024 * 1024 },
    );

    const parsed = JSON.parse(stdout);
    const totalHits = typeof parsed.totalHits === 'number' ? parsed.totalHits : null;

    if (debug) {
      console.log(`  totalHits: ${totalHits ?? 'null'}`);
    }

    return totalHits;
  } catch (error) {
    if (debug) {
      const stderr = error.stderr ? error.stderr.toString() : error.message;
      console.error(`  Request failed: ${stderr}`);
    }
    throw error;
  }
};

async function processAdditive({
  apiKey,
  additive,
  skipExisting,
  debug,
  delayMs,
}) {
  if (!additive.title) {
    if (debug) {
      console.log(`Skipping ${additive.slug} because it has no title.`);
    }
    return { updated: false };
  }

  const props = await readProps(additive.slug, additive);

  if (skipExisting && typeof props.productCount === 'number') {
    if (debug) {
      console.log(`Skipping ${additive.slug} (productCount already set).`);
    }
    return { updated: false };
  }

  const count = await fetchProductCount({ apiKey, title: additive.title, debug });

  props.productCount = typeof count === 'number' ? count : null;

  await writeProps(additive.slug, props);

  if (delayMs > 0) {
    await sleep(delayMs);
  }

  return { updated: true, count };
}

async function main() {
  const args = parseArgs(process.argv);

  if (args.help) {
    printHelp();
    return;
  }

  const apiKey = getApiKey();
  const additives = await readAdditivesIndex();
  let targets = additives;

  if (args.additiveSlugs.length > 0) {
    const slugSet = new Set(args.additiveSlugs);
    targets = additives.filter((item) => slugSet.has(item.slug));

    const missing = args.additiveSlugs.filter((slug) => !targets.some((item) => item.slug === slug));
    if (missing.length > 0) {
      console.warn(`⚠️  Unknown additive slugs: ${missing.join(', ')}`);
    }
  }

  if (targets.length === 0) {
    console.log('No additives to process.');
    return;
  }

  console.log(`Processing ${targets.length} additive(s).`);

  let processed = 0;
  for (const additive of targets) {
    processed += 1;
    const label = [additive.eNumber, additive.title].filter(Boolean).join(' - ') || additive.slug;
    try {
      const { updated, count } = await processAdditive({
        apiKey,
        additive,
        skipExisting: args.skipExisting,
        debug: args.debug,
        delayMs: 150,
      });

      if (updated) {
        console.log(`[${processed}/${targets.length}] ${label}: ${typeof count === 'number' ? count : 'no data'}`);
      } else {
        console.log(`[${processed}/${targets.length}] ${label}: skipped`);
      }
    } catch (error) {
      console.error(`[${processed}/${targets.length}] Failed to update ${label}: ${error.message}`);
    }
  }

  console.log('Finished processing product counts.');
}

main().catch((error) => {
  console.error('Unexpected error while fetching product counts:', error);
  process.exitCode = 1;
});
