#!/usr/bin/env node

/**
 * Updates parent/child relationships for additives by querying the
 * Open Food Facts taxonomy API. The script augments existing
 * `props.json` files with `parents` and `children` arrays containing
 * additive slugs that represent the hierarchy.
 */

const fs = require('fs/promises');
const path = require('path');
const { execFile } = require('child_process');
const { promisify } = require('util');

const { createAdditiveSlug, normaliseENumber } = require('./utils/slug');

const execFileAsync = promisify(execFile);

const DATA_DIR = path.join(__dirname, '..', 'data');
const ADDITIVES_INDEX_PATH = path.join(DATA_DIR, 'additives.json');
const TAXONOMY_BASE_URL =
  'https://us.openfoodfacts.org/api/v2/taxonomy?tagtype=additives&tags=';
const DEFAULT_PARALLEL = 5;
const MAX_RETRIES = 4;

let DEBUG = false;
const debugLog = (...args) => {
  if (DEBUG) {
    console.log(...args);
  }
};

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
    help: false,
    debug: false,
    limit: null,
    parallel: null,
    override: false,
  };

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
  console.log(`Usage: node scripts/update-additives-from-OFF.js [options]\n\n`);
  console.log('Options:');
  console.log('  --help, -h            Show this help message.');
  console.log('  --debug, -d           Enable verbose logging.');
  console.log('  --additive <slug...>  Update only the specified additive slugs.');
  console.log('  --limit <n>           Process at most n additives (bulk mode only).');
  console.log('  --parallel <n>        Maximum concurrent requests (default: 5).');
  console.log('  --override            Refresh relationships even if already present.');
};

const readJsonFile = async (filePath, description) => {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    return JSON.parse(raw);
  } catch (error) {
    throw new Error(`Failed to read ${description}: ${error.message}`);
  }
};

const fetchJson = async (url, description) => {
  let attempt = 0;

  while (attempt < MAX_RETRIES) {
    attempt += 1;

    try {
      const { stdout } = await execFileAsync('curl', ['-fsS', url]);
      return JSON.parse(stdout);
    } catch (error) {
      const isLastAttempt = attempt === MAX_RETRIES;
      console.error(`Failed to fetch ${description} (attempt ${attempt}): ${error.message}`);

      if (isLastAttempt) {
        throw error;
      }

      await sleep(200 * attempt);
    }
  }

  throw new Error(`Exhausted retries for ${description}`);
};

const normaliseTaxonomyTag = (value) => {
  if (!value) {
    return '';
  }

  const str = String(value).trim();

  if (!str) {
    return '';
  }

  const delimiterIndex = str.lastIndexOf(':');
  const suffix = delimiterIndex >= 0 ? str.slice(delimiterIndex + 1) : str;
  const normalized = normaliseENumber(suffix);

  return normalized;
};

const runWithConcurrency = async (items, limit, task) => {
  if (items.length === 0) {
    return [];
  }

  const results = new Array(items.length);
  let cursor = 0;

  const workers = Array.from({ length: Math.min(limit, items.length) }, () =>
    (async () => {
      while (true) {
        const index = cursor;
        cursor += 1;

        if (index >= items.length) {
          break;
        }

        try {
          results[index] = await task(items[index], index);
        } catch (error) {
          results[index] = { status: 'error', error };
        }
      }
    })(),
  );

  await Promise.all(workers);
  return results;
};

const loadAdditivesIndex = async () => {
  const data = await readJsonFile(ADDITIVES_INDEX_PATH, 'additives index');
  const items = Array.isArray(data?.additives) ? data.additives : [];

  const entries = items.map((entry) => {
    const slug = createAdditiveSlug({ eNumber: entry.eNumber, title: entry.title });
    const normalizedENumber = normaliseENumber(entry.eNumber);

    return {
      slug,
      title: typeof entry.title === 'string' ? entry.title : '',
      eNumber: typeof entry.eNumber === 'string' ? entry.eNumber : '',
      normalizedENumber,
      propsPath: path.join(DATA_DIR, slug, 'props.json'),
    };
  });

  const bySlug = new Map(entries.map((entry) => [entry.slug, entry]));
  const byNormalizedENumber = new Map(
    entries
      .filter((entry) => entry.normalizedENumber)
      .map((entry) => [entry.normalizedENumber, entry.slug]),
  );

  return {
    entries,
    bySlug,
    byNormalizedENumber,
  };
};

const readPropsFile = async (filePath) => {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    const data = JSON.parse(raw);
    return { raw, data };
  } catch (error) {
    if (error.code === 'ENOENT') {
      return null;
    }

    throw new Error(`Failed to read props file at ${filePath}: ${error.message}`);
  }
};

const writePropsFile = async (filePath, data) => {
  const content = `${JSON.stringify(data, null, 2)}\n`;
  await fs.writeFile(filePath, content, 'utf8');
};

const extractRelationships = (entry, eNumberToSlugMap, currentSlug) => {
  if (!entry || typeof entry !== 'object') {
    return { parents: [], children: [] };
  }

  const mapValuesToSlugs = (values, relationType) => {
    const collected = [];

    values.forEach((value) => {
      const normalized = normaliseTaxonomyTag(value);

      if (!normalized) {
        return;
      }

      const slug = eNumberToSlugMap.get(normalized);

      if (!slug) {
        debugLog(
          ` • Unable to resolve ${relationType} "${value}" (normalized: ${normalized}) for ${currentSlug}.`,
        );
        return;
      }

      if (slug === currentSlug) {
        return;
      }

      const key = slug.trim().toLowerCase();

      if (key.length === 0 || collected.some((existing) => existing.toLowerCase() === key)) {
        return;
      }

      collected.push(slug);
    });

    return collected;
  };

  const rawParents = Array.isArray(entry.parents) ? entry.parents : [];
  const rawChildren = Array.isArray(entry.children) ? entry.children : [];

  const parents = mapValuesToSlugs(rawParents, 'parent');
  const children = mapValuesToSlugs(rawChildren, 'child');

  return { parents, children };
};

const processAdditive = async (additive, options) => {
  const { byNormalizedENumber } = options.indexMaps;
  const propsResult = await readPropsFile(additive.propsPath);

  if (!propsResult) {
    console.warn(`Skipping ${additive.slug}: props.json not found.`);
    return { status: 'missing' };
  }

  const { raw: previousRaw, data: props } = propsResult;
  const hasExistingRelationships =
    Object.prototype.hasOwnProperty.call(props, 'parents') ||
    Object.prototype.hasOwnProperty.call(props, 'children');

  if (!options.force && !options.targeted && hasExistingRelationships) {
    return { status: 'skipped' };
  }

  const normalizedENumber = additive.normalizedENumber;

  if (!normalizedENumber) {
    console.warn(`Skipping ${additive.slug}: missing E-number.`);
    return { status: 'skipped' };
  }

  const taxonomyUrl = `${TAXONOMY_BASE_URL}${encodeURIComponent(`en:${normalizedENumber}`)}`;
  debugLog(`Fetching taxonomy for ${additive.slug}: ${taxonomyUrl}`);
  const taxonomy = await fetchJson(taxonomyUrl, `taxonomy for ${additive.slug}`);
  const entryKey = Object.keys(taxonomy).find((key) => key.endsWith(normalizedENumber));

  if (!entryKey) {
    console.warn(`No taxonomy entry found for ${additive.slug}.`);

    if (hasExistingRelationships && !options.force) {
      return { status: 'unchanged' };
    }

    const next = { ...props };
    delete next.parents;
    delete next.children;

    const nextRaw = `${JSON.stringify(next, null, 2)}\n`;

    if (nextRaw === previousRaw) {
      return { status: 'unchanged' };
    }

    await writePropsFile(additive.propsPath, next);
    return { status: 'updated', parents: [], children: [] };
  }

  const relationships = extractRelationships(taxonomy[entryKey], byNormalizedENumber, additive.slug);
  const next = { ...props };

  if (relationships.parents.length > 0) {
    next.parents = relationships.parents;
  } else {
    delete next.parents;
  }

  if (relationships.children.length > 0) {
    next.children = relationships.children;
  } else {
    delete next.children;
  }

  const nextRaw = `${JSON.stringify(next, null, 2)}\n`;

  if (nextRaw === previousRaw) {
    return { status: 'unchanged' };
  }

  await writePropsFile(additive.propsPath, next);
  return { status: 'updated', parents: relationships.parents, children: relationships.children };
};

const main = async () => {
  try {
    const args = parseArgs(process.argv);

    if (args.help) {
      printUsage();
      return;
    }

    DEBUG = args.debug;

    const { entries, bySlug, byNormalizedENumber } = await loadAdditivesIndex();
    const indexMaps = { bySlug, byNormalizedENumber };

    const isTargeted = args.additiveSlugs.length > 0;
    let targetSlugs = isTargeted ? args.additiveSlugs : entries.map((entry) => entry.slug);
    targetSlugs = targetSlugs.filter((slug, index) => slug && targetSlugs.indexOf(slug) === index);

    const unknownSlugs = targetSlugs.filter((slug) => !bySlug.has(slug));

    if (unknownSlugs.length > 0) {
      console.warn(`Unknown additive slugs: ${unknownSlugs.join(', ')}`);
    }

    let additivesToProcess = targetSlugs
      .map((slug) => bySlug.get(slug))
      .filter((entry) => entry !== undefined);

    if (!isTargeted && typeof args.limit === 'number' && Number.isFinite(args.limit)) {
      additivesToProcess = additivesToProcess.slice(0, args.limit);
    }

    if (additivesToProcess.length === 0) {
      console.log('No additives to process.');
      return;
    }

    const parallel = args.parallel ?? DEFAULT_PARALLEL;

    console.log(`Processing ${additivesToProcess.length} additives...`);

    let updatedCount = 0;
    let unchangedCount = 0;
    let skippedCount = 0;
    let missingCount = 0;
    let errorCount = 0;

    await runWithConcurrency(additivesToProcess, parallel, async (additive) => {
      try {
        const result = await processAdditive(additive, {
          force: args.override || isTargeted,
          targeted: isTargeted,
          indexMaps,
        });

        switch (result.status) {
          case 'updated': {
            updatedCount += 1;
            const parentLabel = result.parents?.length ? ` parents=${result.parents.join(',')}` : '';
            const childLabel = result.children?.length ? ` children=${result.children.join(',')}` : '';
            console.log(`Updated ${additive.slug}.${parentLabel}${childLabel}`);
            break;
          }
          case 'unchanged':
            unchangedCount += 1;
            debugLog(`No changes for ${additive.slug}.`);
            break;
          case 'skipped':
            skippedCount += 1;
            debugLog(`Skipped ${additive.slug}.`);
            break;
          case 'missing':
            missingCount += 1;
            break;
          default:
            break;
        }
      } catch (error) {
        errorCount += 1;
        console.error(`Failed to update ${additive.slug}: ${error.message}`);
      }
    });

    console.log('Done.');
    console.log(`  Updated:   ${updatedCount}`);
    console.log(`  Unchanged: ${unchangedCount}`);
    console.log(`  Skipped:   ${skippedCount}`);
    console.log(`  Missing:   ${missingCount}`);
    console.log(`  Errors:    ${errorCount}`);

    if (errorCount > 0) {
      process.exitCode = 1;
    }
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
};

main();
