#!/usr/bin/env node

/**
 * Fetches product counts for food additives from the Open Food Facts search API.
 *
 * Usage examples:
 *   node scripts/fetch-product-counts.js --additive e345-magnesium-citrate
 *   node scripts/fetch-product-counts.js --additive=e345-magnesium-citrate,e1503-castor-oil --debug
 *   node scripts/fetch-product-counts.js --force
 */

const fs = require('fs/promises');
const path = require('path');
const { execFile } = require('child_process');
const { promisify } = require('util');

const { createAdditiveSlug } = require('./utils/slug');

const execFileAsync = promisify(execFile);

const DATA_DIR = path.join(__dirname, '..', 'data');
const ADDITIVES_INDEX_PATH = path.join(DATA_DIR, 'additives.json');
const API_BASE_URL = 'https://world.openfoodfacts.org/api/v2/search';
const FACET_INDEX_URL = 'https://world.openfoodfacts.org/facets/additives.json';

const normaliseAdditiveSlug = (value) => (typeof value === 'string' ? value.trim().toLowerCase() : '');

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
    debug: false,
    force: false,
    help: false,
    limit: null,
  };

  let index = 0;

  while (index < args.length) {
    const arg = args[index];

    if (arg === '--help' || arg === '-h' || arg === '-help') {
      result.help = true;
      index += 1;
      continue;
    }

    if (arg === '--debug' || arg === '-debug') {
      result.debug = true;
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
      result.additiveSlugs.push(...values.map(normaliseAdditiveSlug));
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
        .map((entry) => normaliseAdditiveSlug(entry))
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

    result.additiveSlugs.push(normaliseAdditiveSlug(arg));
    index += 1;
  }

  result.additiveSlugs = result.additiveSlugs.filter(Boolean);

  return result;
};

const printUsage = () => {
  console.log(
    'Usage: node scripts/fetch-product-counts.js [options]\n' +
      '\n' +
      'Options:\n' +
      '  --additive <slug...>          Fetch product counts for the specified additive slugs.\n' +
      '  --additive=<slug,slug>        Same as above using a comma separated list.\n' +
      '  --limit, -n <value>           Process at most <value> additives.\n' +
      '  --force                       Re-fetch even if a product count already exists.\n' +
      '  --debug                       Print verbose API diagnostics.\n' +
      '  --help                        Show this message.\n',
  );
};

const readAdditivesIndex = async () => {
  const raw = await fs.readFile(ADDITIVES_INDEX_PATH, 'utf8');
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed.additives)) {
    throw new Error('Unexpected additives.json format.');
  }
  return parsed.additives.map((entry) => ({
    title: typeof entry.title === 'string' ? entry.title : '',
    eNumber: typeof entry.eNumber === 'string' ? entry.eNumber : '',
    slug: createAdditiveSlug({ eNumber: entry.eNumber, title: entry.title }),
  }));
};

const propsPathForSlug = (slug) => path.join(DATA_DIR, slug, 'props.json');

const toOptionalNumber = (value) => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return null;
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
    const data = JSON.parse(raw);
    const ensured = ensureProps(data, fallback);
    ensured.productCount = toOptionalNumber(data.productCount);
    return ensured;
  } catch (error) {
    return ensureProps(null, fallback);
  }
};

const writeProps = async (slug, props) => {
  await fs.mkdir(path.join(DATA_DIR, slug), { recursive: true });
  await fs.writeFile(propsPathForSlug(slug), `${JSON.stringify(props, null, 2)}\n`);
};

const slugFromFacetUrl = (value) => {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return null;
  }

  try {
    const url = new URL(value);
    const parts = url.pathname.split('/').filter(Boolean);
    const last = parts[parts.length - 1];
    return typeof last === 'string' && last.length > 0 ? last.toLowerCase() : null;
  } catch (error) {
    return null;
  }
};

const fetchFacetProductCounts = async ({ debug = false } = {}) => {
  const result = new Map();
  let page = 1;

  try {
    while (true) {
      const url = new URL(FACET_INDEX_URL);
      url.searchParams.set('page', String(page));

      if (debug) {
        console.log(`[debug] Fetching facet page ${page}: ${url.toString()}`);
      }

      const { stdout, stderr } = await execFileAsync('curl', ['-fsS', url.toString()]);

      if (debug && stderr) {
        const trimmed = stderr.toString().trim();
        if (trimmed.length > 0) {
          console.log('[debug] curl stderr:', trimmed);
        }
      }

      const data = JSON.parse(stdout);
      if (!data || typeof data !== 'object' || !Array.isArray(data.tags)) {
        throw new Error(`Unexpected facet response format on page ${page}.`);
      }

      if (data.tags.length === 0) {
        break;
      }

      for (const tag of data.tags) {
        if (!tag || typeof tag !== 'object') {
          continue;
        }

        const slug = slugFromFacetUrl(tag.url);
        if (!slug) {
          continue;
        }

        const count = toOptionalNumber(tag.products);
        if (count === null) {
          continue;
        }

        result.set(slug, count);
      }

      page += 1;

      if (page > 1000) {
        throw new Error('Facet pagination appears to be stuck.');
      }
    }

    return result;
  } catch (error) {
    throw new Error(`Failed to fetch additive facet index: ${error.message}`);
  }
};

const fetchProductCount = async (slug, { debug = false } = {}) => {
  const url = new URL(API_BASE_URL);
  url.searchParams.set('additives_tags', `en:${slug}`);
  url.searchParams.set('page_size', '100');
  url.searchParams.set('page', '1');
  url.searchParams.set('fields', 'code,product_name,brands,additives_tags');

  if (debug) {
    console.log(`[debug] Fetching ${url.toString()}`);
  }

  try {
    const { stdout, stderr } = await execFileAsync('curl', ['-fsS', url.toString()]);
    if (debug && stderr) {
      console.log('[debug] curl stderr:', stderr.toString().trim());
    }
    const data = JSON.parse(stdout);
    const count = typeof data.count === 'number' ? data.count : null;
    if (debug) {
      console.log('[debug] Response count:', count);
    }
    return count;
  } catch (error) {
    if (debug) {
      const stderr = error.stderr ? error.stderr.toString() : '';
      console.error(`[debug] Failed to fetch product count for ${slug}: ${stderr || error.message}`);
    }
    throw new Error(`Failed to fetch product count for ${slug}: ${error.message}`);
  }
};

async function main() {
  const cliArgs = parseArgs(process.argv);

  if (cliArgs.help) {
    printUsage();
    return;
  }

  const additives = await readAdditivesIndex();
  let targets = additives;

  if (cliArgs.additiveSlugs.length > 0) {
    const requested = new Set(cliArgs.additiveSlugs);
    targets = additives.filter((item) => requested.has(item.slug));

    const missing = [...requested].filter((slug) => !targets.some((item) => item.slug === slug));
    if (missing.length > 0) {
      console.warn(`Warning: ${missing.join(', ')} not found in additives index.`);
    }
  }

  if (cliArgs.limit !== null) {
    targets = targets.slice(0, cliArgs.limit);
  }

  if (targets.length === 0) {
    console.log('No additives to process.');
    return;
  }

  let facetCounts = null;

  try {
    facetCounts = await fetchFacetProductCounts({ debug: cliArgs.debug });
    console.log(`[info] Loaded ${facetCounts.size} product counts from facet index.`);
  } catch (error) {
    console.warn(`Warning: ${error.message}`);
  }

  console.log(`Processing ${targets.length} additive${targets.length === 1 ? '' : 's'}...`);

  for (let index = 0; index < targets.length; index += 1) {
    const additive = targets[index];
    const props = await readProps(additive.slug, additive);
    const existingCount = typeof props.productCount === 'number' ? props.productCount : null;
    const hasFacetCount = facetCounts instanceof Map && facetCounts.has(additive.slug);
    const facetCount = hasFacetCount ? facetCounts.get(additive.slug) : null;
    const shouldUpdate =
      cliArgs.force ||
      existingCount === null ||
      (hasFacetCount && facetCount !== existingCount);

    if (!shouldUpdate) {
      console.log(`[skip] ${additive.slug} already has productCount=${existingCount}`);
      continue;
    }

    let sourceLabel = 'facet';
    let nextCount = facetCount;

    if (!hasFacetCount) {
      sourceLabel = 'search';

      try {
        const count = await fetchProductCount(additive.slug, { debug: cliArgs.debug });
        nextCount = count === null ? null : count;
      } catch (error) {
        console.error(`Error processing ${additive.slug}: ${error.message}`);
        continue;
      }
    }

    const outputCount = nextCount === null ? 'null' : nextCount;

    if (!cliArgs.force && existingCount !== null && existingCount === nextCount) {
      console.log(`[skip] ${additive.slug} productCount unchanged (${outputCount})`);
      continue;
    }

    props.productCount = nextCount;
    await writeProps(additive.slug, props);
    console.log(`[${index + 1}/${targets.length}] ${additive.slug} → ${outputCount} (${sourceLabel})`);
  }

  console.log('Done.');
}

main().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});
