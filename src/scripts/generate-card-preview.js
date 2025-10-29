#!/usr/bin/env node

const fs = require('fs/promises');
const path = require('path');
const http = require('http');

const next = require('next');
const sharp = require('sharp');
const { chromium } = require('playwright');

const ROOT_DIR = path.join(__dirname, '..', '..');
const DATA_DIR = path.join(ROOT_DIR, 'data');
const ADDITIVE_DIR = path.join(DATA_DIR, 'additive');
const OUTPUT_DIR = path.join(ROOT_DIR, 'public', 'card-previews');
const TMP_DIR = path.join(ROOT_DIR, '_tmp');

const CARD_SELECTOR = '[data-card-preview="frame"]';
const VIEWPORT = { width: 1440, height: 900 };

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const fileExists = async (filePath) => {
  try {
    await fs.access(filePath);
    return true;
  } catch (error) {
    return false;
  }
};

const parseArgs = (argv) => {
  const result = {
    additiveSlugs: [],
    override: false,
    debug: false,
    help: false,
  };

  const args = Array.isArray(argv) ? argv.slice(2) : [];
  let index = 0;

  while (index < args.length) {
    const arg = args[index];

    if (arg === '--help' || arg === '-h') {
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
        throw new Error('No additive slugs supplied after --additive=.');
      }

      const parts = value
        .split(',')
        .map((entry) => entry.trim().toLowerCase())
        .filter(Boolean);

      if (parts.length === 0) {
        throw new Error('No additive slugs supplied after --additive=.');
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

  return result;
};

const printHelp = () => {
  console.log(`Usage: npm run generate-card-preview -- [options]\n\n`);
  console.log('Options:');
  console.log('  --additive <slug...>       Generate previews for the specified additive slugs.');
  console.log('  --additive=slug,slug       Same as above.');
  console.log('  --override                 Regenerate previews even if they already exist.');
  console.log('  --debug                    Enable verbose logging.');
  console.log('  --help                     Show this help message.');
};

const listAdditiveSlugs = async () => {
  try {
    const entries = await fs.readdir(ADDITIVE_DIR, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .filter((name) => name.trim().length > 0)
      .sort((a, b) => a.localeCompare(b));
  } catch (error) {
    throw new Error(`Unable to read additive directory: ${error.message}`);
  }
};

const ensureDirectory = async (dirPath) => {
  await fs.mkdir(dirPath, { recursive: true });
};

const createCircleMask = (size) =>
  Buffer.from(
    `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg"><circle cx="${
      size / 2
    }" cy="${size / 2}" r="${size / 2}" fill="white"/></svg>`,
  );

const CIRCLE_MASK = createCircleMask(512);

const startNextServer = async () => {
  const dir = ROOT_DIR;
  const buildDir = path.join(dir, '.next');
  const buildIdPath = path.join(buildDir, 'BUILD_ID');
  const hasBuild = await fileExists(buildIdPath);
  const app = next({ dev: !hasBuild, dir });
  await app.prepare();
  const handle = app.getRequestHandler();
  const server = http.createServer((req, res) => handle(req, res));

  await new Promise((resolve) => {
    server.listen(0, resolve);
  });

  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 3000;

  return { server, port, app };
};

const createTempDir = async () => {
  await ensureDirectory(TMP_DIR);
  return fs.mkdtemp(path.join(TMP_DIR, 'card-preview-'));
};

const capturePreview = async ({
  page,
  baseUrl,
  slug,
  tmpDir,
  outputPath,
  debug,
}) => {
  const url = `${baseUrl}/preview/card/${slug}`;
  await page.goto(url, { waitUntil: 'load', timeout: 60_000 });
  await page.waitForSelector(CARD_SELECTOR, { timeout: 30_000 });
  await sleep(200);

  const locator = page.locator(CARD_SELECTOR).first();
  const tempPath = path.join(tmpDir, `${slug}.png`);

  await locator.screenshot({ path: tempPath, type: 'png', omitBackground: true });

  await sharp(tempPath)
    .resize(512, 512, { fit: 'cover' })
    .composite([{ input: CIRCLE_MASK, blend: 'dest-in' }])
    .png({ compressionLevel: 9 })
    .toFile(outputPath);

  await fs.unlink(tempPath);

  if (debug) {
    console.log(`generated: ${outputPath}`);
  }
};

async function main() {
  const { additiveSlugs, override, debug, help } = parseArgs(process.argv);

  if (help) {
    printHelp();
    return;
  }

  const targetedMode = additiveSlugs.length > 0;
  const availableSlugs = await listAdditiveSlugs();

  if (availableSlugs.length === 0) {
    console.error('No additive slugs found. Did you run the data pipeline?');
    process.exitCode = 1;
    return;
  }

  const requestedSlugs = targetedMode ? additiveSlugs : availableSlugs;
  const missingSlugs = requestedSlugs.filter((slug) => !availableSlugs.includes(slug));

  if (missingSlugs.length > 0) {
    console.error('Unknown additive slugs:', missingSlugs.join(', '));
    process.exitCode = 1;
    return;
  }

  const outputDir = OUTPUT_DIR;
  await ensureDirectory(outputDir);
  const tempDir = await createTempDir();

  const { server, port } = await startNextServer();
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize(VIEWPORT);

  const baseUrl = `http://127.0.0.1:${port}`;
  const skipped = [];
  const generated = [];
  const failures = [];

  try {
    for (const slug of requestedSlugs) {
      const outputPath = path.join(outputDir, `${slug}.png`);
      const exists = await fileExists(outputPath);
      const shouldSkip = exists && !override && !targetedMode;

      if (shouldSkip) {
        skipped.push(slug);
        continue;
      }

      try {
        await capturePreview({
          page,
          baseUrl,
          slug,
          tmpDir: tempDir,
          outputPath,
          debug,
        });
        generated.push(slug);
      } catch (error) {
        failures.push(slug);
        console.error(`Failed to generate preview for ${slug}:`, error.message);
        if (debug) {
          console.error(error);
        }
      }
    }
  } finally {
    await page.close();
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      if (debug) {
        console.error('Failed to clean temp directory', error);
      }
    }
  }

  if (!targetedMode && skipped.length > 0) {
    console.log(`skipped: ${skipped.length}`);
  }

  console.log(`generated: ${generated.length}`);

  if (failures.length > 0) {
    console.error(`failed: ${failures.length}`);
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error('Unexpected error generating card previews:', error);
  process.exit(1);
});
