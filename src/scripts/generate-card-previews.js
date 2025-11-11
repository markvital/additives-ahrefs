#!/usr/bin/env node

/**
 * Generates card preview images for social media meta tags.
 *
 * Usage examples:
 *   node src/scripts/generate-card-previews.js --additive e330-citric-acid
 *   node src/scripts/generate-card-previews.js --additive=e330-citric-acid,e471-mono-and-diglycerides-of-fatty-acids --debug
 *   node src/scripts/generate-card-previews.js --limit 10
 *   node src/scripts/generate-card-previews.js --override
 */

const fs = require('fs/promises');
const path = require('path');
const { chromium } = require('playwright');

const { createAdditiveSlug } = require('./utils/slug');

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const ADDITIVES_INDEX_PATH = path.join(DATA_DIR, 'additives.json');
const OUTPUT_DIR = path.join(__dirname, '..', '..', 'public', 'card-previews');
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const VIEWPORT_WIDTH = 1200;
const VIEWPORT_HEIGHT = 630;
const JPEG_QUALITY = 90;

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
    override: false,
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

    if (arg === '--override' || arg === '--overide') {
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
    'Usage: node src/scripts/generate-card-previews.js [options]\n' +
      '\n' +
      'Options:\n' +
      '  --additive <slug...>          Generate previews for the specified additive slugs.\n' +
      '  --additive=<slug,slug>        Same as above using a comma separated list.\n' +
      '  --limit, -n <value>           Process at most <value> additives.\n' +
      '  --override                    Regenerate existing preview images.\n' +
      '  --debug                       Print verbose logging.\n' +
      '  --help                        Show this message.\n' +
      '\n' +
      'Examples:\n' +
      '  node src/scripts/generate-card-previews.js --additive e330-citric-acid\n' +
      '  node src/scripts/generate-card-previews.js --limit 10 --debug\n' +
      '  node src/scripts/generate-card-previews.js --override\n',
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

const outputPathForSlug = (slug) => path.join(OUTPUT_DIR, `${slug}.jpg`);

const fileExists = async (filePath) => {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
};

const captureCardPreview = async (page, slug, options = {}) => {
  const { debug = false } = options;
  const url = `${BASE_URL}/preview/${slug}`;
  const outputPath = outputPathForSlug(slug);

  if (debug) {
    console.log(`[debug] Navigating to ${url}`);
  }

  try {
    // Navigate to preview page
    const response = await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });

    // Check for 404 or other HTTP errors
    if (response && response.status() === 404) {
      throw new Error(`Page not found (404). The /preview route may not be available. Make sure the dev/production server is running with the latest code.`);
    }

    if (response && response.status() >= 400) {
      throw new Error(`HTTP ${response.status()} error. Server returned: ${response.statusText()}`);
    }

    // Wait for the card wrapper to be scaled
    await page.waitForSelector('#card-wrapper[data-scaled="true"]', { timeout: 10000 });

    // Additional small delay to ensure rendering is complete
    await page.waitForTimeout(500);

    if (debug) {
      console.log(`[debug] Capturing screenshot to ${outputPath}`);
    }

    // Capture screenshot
    await page.screenshot({
      path: outputPath,
      type: 'jpeg',
      quality: JPEG_QUALITY,
      fullPage: false,
    });

    return true;
  } catch (error) {
    if (debug) {
      console.error(`[debug] Failed to capture ${slug}: ${error.message}`);
    }
    throw new Error(`Failed to capture preview for ${slug}: ${error.message}`);
  }
};

async function main() {
  const cliArgs = parseArgs(process.argv);

  if (cliArgs.help) {
    printUsage();
    return;
  }

  // Read additives index
  const additives = await readAdditivesIndex();
  let targets = additives;

  // Filter by requested slugs
  if (cliArgs.additiveSlugs.length > 0) {
    const requested = new Set(cliArgs.additiveSlugs);
    targets = additives.filter((item) => requested.has(item.slug));

    const missing = [...requested].filter((slug) => !targets.some((item) => item.slug === slug));
    if (missing.length > 0) {
      console.warn(`Warning: ${missing.join(', ')} not found in additives index.`);
    }
  }

  // Apply limit
  if (cliArgs.limit !== null) {
    targets = targets.slice(0, cliArgs.limit);
  }

  if (targets.length === 0) {
    console.log('No additives to process.');
    return;
  }

  // Ensure output directory exists
  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  // Filter out existing files unless override is set
  let toProcess = targets;
  let skippedCount = 0;

  if (!cliArgs.override && cliArgs.additiveSlugs.length === 0) {
    const filtered = [];
    for (const additive of targets) {
      const exists = await fileExists(outputPathForSlug(additive.slug));
      if (exists) {
        skippedCount += 1;
      } else {
        filtered.push(additive);
      }
    }
    toProcess = filtered;
  }

  if (cliArgs.debug) {
    console.log(`[debug] Total additives: ${targets.length}`);
    console.log(`[debug] Skipped (existing): ${skippedCount}`);
    console.log(`[debug] To process: ${toProcess.length}`);
  } else if (skippedCount > 0) {
    console.log(`Skipped ${skippedCount} existing preview${skippedCount === 1 ? '' : 's'}.`);
  }

  if (toProcess.length === 0) {
    console.log('All previews already exist. Use --override to regenerate.');
    return;
  }

  console.log(`Processing ${toProcess.length} additive${toProcess.length === 1 ? '' : 's'}...`);

  // Launch browser
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: VIEWPORT_WIDTH, height: VIEWPORT_HEIGHT },
  });

  let processedCount = 0;
  let errorCount = 0;
  const total = toProcess.length;
  let lastPercentage = 0;

  for (let index = 0; index < toProcess.length; index += 1) {
    const additive = toProcess[index];

    try {
      await captureCardPreview(page, additive.slug, { debug: cliArgs.debug });
      processedCount += 1;

      // Progress reporting (every 10%)
      const currentPercentage = Math.floor((processedCount / total) * 100);
      if (currentPercentage >= lastPercentage + 10 && currentPercentage % 10 === 0) {
        console.log(`Processed ${currentPercentage}% – ${processedCount} of ${total} additives`);
        lastPercentage = currentPercentage;
      }

      if (cliArgs.debug) {
        console.log(`[${index + 1}/${total}] ${additive.slug} ✓`);
      }
    } catch (error) {
      errorCount += 1;
      console.error(`[${index + 1}/${total}] ${additive.slug} ✗ ${error.message}`);
    }
  }

  await browser.close();

  // Final summary
  console.log('\nDone.');
  console.log(`Successfully generated: ${processedCount}`);
  if (errorCount > 0) {
    console.log(`Failed: ${errorCount}`);
  }
  if (skippedCount > 0 && !cliArgs.debug) {
    console.log(`Skipped (existing): ${skippedCount}`);
  }
}

main().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});
