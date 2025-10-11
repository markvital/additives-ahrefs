#!/usr/bin/env node

/**
 * Updates parent/child relationships for additives using the
 * Open Food Facts taxonomy API.
 *
 * Usage mirrors the other data scripts in this project. Run with
 * `--help` to view the available options.
 */

const fs = require('fs/promises');
const path = require('path');
const { execFile } = require('child_process');
const { promisify } = require('util');

const { createAdditiveSlug, normaliseENumber } = require('./utils/slug');

const execFileAsync = promisify(execFile);

const TAXONOMY_BASE_URL =
  'https://us.openfoodfacts.org/api/v2/taxonomy?tagtype=additives&tags=';
const DATA_DIR = path.join(__dirname, '..', 'data');
const ADDITIVES_INDEX_PATH = path.join(DATA_DIR, 'additives.json');
const DEFAULT_PARALLEL = 5;
const MAX_FETCH_ATTEMPTS = 3;
const REQUEST_DELAY_MS = 150;

let DEBUG = false;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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

const parseArgs = (argv) => {
  const result = {
    additiveSlugs: [],
    limit: null,
    parallel: null,
    debug: false,
    help: false,
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

    if (arg === '--override' || arg === '--overide' || arg === '--force') {
      result.override = true;
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
  console.log('  --additive <slug...>      Process only the specified additive slugs.');
  console.log('  --limit <n>               Process at most n additives.');
  console.log('  --parallel <n>            Maximum number of concurrent requests.');
  console.log('  --override                Refresh additives even if local data exists.');
  console.log('  --debug                   Enable verbose logging.');
  console.log('  --help                    Show this help message.');
};

const fileExists = async (filePath) => {
  try {
    await fs.access(filePath);
    return true;
  } catch (error) {
    return false;
  }
};

const readAdditiveIndex = async () => {
  const raw = await fs.readFile(ADDITIVES_INDEX_PATH, 'utf8');
  const parsed = JSON.parse(raw);

  if (!Array.isArray(parsed.additives)) {
    throw new Error('Invalid additives index: missing `additives` array.');
  }

  return parsed.additives.map((entry) => {
    const title = typeof entry?.title === 'string' ? entry.title : '';
    const eNumber = typeof entry?.eNumber === 'string' ? entry.eNumber : '';
    const slug = createAdditiveSlug({ eNumber, title });

    return { slug, title, eNumber };
  });
};

const normaliseRelationTag = (value) => {
  if (typeof value !== 'string') {
    return '';
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return '';
  }

  const lower = trimmed.toLowerCase();
  const segments = lower.split(':').filter(Boolean);

  if (segments.length === 0) {
    return '';
  }

  if (segments.length === 1) {
    return `en:${segments[0]}`;
  }

  const suffix = segments.pop();
  const prefix = segments.shift();

  if (!suffix) {
    return '';
  }

  return `${prefix || 'en'}:${suffix}`;
};

const toSortedUniqueList = (values) => {
  const unique = new Set();

  values.forEach((value) => {
    const normalised = normaliseRelationTag(value);

    if (normalised) {
      unique.add(normalised);
    }
  });

  return Array.from(unique.values()).sort((a, b) => a.localeCompare(b));
};

const normaliseStoredRelationList = (value) => {
  if (!Array.isArray(value)) {
    return [];
  }

  return toSortedUniqueList(value);
};

const arraysEqual = (a, b) => {
  if (a.length !== b.length) {
    return false;
  }

  for (let index = 0; index < a.length; index += 1) {
    if (a[index] !== b[index]) {
      return false;
    }
  }

  return true;
};

const fetchJson = async (url, description) => {
  for (let attempt = 1; attempt <= MAX_FETCH_ATTEMPTS; attempt += 1) {
    try {
      const { stdout } = await execFileAsync('curl', ['-fsS', url]);
      return JSON.parse(stdout);
    } catch (error) {
      const isLastAttempt = attempt === MAX_FETCH_ATTEMPTS;
      console.error(
        `Failed to fetch ${description} (attempt ${attempt}): ${error.message}`,
      );
      if (isLastAttempt) {
        throw error;
      }
      await sleep(REQUEST_DELAY_MS * attempt);
    }
  }

  throw new Error(`Unable to fetch ${description}`);
};

const extractTaxonomyNode = (response) => {
  if (!response || typeof response !== 'object') {
    return null;
  }

  const entries = Object.values(response).filter(
    (entry) => entry && typeof entry === 'object',
  );

  if (entries.length === 0) {
    return null;
  }

  return entries[0];
};

const extractRelations = (node) => {
  if (!node || typeof node !== 'object') {
    return { parents: [], children: [] };
  }

  const children = Array.isArray(node.children) ? node.children : [];
  const parents = Array.isArray(node.parents) ? node.parents : [];

  return {
    children: toSortedUniqueList(children),
    parents: toSortedUniqueList(parents),
  };
};

const processAdditive = async ({ slug, eNumber, title }, { targeted }) => {
  const propsPath = path.join(DATA_DIR, slug, 'props.json');

  if (!(await fileExists(propsPath))) {
    console.warn(`Skipping ${slug}: props.json not found.`);
    return { slug, skipped: true };
  }

  const normalisedENumber = normaliseENumber(eNumber);

  if (!normalisedENumber) {
    console.warn(`Skipping ${slug}: missing valid E-number.`);
    return { slug, skipped: true };
  }

  const rawProps = await fs.readFile(propsPath, 'utf8');
  const props = JSON.parse(rawProps);
  const existingChildren = normaliseStoredRelationList(props.children);
  const existingParents = normaliseStoredRelationList(props.parents);

  if (!targeted && (existingChildren.length > 0 || existingParents.length > 0)) {
    debugLog(`Skipping ${slug}: relationships already populated.`);
    return { slug, skipped: true };
  }

  const requestUrl = `${TAXONOMY_BASE_URL}en:${normalisedENumber}`;
  debugLog(`Fetching taxonomy for ${slug} (${title}) from ${requestUrl}`);
  const response = await fetchJson(requestUrl, `taxonomy for ${slug}`);
  const node = extractTaxonomyNode(response);

  if (!node) {
    console.warn(`No taxonomy node returned for ${slug} (${normalisedENumber}).`);
    return { slug, skipped: true };
  }

  const { children, parents } = extractRelations(node);
  const hasRelations = children.length > 0 || parents.length > 0;

  if (!hasRelations) {
    if (existingChildren.length === 0 && existingParents.length === 0) {
      debugLog(`No parent/child relationships found for ${slug}.`);
      return { slug, skipped: true };
    }
  }

  let updated = false;

  if (children.length > 0) {
    if (!arraysEqual(children, existingChildren)) {
      props.children = children;
      updated = true;
    }
  } else if (props.children) {
    delete props.children;
    updated = true;
  }

  if (parents.length > 0) {
    if (!arraysEqual(parents, existingParents)) {
      props.parents = parents;
      updated = true;
    }
  } else if (props.parents) {
    delete props.parents;
    updated = true;
  }

  if (!updated) {
    debugLog(`No changes required for ${slug}.`);
    return { slug, skipped: true };
  }

  const output = `${JSON.stringify(props, null, 2)}\n`;
  await fs.writeFile(propsPath, output, 'utf8');

  debugLog(
    `Updated ${slug}: parents=${parents.length}, children=${children.length} -> ${propsPath}`,
  );

  return { slug, updated: true, parents: parents.length, children: children.length };
};

const runWithConcurrency = async (items, parallel, handler) => {
  const results = [];
  let cursor = 0;

  const worker = async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      try {
        const result = await handler(items[index], index);
        results[index] = result;
      } catch (error) {
        results[index] = { error };
      }
      if (REQUEST_DELAY_MS > 0) {
        await sleep(REQUEST_DELAY_MS);
      }
    }
  };

  const workers = Array.from({ length: Math.min(parallel, items.length) }, worker);
  await Promise.all(workers);

  return results;
};

(async () => {
  try {
    const args = parseArgs(process.argv);

    if (args.help) {
      printUsage();
      return;
    }

    DEBUG = args.debug;

    const indexEntries = await readAdditiveIndex();
    const slugMap = new Map(indexEntries.map((entry) => [entry.slug, entry]));

    let targets = [];

    if (args.additiveSlugs.length > 0) {
      targets = args.additiveSlugs
        .map((slug) => {
          const entry = slugMap.get(slug);

          if (!entry) {
            console.warn(`Unknown additive slug: ${slug}`);
          }

          return entry || null;
        })
        .filter(Boolean);

      if (targets.length === 0) {
        console.error('No valid additive slugs supplied.');
        process.exitCode = 1;
        return;
      }
    } else {
      targets = [...indexEntries];

      if (typeof args.limit === 'number') {
        targets = targets.slice(0, args.limit);
      }
    }

    if (targets.length === 0) {
      console.log('No additives to process.');
      return;
    }

    const parallel = args.parallel || DEFAULT_PARALLEL;
    const targetedMode = args.additiveSlugs.length > 0;

    console.log(
      `Processing ${targets.length} additive${targets.length === 1 ? '' : 's'} (${parallel} concurrent).`,
    );

    const results = await runWithConcurrency(targets, parallel, (item) =>
      processAdditive(item, { targeted: targetedMode || args.override }),
    );

    let updatedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    results.forEach((result, index) => {
      if (!result) {
        errorCount += 1;
        console.error(`Unknown error while processing ${targets[index].slug}.`);
        return;
      }

      if (result.error) {
        errorCount += 1;
        console.error(
          `Failed to process ${targets[index].slug}: ${result.error.message}`,
        );
        return;
      }

      if (result.updated) {
        updatedCount += 1;
        console.log(
          `Updated ${targets[index].slug}: parents=${result.parents ?? 0}, children=${result.children ?? 0}`,
        );
      } else {
        skippedCount += 1;
      }
    });

    console.log(
      `Done. Updated ${updatedCount}, skipped ${skippedCount}, errors ${errorCount}.`,
    );

    if (errorCount > 0) {
      process.exitCode = 1;
    }
  } catch (error) {
    console.error('Fatal error:', error);
    process.exitCode = 1;
  }
})();
