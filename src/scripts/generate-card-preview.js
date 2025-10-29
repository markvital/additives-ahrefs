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

const { chromium } = require('playwright');
const { createAdditiveSlug } = require('./utils/slug');

const ROOT_DIR = path.join(__dirname, '..', '..');
const DATA_DIR = path.join(ROOT_DIR, 'data');
const PUBLIC_DIR = path.join(ROOT_DIR, 'public');
const OUTPUT_DIR = path.join(PUBLIC_DIR, 'card-previews');
const ADDITIVES_INDEX_PATH = path.join(DATA_DIR, 'additives.json');

const DEFAULT_PORT = 4050;
const DEFAULT_PARALLEL = 4;
const PREVIEW_SIZE = 512;
const CARD_SELECTOR = '[data-additive-card-slug]';

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
    ['next', 'start', '-p', String(port)],
    {
      cwd: ROOT_DIR,
      env: { ...process.env, PORT: String(port) },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );

  const serverReady = new Promise((resolve, reject) => {
    let resolved = false;
    const timeout = setTimeout(() => {
      if (!resolved) {
        reject(new Error('Timed out waiting for Next.js server to start.'));
      }
    }, 60000);

    const handleLine = (line) => {
      if (debug) {
        process.stdout.write(`[next] ${line}`);
      }
      if (!resolved && /(started server|ready\s)/i.test(line)) {
        resolved = true;
        clearTimeout(timeout);
        resolve();
      }
    };

    serverProcess.stdout.on('data', (chunk) => {
      const text = chunk.toString();
      text.split(/(?<=\n)/).forEach(handleLine);
    });

    serverProcess.stderr.on('data', (chunk) => {
      const text = chunk.toString();
      text.split(/(?<=\n)/).forEach((line) => {
        if (debug) {
          process.stderr.write(`[next] ${line}`);
        }
        if (!resolved && /(started server|ready\s)/i.test(line)) {
          resolved = true;
          clearTimeout(timeout);
          resolve();
        }
      });
    });

    serverProcess.on('exit', (code) => {
      if (!resolved) {
        clearTimeout(timeout);
        reject(new Error(`Next.js server exited early with code ${code}.`));
      }
    });
  });

  await serverReady;
  return serverProcess;
};

const stopServer = async (serverProcess) => {
  if (!serverProcess) {
    return;
  }
  await new Promise((resolve) => {
    serverProcess.once('exit', () => resolve());
    serverProcess.kill('SIGTERM');
    setTimeout(() => serverProcess.kill('SIGKILL'), 2000);
  });
};

const ensureCardVisible = async (page, slug, debug) => {
  const selector = `[data-additive-card-slug="${slug}"]`;
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const count = await page.locator(selector).count();
    if (count > 0) {
      if (debug) {
        console.log(`Located card for ${slug} after ${attempt + 1} attempts.`);
      }
      return true;
    }

    await page.evaluate(() => window.scrollBy(0, window.innerHeight * 0.8));
    await page.waitForTimeout(750);
  }

  return false;
};

const loadAllCards = async (page, expectedCount, debug) => {
  let lastCount = 0;
  let stagnantRounds = 0;

  for (let attempt = 0; attempt < expectedCount * 4; attempt += 1) {
    const count = await page.locator(CARD_SELECTOR).count();
    if (count >= expectedCount) {
      if (debug) {
        console.log(`Loaded ${count} cards (expected ${expectedCount}).`);
      }
      return;
    }

    if (count === lastCount) {
      stagnantRounds += 1;
    } else {
      stagnantRounds = 0;
    }

    if (stagnantRounds > 6) {
      if (debug) {
        console.warn('Reached stagnation while loading cards; continuing anyway.');
      }
      return;
    }

    lastCount = count;
    await page.evaluate(() => window.scrollBy(0, window.innerHeight * 0.9));
    await page.waitForTimeout(750);
  }
};

const createPreviewClone = async (page, slug) => {
  const selector = `[data-additive-card-slug="${slug}"]`;
  const cloneId = `card-preview-${slug}`;

  const created = await page.evaluate(
    ({ cardSelector, previewId, size }) => {
      const existing = document.querySelector(`[data-card-preview-wrapper="${previewId}"]`);
      if (existing) {
        existing.remove();
      }

      const card = document.querySelector(cardSelector);
      if (!card) {
        return false;
      }

      const wrapper = document.createElement('div');
      wrapper.setAttribute('data-card-preview-wrapper', previewId);
      wrapper.style.position = 'fixed';
      wrapper.style.top = '0';
      wrapper.style.left = '0';
      wrapper.style.width = `${size}px`;
      wrapper.style.height = `${size}px`;
      wrapper.style.zIndex = '99999';
      wrapper.style.borderRadius = '50%';
      wrapper.style.overflow = 'hidden';
      wrapper.style.background = '#ffffff';
      wrapper.style.padding = '0';
      wrapper.style.boxShadow = 'none';
      wrapper.style.display = 'flex';
      wrapper.style.flexDirection = 'column';
      wrapper.style.alignItems = 'stretch';
      wrapper.style.justifyContent = 'stretch';
      wrapper.style.boxSizing = 'border-box';
      wrapper.style.transform = 'translateZ(0)';

      const clone = card.cloneNode(true);
      clone.style.width = '100%';
      clone.style.height = '100%';
      clone.style.borderRadius = '50%';
      clone.style.overflow = 'hidden';
      clone.style.display = 'flex';
      clone.style.flexDirection = 'column';
      clone.style.alignItems = 'stretch';
      clone.style.justifyContent = 'stretch';

      const actionArea = clone.querySelector('[class*="MuiCardActionArea-root"]');
      if (actionArea) {
        actionArea.removeAttribute('href');
        actionArea.style.display = 'flex';
        actionArea.style.flexDirection = 'column';
        actionArea.style.alignItems = 'stretch';
        actionArea.style.justifyContent = 'stretch';
        actionArea.style.height = '100%';
      }

      const content = clone.querySelector('[class*="MuiCardContent-root"]');
      if (content) {
        content.style.height = '100%';
        content.style.boxSizing = 'border-box';
        content.style.padding = '32px';
        content.style.display = 'flex';
        content.style.flexDirection = 'column';
        content.style.justifyContent = 'space-between';
        content.style.gap = '24px';
      }

      wrapper.appendChild(clone);
      document.body.appendChild(wrapper);
      return true;
    },
    { cardSelector: selector, previewId: cloneId, size: PREVIEW_SIZE },
  );

  return created ? `[data-card-preview-wrapper="${cloneId}"]` : null;
};

const removePreviewClone = async (page, slug) => {
  const cloneId = `card-preview-${slug}`;
  await page.evaluate((previewId) => {
    const wrapper = document.querySelector(`[data-card-preview-wrapper="${previewId}"]`);
    if (wrapper) {
      wrapper.remove();
    }
  }, cloneId);
};

const captureCardPreview = async ({ page, slug, outputPath, debug }) => {
  const selector = await createPreviewClone(page, slug);
  if (!selector) {
    throw new Error(`Unable to locate card for slug ${slug}.`);
  }

  const locator = page.locator(selector);
  await locator.waitFor({ state: 'visible', timeout: 5000 });
  await locator.screenshot({ path: outputPath, type: 'png' });
  await removePreviewClone(page, slug);

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

  await ensureOutputDir();
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
    const exists = await fileExists(outputPath);
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
    const page = await browser.newPage({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 2,
    });

    await page.goto(`${serverUrl}/`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);

    if (!targeted) {
      await loadAllCards(page, allSlugs.length, debug);
    }

    const activeTasks = [...tasks];
    const inFlight = new Set();

    const launchNext = async () => {
      if (activeTasks.length === 0) {
        return null;
      }
      const next = activeTasks.shift();
      const promise = (async () => {
        try {
          const available = await ensureCardVisible(page, next.slug, debug);
          if (!available) {
            throw new Error(`Card for ${next.slug} did not render on the page.`);
          }
          await captureCardPreview({ page, slug: next.slug, outputPath: next.outputPath, debug });
        } catch (error) {
          throw new Error(`Failed to capture preview for ${next.slug}: ${error.message}`);
        }
      })();
      inFlight.add(promise);
      promise.finally(() => inFlight.delete(promise));
      return promise;
    };

    const workers = [];
    const workerCount = Math.max(1, parallel || 1);
    for (let index = 0; index < workerCount; index += 1) {
      const worker = (async () => {
        while (activeTasks.length > 0) {
          const job = await launchNext();
          if (!job) {
            break;
          }
          await job;
        }
      })();
      workers.push(worker);
    }

    await Promise.all(workers);
    await browser.close();

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

