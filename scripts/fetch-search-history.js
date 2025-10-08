#!/usr/bin/env node

const fs = require('fs/promises');
const path = require('path');
const { execFile } = require('child_process');
const { promisify } = require('util');

const { createAdditiveSlug } = require('./utils/slug');

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
  if (typeof result.productCount !== 'number') {
    result.productCount = null;
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

async function main() {
  if (!API_TOKEN) {
    throw new Error('Missing Ahrefs API token. Set AHREFS_API_KEY or related env variable.');
  }

  const additives = await readAdditivesIndex();

  const total = additives.length;
  let processed = 0;

  for (const additive of additives) {
    const slug = createAdditiveSlug({ eNumber: additive.eNumber, title: additive.title });
    const dirPath = path.join(DATA_DIR, slug);
    await fs.mkdir(dirPath, { recursive: true });
    const historyPath = historyPathForSlug(slug);

    try {
      processed += 1;
      console.log(`[${processed}/${total}] Fetching history for "${additive.title}"`);

      const payload = await fetchHistory(additive.title);
      await sleep(REQUEST_DELAY_MS);

      if (!payload || !Array.isArray(payload.metrics) || payload.metrics.length === 0) {
        await fs.writeFile(
          historyPath,
          `${JSON.stringify(
            {
              keyword: additive.title,
              country: 'us',
              fetchedAt: new Date().toISOString(),
              metrics: [],
            },
            null,
            2,
          )}\n`,
        );

        const props = ensureProps(await readProps(slug), additive);
        props.searchSparkline = [];
        await writeProps(slug, props);
        continue;
      }

      const filteredMetrics = filterLastTenYears(payload.metrics);
      const sparkline = computeYearlyAverage(filteredMetrics);

      await fs.writeFile(
        historyPath,
        `${JSON.stringify(
          {
            keyword: additive.title,
            country: 'us',
            fetchedAt: new Date().toISOString(),
            metrics: filteredMetrics,
          },
          null,
          2,
        )}\n`,
      );

      const props = ensureProps(await readProps(slug), additive);
      props.searchSparkline = sparkline;
      await writeProps(slug, props);
    } catch (error) {
      console.error(`Error processing ${additive.title}: ${error.message}`);
      const props = ensureProps(await readProps(slug), additive);
      props.searchSparkline = [];
      await writeProps(slug, props);
    }
  }

  console.log(`Completed fetching history for ${processed} additives.`);
}

main().catch((error) => {
  console.error('Failed to fetch search history:', error);
  process.exit(1);
});
