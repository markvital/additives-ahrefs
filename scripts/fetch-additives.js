#!/usr/bin/env node

/**
 * This script downloads the full list of food additives from Open Food Facts
 * and stores a normalized snapshot in `data`.
 *
 * Steps:
 * 1. Retrieve all additive IDs by paging through the facets API.
 * 2. Fetch taxonomy details for each additive to collect metadata.
 * 3. Normalize the data structure (names, synonyms, functions, links).
 * 4. Persist the consolidated dataset across `data/additives.json` and
 *    per-additive `props.json` files.
 */

const fs = require('fs/promises');
const path = require('path');
const { execFile } = require('child_process');
const { promisify } = require('util');

const { createAdditiveSlug } = require('./utils/slug');

const execFileAsync = promisify(execFile);

const FACETS_BASE_URL = 'https://us.openfoodfacts.org/facets/additives.json';
const TAXONOMY_BASE_URL = 'https://us.openfoodfacts.org/api/v2/taxonomy?tagtype=additives&tags=';
const DATA_DIR = path.join(__dirname, '..', 'data');
const ADDITIVES_INDEX_PATH = path.join(DATA_DIR, 'additives.json');
const MAX_PAGE_CHECK = 10; // Guard to avoid infinite loops if the API changes.
const REQUEST_DELAY_MS = 50; // Gentle delay between batch requests.
const BATCH_SIZE = 10;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchJson(url, description) {
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    try {
      const { stdout } = await execFileAsync('curl', ['-fsS', url]);
      return JSON.parse(stdout);
    } catch (error) {
      const isLastAttempt = attempt === 5;
      console.error(
        `Failed to fetch ${description} (attempt ${attempt}): ${error.message}`,
      );
      if (isLastAttempt) {
        throw error;
      }
      await sleep(250 * attempt);
    }
  }

  throw new Error(`Exhausted retries for ${description}`);
}

async function fetchAllAdditiveIds() {
  const ids = new Set();
  console.log('Fetching additive IDs from facets endpoint...');
  for (let page = 1; page <= MAX_PAGE_CHECK; page += 1) {
    const url = page === 1 ? FACETS_BASE_URL : `${FACETS_BASE_URL}?page=${page}`;
    const data = await fetchJson(url, `facet page ${page}`);
    if (!data.tags || data.tags.length === 0) {
      console.log(`No tags returned for page ${page}; stopping.`);
      break;
    }

    data.tags.forEach((tag) => {
      if (tag && typeof tag.id === 'string') {
        ids.add(tag.id);
      }
    });

    console.log(` Page ${page}: collected ${data.tags.length} tags (total unique: ${ids.size}).`);

    if (data.page && data.page.page === data.page.page_count) {
      break;
    }
  }

  console.log(`Finished fetching additive IDs. Total unique IDs: ${ids.size}.`);
  return Array.from(ids);
}

function pickFirstString(value) {
  if (!value) {
    return undefined;
  }

  if (typeof value === 'string') {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => (typeof item === 'string' ? item : null)).find(Boolean);
  }

  if (typeof value === 'object') {
    const languages = ['en', 'fr', 'de', 'es'];
    for (const lang of languages) {
      if (Object.prototype.hasOwnProperty.call(value, lang)) {
        const candidate = pickFirstString(value[lang]);
        if (candidate) {
          return candidate;
        }
      }
    }

    const entries = Object.values(value);
    for (const entry of entries) {
      const candidate = pickFirstString(entry);
      if (candidate) {
        return candidate;
      }
    }
  }

  return undefined;
}

function collectStringArray(value) {
  if (!value) {
    return [];
  }

  const collected = new Set();

  const gather = (input) => {
    if (!input) {
      return;
    }
    if (typeof input === 'string') {
      const trimmed = input.trim();
      if (trimmed) {
        collected.add(trimmed);
      }
      return;
    }
    if (Array.isArray(input)) {
      input.forEach((item) => gather(item));
      return;
    }
    if (typeof input === 'object') {
      Object.values(input).forEach((item) => gather(item));
    }
  };

  gather(value);
  return Array.from(collected);
}

function normaliseFunctions(rawFunctions) {
  const seen = new Set();

  return collectStringArray(rawFunctions)
    .flatMap((item) => item.split(/[,;]/))
    .map((item) => item.trim())
    .map((item) => item.replace(/^[a-z]{2,}:/i, '').trim())
    .filter((item) => {
      if (!item) {
        return false;
      }
      const key = item.toLowerCase();
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
}

function deriveENumber(id) {
  const raw = typeof id === 'string' ? id.split(':').pop() : '';
  if (!raw) {
    return '';
  }
  const normalized = raw.trim().toLowerCase();
  if (!/^e\d+[a-z]*$/.test(normalized)) {
    return '';
  }
  const withoutPrefix = normalized.replace(/^e/, '');
  return `E${withoutPrefix.toUpperCase()}`;
}

function cleanseName(rawName) {
  if (!rawName) {
    return '';
  }
  const parts = rawName.split(' - ');
  if (parts.length > 1) {
    return parts.slice(1).join(' - ').trim();
  }
  return rawName.trim();
}

function sanitiseUrl(url) {
  if (!url) {
    return '';
  }
  return url.replace(/\s/g, '_');
}

function fallbackTitleFromId(id, eNumber) {
  const rawSegment = typeof id === 'string' ? id.split(':').pop() : '';
  if (!rawSegment) {
    return eNumber || id;
  }

  const normalized = rawSegment.replace(/[_-]+/g, ' ').trim();
  if (!normalized) {
    return eNumber || rawSegment;
  }

  return normalized
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

async function fetchAdditiveDetails(id, index, total) {
  const url = `${TAXONOMY_BASE_URL}${encodeURIComponent(id)}`;
  const data = await fetchJson(url, `taxonomy for ${id}`);
  const entry = data[id];
  const eNumber = deriveENumber(id);

  if (!entry) {
    const fallbackTitle = fallbackTitleFromId(id, eNumber);
    console.warn(` No taxonomy entry found for ${id}; using fallback metadata.`);
    console.log(` Processed ${index}/${total}: ${id} -> ${fallbackTitle} (fallback)`);
    return {
      title: fallbackTitle,
      eNumber,
      synonyms: [],
      functions: [],
      description: '',
      wikipedia: '',
      wikidata: '',
    };
  }

  let title = cleanseName(pickFirstString(entry.name)) || eNumber;
  if (!title) {
    title = fallbackTitleFromId(id, eNumber);
  }
  const synonyms = collectStringArray(entry.synonyms);
  const functions = normaliseFunctions(entry.additives_classes);
  const description = pickFirstString(entry.wikipedia_abstract) || '';
  const wikipediaPreferred = pickFirstString(entry.wikipedia);
  const wikipediaFallback = pickFirstString(entry.wikipedia_url);
  const wikipedia = sanitiseUrl(wikipediaPreferred || wikipediaFallback || '');
  const wikidata = pickFirstString(entry.wikidata) || '';

  console.log(` Processed ${index}/${total}: ${id} -> ${title}`);

  return {
    title,
    eNumber,
    synonyms,
    functions,
    description,
    wikipedia,
    wikidata,
  };
}

async function readExistingProps(slug) {
  const propsPath = path.join(DATA_DIR, slug, 'props.json');
  try {
    const raw = await fs.readFile(propsPath, 'utf8');
    return JSON.parse(raw);
  } catch (error) {
    return null;
  }
}

async function writeAdditiveDataset(additives) {
  await fs.mkdir(DATA_DIR, { recursive: true });

  const indexEntries = [];

  for (const additive of additives) {
    const slug = createAdditiveSlug({
      eNumber: additive.eNumber,
      title: additive.title,
    });
    const dirPath = path.join(DATA_DIR, slug);
    await fs.mkdir(dirPath, { recursive: true });

    const existingProps = await readExistingProps(slug);
    const propsPath = path.join(dirPath, 'props.json');
    const payload = {
      title: additive.title || '',
      eNumber: additive.eNumber || '',
      synonyms: additive.synonyms || [],
      functions: additive.functions || [],
      description: additive.description || '',
      wikipedia: additive.wikipedia || '',
      wikidata: additive.wikidata || '',
      productCount:
        existingProps && typeof existingProps.productCount === 'number'
          ? existingProps.productCount
          : null,
    };

    await fs.writeFile(propsPath, `${JSON.stringify(payload, null, 2)}\n`);

    indexEntries.push({
      title: payload.title,
      eNumber: payload.eNumber,
    });
  }

  indexEntries.sort((a, b) => {
    if (a.title && b.title) {
      return a.title.localeCompare(b.title, 'en');
    }
    if (a.title) {
      return -1;
    }
    if (b.title) {
      return 1;
    }
    return (a.eNumber || '').localeCompare(b.eNumber || '', 'en');
  });

  const indexPayload = {
    additives: indexEntries,
  };

  await fs.writeFile(ADDITIVES_INDEX_PATH, `${JSON.stringify(indexPayload, null, 2)}\n`);
  console.log(`Saved ${additives.length} additives to ${DATA_DIR}`);
}

async function main() {
  const ids = await fetchAllAdditiveIds();
  const additives = [];

  for (let i = 0; i < ids.length; i += BATCH_SIZE) {
    const chunk = ids.slice(i, i + BATCH_SIZE);
    const results = await Promise.all(
      chunk.map((id, offset) => fetchAdditiveDetails(id, i + offset + 1, ids.length)),
    );
    results
      .filter((item) => item !== null)
      .forEach((item) => additives.push(item));

    await sleep(REQUEST_DELAY_MS);
  }

  additives.sort((a, b) => a.title.localeCompare(b.title, 'en'));

  await writeAdditiveDataset(additives);
}

main().catch((error) => {
  console.error('Failed to update additives dataset:', error);
  process.exit(1);
});
