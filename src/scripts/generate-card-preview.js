#!/usr/bin/env node

/**
 * generate-card-preview.js
 *
 * Uses Playwright to render the additive catalogue grid in a headless browser
 * and captures a circular 512×512 image for each card. The resulting PNG files
 * are stored under `public/card-previews/<slug>.png` so they can be referenced
 * from Open Graph and Twitter meta tags.
 */

const fs = require('fs/promises');
const path = require('path');
const { spawn } = require('child_process');
const net = require('net');

if (!process.env.PLAYWRIGHT_BROWSERS_PATH || process.env.PLAYWRIGHT_BROWSERS_PATH.trim() === '') {
  process.env.PLAYWRIGHT_BROWSERS_PATH = '0';
}

const { chromium } = require('playwright');
const sharp = require('sharp');
const { createAdditiveSlug } = require('./utils/slug');

const ROOT_DIR = path.join(__dirname, '..', '..');
const DATA_DIR = path.join(ROOT_DIR, 'data');
const PUBLIC_DIR = path.join(ROOT_DIR, 'public');
const OUTPUT_DIR = path.join(PUBLIC_DIR, 'card-previews');
const ADDITIVES_INDEX_PATH = path.join(DATA_DIR, 'additives.json');

const DEFAULT_PORT = 4050;
const DEFAULT_PARALLEL = 2;
const PREVIEW_SIZE = 512;
const CARD_LOCATOR = '[data-additive-card-index]';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const fileExists = async (filePath) => {
  try {
    await fs.access(filePath);
    return true;
  } catch (error) {
    return false;
  }
};

const parsePositiveInteger = (value, flag) => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Invalid value for ${flag}: ${value}`);
  }
  return parsed;
};

const parseArgs = (argv) => {
  const result = {
    additiveSlugs: [],
    help: false,
    debug: false,
    limit: null,
    parallel: DEFAULT_PARALLEL,
    override: false,
    baseUrl: null,
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

    if (arg.startsWith('--base-url=')) {
      const value = arg.substring(arg.indexOf('=') + 1);
      if (!value) {
        throw new Error('Missing value for --base-url.');
      }
      result.baseUrl = value.replace(/\/$/, '');
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
    `Usage: node src/scripts/generate-card-preview.js [options]\n` +
      `\n` +
      `Options:\n` +
      `  --additive <slug...>     Only generate previews for the specified slugs.\n` +
      `  --additive=<slug,slug>   Same as above using a comma separated list.\n` +
      `  --limit <n>              Process at most <n> additives (default: unlimited).\n` +
      `  --parallel <n>           Capture up to <n> previews in parallel (default: ${DEFAULT_PARALLEL}).\n` +
      `  --override               Re-capture previews even if they already exist.\n` +
      `  --base-url=<url>         Use an existing Next.js server instead of starting one locally.\n` +
      `  --debug                  Enable verbose logging.\n` +
      `  --help                   Show this message.\n`,
  );
};

const readAdditivesIndex = async () => {
  const raw = await fs.readFile(ADDITIVES_INDEX_PATH, 'utf8');
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed.additives)) {
    throw new Error('Unexpected additives.json format.');
  }
  return parsed.additives.map((item) => ({
    title: item.title,
    eNumber: item.eNumber,
    slug: createAdditiveSlug({ eNumber: item.eNumber, title: item.title }),
  }));
};

const ensureOutputDir = async () => {
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
};

const SERVER_START_TIMEOUT_MS = 60000;

const waitForServerReady = async ({ url, serverProcess, debug }) => {
  const start = Date.now();
  let lastError = null;

  while (Date.now() - start < SERVER_START_TIMEOUT_MS) {
    if (serverProcess.exitCode !== null || serverProcess.signalCode !== null) {
      throw new Error(`Next.js server exited early with code ${serverProcess.exitCode ?? serverProcess.signalCode}`);
    }

    try {
      const response = await fetch(url, { method: 'HEAD', cache: 'no-store' });
      if (response.ok || (response.status >= 200 && response.status < 500)) {
        if (debug) {
          console.log(`Next.js server responded with status ${response.status}.`);
        }
        return;
      }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
    }

    await sleep(500);
  }

  const reason = lastError ? ` Last error: ${lastError.message}` : '';
  throw new Error(`Timed out waiting for Next.js server to start.${reason}`);
};

const startNextServer = async ({ port, debug }) => {
  const portAvailable = await new Promise((resolve) => {
    const tester = net
      .createServer()
      .once('error', () => resolve(false))
      .once('listening', () => {
        tester.close(() => resolve(true));
      })
      .listen(port, '127.0.0.1');
  });

  if (!portAvailable) {
    throw new Error(`Port ${port} is already in use. Pass --base-url to reuse an existing server.`);
  }

  const serverProcess = spawn(
    process.platform === 'win32' ? 'npx.cmd' : 'npx',
    ['next', 'start', '-p', String(port), '--hostname', '127.0.0.1'],
    {
      cwd: ROOT_DIR,
      env: { ...process.env, PORT: String(port) },
      stdio: 'ignore',
      detached: false,
    },
  );

  const serverUrl = `http://127.0.0.1:${port}`;
  await waitForServerReady({ url: serverUrl, serverProcess, debug });
  return serverProcess;
};

const stopServer = async (serverProcess) => {
  if (!serverProcess) {
    return;
  }

  if (serverProcess.exitCode !== null || serverProcess.signalCode !== null) {
    return;
  }

  await new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (!settled) {
        settled = true;
        resolve();
      }
    };

    serverProcess.once('exit', finish);
    serverProcess.once('close', finish);

    try {
      serverProcess.kill('SIGTERM');
    } catch (error) {
      finish();
      return;
    }

    setTimeout(() => {
      try {
        serverProcess.kill('SIGKILL');
      } catch (error) {
        // ignore
      }
      finish();
    }, 2000);
  });
};

const ensureCardVisible = async (page, slug, debug) => {
  const linkSelector = `a[href="/${slug}"]`;

  await page.evaluate(() => window.scrollTo(0, 0));

  for (let attempt = 0; attempt < 200; attempt += 1) {
    const found = await page.evaluate(({ selector }) => {
      const link = document.querySelector(selector);
      if (!link) {
        return false;
      }

      const card = link.closest('[data-additive-card-index]');
      if (!card) {
        return false;
      }

      card.scrollIntoView({ block: 'center', inline: 'center', behavior: 'auto' });
      return true;
    }, { selector: linkSelector });

    if (found) {
      const locator = page
        .locator(CARD_LOCATOR)
        .filter({ has: page.locator(linkSelector) })
        .first();

      await locator.waitFor({ state: 'visible', timeout: 5000 });
      await locator.scrollIntoViewIfNeeded();
      await page.waitForTimeout(250);

      if (debug) {
        console.log(`Located card for ${slug} after ${attempt + 1} attempt${attempt === 0 ? '' : 's'}.`);
      }

      return locator;
    }

    await page.evaluate(() => window.scrollBy(0, window.innerHeight * 0.9));
    await page.waitForTimeout(350);
  }

  return null;
};

const createPreviewBuffer = async (buffer) => {
  const circleMask = Buffer.from(
    `<svg width="${PREVIEW_SIZE}" height="${PREVIEW_SIZE}"><circle cx="${PREVIEW_SIZE / 2}" cy="${PREVIEW_SIZE / 2}" r="${
      PREVIEW_SIZE / 2
    }" fill="white" /></svg>`,
  );

  return sharp(buffer)
    .resize(PREVIEW_SIZE, PREVIEW_SIZE, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .composite([{ input: circleMask, blend: 'dest-in' }])
    .png({ compressionLevel: 9 })
    .toBuffer();
};

const captureCardPreview = async ({ page, slug, outputPath, debug }) => {
  const locator = await ensureCardVisible(page, slug, debug);

  if (!locator) {
    throw new Error(`Unable to locate card for slug ${slug}.`);
  }

  const screenshot = await locator.screenshot({ type: 'png', animations: 'disabled', omitBackground: true });
  const previewBuffer = await createPreviewBuffer(screenshot);
  await fs.writeFile(outputPath, previewBuffer);

  if (debug) {
    console.log(`Captured preview for ${slug} -> ${outputPath}`);
  }
};

async function main() {
  const { additiveSlugs, help, debug, limit, parallel, override, baseUrl } = parseArgs(process.argv);

  if (help) {
    printUsage();
    return;
  }

  if (process.env.CARD_PREVIEW_SKIP === '1') {
    if (debug) {
      console.log('CARD_PREVIEW_SKIP=1 — skipping preview generation.');
    } else {
      console.log('Skipping card preview generation (CARD_PREVIEW_SKIP=1).');
    }
    return;
  }

  await ensureOutputDir();
  const existingFiles = await fs.readdir(OUTPUT_DIR, { withFileTypes: true });
  const existingPreviews = new Set(
    existingFiles
      .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.png'))
      .map((entry) => entry.name.replace(/\.png$/i, '')),
  );
  const additives = await readAdditivesIndex();

  const additiveMap = new Map(additives.map((item) => [item.slug, item]));
  const allSlugs = additives.map((item) => item.slug);

  const targeted = additiveSlugs.length > 0;
  const effectiveSlugs = targeted
    ? additiveSlugs
    : allSlugs;

  const missing = [];
  const queue = [];

  for (const slug of effectiveSlugs) {
    const entry = additiveMap.get(slug);
    if (!entry) {
      missing.push(slug);
      continue;
    }

    queue.push(entry.slug);
  }

  let candidates = queue;
  if (limit !== null) {
    candidates = candidates.slice(0, limit);
  }

  const tasks = [];
  let skipped = 0;
  const effectiveOverride = targeted ? true : override;

  for (const slug of candidates) {
    const outputPath = path.join(OUTPUT_DIR, `${slug}.png`);
    const exists = existingPreviews.has(slug) ? true : await fileExists(outputPath);
    if (exists && !effectiveOverride) {
      if (debug) {
        console.log(`Skipping existing preview for ${slug}.`);
      }
      skipped += 1;
      continue;
    }
    tasks.push({ slug, outputPath });
  }

  if (tasks.length === 0) {
    console.log(`No previews to generate. Skipped ${skipped}. Missing: ${missing.length}.`);
    if (missing.length > 0) {
      console.warn(`Missing additives: ${missing.join(', ')}`);
    }
    return;
  }

  const port = DEFAULT_PORT;
  let serverProcess = null;
  let serverUrl = baseUrl ? baseUrl.replace(/\/$/, '') : null;

  try {
    if (!serverUrl) {
      serverUrl = `http://127.0.0.1:${port}`;
      serverProcess = await startNextServer({ port, debug });
      if (debug) {
        console.log(`Started Next.js server on ${serverUrl}`);
      }
      await sleep(1500);
    }

    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });

    const workerCount = Math.max(1, parallel || 1);
    const activeTasks = [...tasks];

    const spawnWorker = async () => {
      const page = await context.newPage();

      try {
        await page.goto(`${serverUrl}/`, { waitUntil: 'networkidle' });
        await page.waitForTimeout(1000);

        while (activeTasks.length > 0) {
          const task = activeTasks.shift();
          if (!task) {
            break;
          }

          try {
            await captureCardPreview({ page, slug: task.slug, outputPath: task.outputPath, debug });
          } catch (error) {
            throw new Error(`Failed to capture preview for ${task.slug}: ${error.message}`);
          }
        }
      } finally {
        await page.close();
      }
    };

    const workerPromises = [];
    for (let index = 0; index < workerCount; index += 1) {
      workerPromises.push(spawnWorker());
    }

    try {
      await Promise.all(workerPromises);
    } finally {
      await browser.close();
    }

    if (missing.length > 0) {
      console.warn(`Missing additives: ${missing.join(', ')}`);
    }

    console.log(
      `Generated ${tasks.length} preview${tasks.length === 1 ? '' : 's'}. Skipped ${skipped}. Missing: ${missing.length}.`,
    );
  } finally {
    await stopServer(serverProcess);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

