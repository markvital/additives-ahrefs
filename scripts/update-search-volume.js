#!/usr/bin/env node

/**
 * Fetches Ahrefs Keywords Explorer search volume data for each additive
 * and updates the `data/additives.json` file with `searchVolume` and
 * `searchRank` properties.
 */

const fs = require('fs/promises');
const path = require('path');
const { execFile } = require('child_process');
const { promisify } = require('util');

const execFileAsync = promisify(execFile);

const DATA_PATH = path.join(__dirname, '..', 'data', 'additives.json');
const API_URL = 'https://api.ahrefs.com/v3/keywords-explorer/overview';
const COUNTRY = 'us';
const BATCH_SIZE = 10;
const MAX_CONCURRENCY = 3;
const MAX_RETRIES = 3;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const getApiKey = () => {
  const apiKey = process.env.AHREFS_API_KEY;
  if (!apiKey) {
    throw new Error('Missing AHREFS_API_KEY environment variable.');
  }
  return apiKey;
};

const readAdditives = async () => {
  const raw = await fs.readFile(DATA_PATH, 'utf8');
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed.additives)) {
    throw new Error('Unexpected additives.json format.');
  }
  return parsed.additives;
};

const writeAdditives = async (additives) => {
  const payload = { additives };
  const contents = `${JSON.stringify(payload, null, 2)}\n`;
  await fs.writeFile(DATA_PATH, contents, 'utf8');
};

const fetchBatch = async (apiKey, titles) => {
  const params = new URLSearchParams();
  params.set('country', COUNTRY);
  params.set('select', 'keyword,volume');
  params.set('keywords', titles.join(','));

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
        result.set(
          entry.keyword.toLowerCase(),
          typeof entry.volume === 'number' ? entry.volume : null,
        );
      }
    });

    return result;
  } catch (error) {
    const stderr = error.stderr ? error.stderr.toString() : '';
    const message = stderr || error.message || 'Unknown error';
    throw new Error(message.trim());
  }
};

const fetchBatchWithRetry = async (apiKey, titles, attempt = 1) => {
  try {
    return await fetchBatch(apiKey, titles);
  } catch (error) {
    if (attempt >= MAX_RETRIES) {
      throw error;
    }
    const delay = 500 * attempt;
    console.warn(`Batch failed (attempt ${attempt}): ${error.message}. Retrying in ${delay}ms...`);
    await sleep(delay);
    return fetchBatchWithRetry(apiKey, titles, attempt + 1);
  }
};

const chunkArray = (items, size) => {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
};

const assignRanks = (volumes) => {
  const sorted = volumes
    .filter((item) => typeof item.volume === 'number' && item.volume > 0)
    .sort((a, b) => b.volume - a.volume);

  const rankMap = new Map();
  sorted.forEach((item, index) => {
    rankMap.set(item.title, index + 1);
  });
  return rankMap;
};

async function main() {
  const apiKey = getApiKey();
  const additives = await readAdditives();

  console.log(`Total additives: ${additives.length}`);

  const batches = chunkArray(additives, BATCH_SIZE);
  const volumes = new Map();
  let processed = 0;
  let nextBatchIndex = 0;

  const worker = async () => {
    while (nextBatchIndex < batches.length) {
      const batchIndex = nextBatchIndex;
      nextBatchIndex += 1;
      const batch = batches[batchIndex];
      const titles = batch.map((item) => item.title);
      try {
        const batchResult = await fetchBatchWithRetry(apiKey, titles);
        batch.forEach((item) => {
          const key = item.title.toLowerCase();
          const volume = batchResult.has(key) ? batchResult.get(key) : null;
          volumes.set(item.title, typeof volume === 'number' ? volume : null);
          processed += 1;
          console.log(`[${processed}/${additives.length}] ${item.title}`);
        });
      } catch (error) {
        console.error(`Failed to fetch batch starting with "${batch[0]?.title}": ${error.message}`);
        batch.forEach((item) => {
          if (!volumes.has(item.title)) {
            volumes.set(item.title, null);
            processed += 1;
            console.log(`[${processed}/${additives.length}] ${item.title} (no data)`);
          }
        });
      }
    }
  };

  await Promise.all(Array.from({ length: MAX_CONCURRENCY }, () => worker()));

  const rankMap = assignRanks(
    additives.map((item) => ({ title: item.title, volume: volumes.get(item.title) ?? null })),
  );

  const updatedAdditives = additives.map((item) => ({
    ...item,
    searchVolume: volumes.get(item.title) ?? null,
    searchRank: rankMap.get(item.title) ?? null,
  }));

  await writeAdditives(updatedAdditives);
  console.log('additives.json updated successfully.');
}

main().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});
