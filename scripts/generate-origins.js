#!/usr/bin/env node

/**
 * Additive origin generator script
 *
 * Behaviour
 * - Loads additives missing origin metadata (no `origin` array in `data/<slug>/props.json`) and
 *   fetches their origin classification via the OpenAI Responses API (model `gpt-5`).
 * - Existing origin arrays are skipped by default. Use --override to refresh them.
 * - Targeted mode (--additive) processes only the requested slugs.
 *
 * Defaults & overrides
 * - Default limit: 10 additives per run (ignored when --additive is supplied).
 * - Default parallelism: 10 concurrent workers.
 * - Environment overrides: `GENERATOR_LIMIT`, `GENERATOR_BATCH` (positive integers).
 * - CLI overrides:
 *     --limit, -n, --limit=<value>          → set number of additives to fetch (ignored with --additive).
 *     --parallel, --batch, -p, --parallel=<value>
 *                                          → set parallel worker count.
 *     --additive/-additive/-a <slug...> or --additive=<slug[,slug...]>
 *                                          → process specific additive slugs.
 *     --override, --mode=override          → regenerate origin even if already present.
 *     --skip, --mode=skip                  → skip additives with existing origin (default).
 *     --debug                              → print OpenAI request/response payloads.
 */

const fs = require('fs/promises');
const path = require('path');
const dns = require('dns');
const { execFile } = require('child_process');

const { createAdditiveSlug } = require('./utils/slug');

dns.setDefaultResultOrder('ipv4first');

const DEFAULT_LIMIT = 10;
const DEFAULT_BATCH_SIZE = 10;
const OPENAI_MODEL = 'gpt-5';
const OPENAI_MAX_OUTPUT_TOKENS = 2500;
const PROMPT_PATH = path.join(__dirname, 'prompts', 'additive-origin.txt');
const DATA_DIR = path.join(__dirname, '..', 'data');
const ADDITIVES_INDEX_PATH = path.join(DATA_DIR, 'additives.json');
const ENV_LOCAL_PATH = path.join(__dirname, '..', 'env.local');
const ALLOWED_ORIGINS = ['plant', 'animal', 'microbiological', 'synthetic', 'artificial', 'mineral'];
const ORIGIN_ALIASES = {
  plant: ['plant', 'botanical', 'vegetable', 'botanic'],
  animal: ['animal', 'animalsourced', 'animalbased', 'animalderived'],
  microbiological: ['microbiological', 'microbial', 'fermentation', 'microbe', 'bacterial'],
  synthetic: ['synthetic', 'syntheticallyproduced', 'syntheticonly', 'labmade'],
  artificial: ['artificial', 'artificiallyproduced'],
  mineral: ['mineral', 'geological', 'inorganic', 'mineralbased'],
};

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch (error) {
    return false;
  }
}

async function readJson(filePath) {
  const raw = await fs.readFile(filePath, 'utf8');
  return JSON.parse(raw);
}

async function loadApiKey() {
  const fromEnv = process.env.OPENAI_API_KEY;
  if (fromEnv && fromEnv.trim()) {
    return fromEnv.trim();
  }

  if (await fileExists(ENV_LOCAL_PATH)) {
    const raw = await fs.readFile(ENV_LOCAL_PATH, 'utf8');
    const lines = raw.split(/\r?\n/);
    for (const line of lines) {
      const match = line.match(/^\s*OPENAI_API_KEY\s*=\s*(.+)\s*$/);
      if (match) {
        const value = match[1].trim().replace(/^['"]|['"]$/g, '');
        if (value) {
          return value;
        }
      }
    }
  }

  throw new Error('OPENAI_API_KEY not found in environment or env.local.');
}

async function readPromptTemplate() {
  return fs.readFile(PROMPT_PATH, 'utf8');
}

async function readAdditivesIndex() {
  const data = await readJson(ADDITIVES_INDEX_PATH);
  if (!data || !Array.isArray(data.additives)) {
    throw new Error('Unexpected additives index format.');
  }

  return data.additives.map((entry) => ({
    title: typeof entry.title === 'string' ? entry.title : '',
    eNumber: typeof entry.eNumber === 'string' ? entry.eNumber : '',
    slug: createAdditiveSlug({ eNumber: entry.eNumber, title: entry.title }),
  }));
}

function parsePositiveInteger(value, label) {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed <= 0) {
    throw new Error(`Invalid value for ${label}: ${value}`);
  }
  return parsed;
}

function normaliseAdditiveSlug(value) {
  if (typeof value !== 'string') {
    return '';
  }
  return value.trim().toLowerCase();
}

function parseCommandLineArgs(argv) {
  const result = {
    limit: null,
    batchSize: null,
    additives: [],
    mode: 'skip',
    debug: false,
  };

  const args = Array.isArray(argv) ? argv.slice(2) : [];
  let index = 0;

  while (index < args.length) {
    const arg = args[index];

    if (arg === '--limit' || arg === '-n' || arg === '-limit') {
      if (index + 1 >= args.length) {
        throw new Error('Missing value for --limit.');
      }
      result.limit = parsePositiveInteger(args[index + 1], '--limit');
      index += 2;
      continue;
    }

    if (arg.startsWith('--limit=')) {
      const value = arg.split('=')[1];
      result.limit = parsePositiveInteger(value, '--limit');
      index += 1;
      continue;
    }

    if (arg === '--parallel' || arg === '--batch' || arg === '-p') {
      if (index + 1 >= args.length) {
        throw new Error('Missing value for --parallel.');
      }
      result.batchSize = parsePositiveInteger(args[index + 1], '--parallel');
      index += 2;
      continue;
    }

    if (arg.startsWith('--parallel=') || arg.startsWith('--batch=')) {
      const value = arg.substring(arg.indexOf('=') + 1);
      result.batchSize = parsePositiveInteger(value, '--parallel');
      index += 1;
      continue;
    }

    if (arg === '--additive' || arg === '-additive' || arg === '-a') {
      if (index + 1 >= args.length) {
        throw new Error('Missing value for --additive.');
      }
      result.additives.push(normaliseAdditiveSlug(args[index + 1]));
      index += 2;
      continue;
    }

    if (arg.startsWith('--additive=')) {
      const value = arg.substring(arg.indexOf('=') + 1);
      value
        .split(',')
        .map((part) => normaliseAdditiveSlug(part))
        .filter(Boolean)
        .forEach((slug) => result.additives.push(slug));
      index += 1;
      continue;
    }

    if (arg === '--override' || arg === '--mode=override') {
      result.mode = 'override';
      index += 1;
      continue;
    }

    if (arg === '--skip' || arg === '--mode=skip') {
      result.mode = 'skip';
      index += 1;
      continue;
    }

    if (arg.startsWith('--mode=')) {
      const value = arg.substring('--mode='.length).trim().toLowerCase();
      if (value === 'override' || value === 'skip') {
        result.mode = value;
      } else {
        throw new Error(`Unsupported mode: ${value}`);
      }
      index += 1;
      continue;
    }

    if (arg === '--debug') {
      result.debug = true;
      index += 1;
      continue;
    }

    if (arg.startsWith('-')) {
      throw new Error(`Unknown flag: ${arg}`);
    }

    result.additives.push(normaliseAdditiveSlug(arg));
    index += 1;
  }

  result.additives = result.additives.filter(Boolean);

  return result;
}

function matchOriginToken(token) {
  if (!token) {
    return null;
  }

  const compact = token.toLowerCase().replace(/[^a-z]/g, '');
  if (!compact) {
    return null;
  }

  for (const [canonical, aliases] of Object.entries(ORIGIN_ALIASES)) {
    if (aliases.includes(compact)) {
      return canonical;
    }
  }

  if (ALLOWED_ORIGINS.includes(compact)) {
    return compact;
  }

  return null;
}

function normaliseOriginValues(input) {
  if (!Array.isArray(input)) {
    return [];
  }

  const result = [];
  const seen = new Set();

  for (const value of input) {
    if (typeof value !== 'string') {
      continue;
    }
    const pieces = value
      .split(/(?:,|\/|;|\band\b)/i)
      .map((part) => part.trim())
      .filter(Boolean);

    for (const piece of pieces) {
      const matched = matchOriginToken(piece);
      if (matched && !seen.has(matched)) {
        seen.add(matched);
        result.push(matched);
      }
    }
  }

  return result;
}

async function readAdditiveProps(slug) {
  const filePath = path.join(DATA_DIR, slug, 'props.json');
  const directoryPath = path.dirname(filePath);

  await fs.mkdir(directoryPath, { recursive: true });

  if (!(await fileExists(filePath))) {
    return {
      filePath,
      data: {},
      origin: [],
    };
  }

  try {
    const raw = await fs.readFile(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    const origin = normaliseOriginValues(parsed.origin);
    return {
      filePath,
      data: parsed,
      origin,
    };
  } catch (error) {
    throw new Error(`Failed to read props for ${slug}: ${error.message}`);
  }
}

function extractTextOutput(response) {
  if (response && typeof response.output_text === 'string' && response.output_text.trim()) {
    return response.output_text.trim();
  }

  if (response && Array.isArray(response.output)) {
    for (const item of response.output) {
      if (item?.type === 'message' && Array.isArray(item.content)) {
        const textPart = item.content.find((contentItem) => contentItem?.type === 'output_text');
        if (textPart && typeof textPart.text === 'string' && textPart.text.trim()) {
          return textPart.text.trim();
        }
      }
    }
  }

  return '';
}

function extractJsonPayload(rawText) {
  if (!rawText) {
    return null;
  }

  try {
    return JSON.parse(rawText);
  } catch (error) {
    // fall through
  }

  const match = rawText.match(/\{[\s\S]*\}/);
  if (match) {
    try {
      return JSON.parse(match[0]);
    } catch (error) {
      return null;
    }
  }

  return null;
}

function callOpenAi({ apiKey, systemPrompt, additive, debug = false }) {
  const additiveLabel = [additive.eNumber, additive.title].filter(Boolean).join(' – ') || additive.slug;
  const requestPayload = {
    model: OPENAI_MODEL,
    max_output_tokens: OPENAI_MAX_OUTPUT_TOKENS,
    input: [
      {
        role: 'system',
        content: [{ type: 'input_text', text: systemPrompt }],
      },
      {
        role: 'user',
        content: [
          {
            type: 'input_text',
            text: `Input: ${additiveLabel}`,
          },
        ],
      },
    ],
  };

  if (debug) {
    console.log('[debug] OpenAI request payload:');
    try {
      console.log(JSON.stringify(requestPayload, null, 2));
    } catch (stringifyError) {
      console.dir(requestPayload, { depth: null });
    }
  }

  const requestBody = JSON.stringify(requestPayload);

  return new Promise((resolve, reject) => {
    const args = [
      '--silent',
      '--show-error',
      '--fail-with-body',
      '--request',
      'POST',
      '--header',
      'Content-Type: application/json',
      '--header',
      `Authorization: Bearer ${apiKey}`,
      '--data-binary',
      requestBody,
      'https://api.openai.com/v1/responses',
    ];

    const child = execFile('curl', args, { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (debug) {
        console.log('[debug] curl stdout:', stdout);
        if (stderr) {
          console.log('[debug] curl stderr:', stderr);
        }
      }

      if (error) {
        const message = stderr || error.message;
        reject(new Error(`OpenAI API request failed: ${message.trim()}`));
        return;
      }

      if (!stdout) {
        reject(new Error('OpenAI API returned an empty response body.'));
        return;
      }

      let parsedResponse;
      try {
        parsedResponse = JSON.parse(stdout);
      } catch (parseError) {
        reject(new Error(`Failed to parse OpenAI API response JSON: ${parseError.message}`));
        return;
      }

      const outputText = extractTextOutput(parsedResponse);
      if (!outputText) {
        reject(new Error('OpenAI API returned an empty response.'));
        return;
      }

      const parsedPayload = extractJsonPayload(outputText);
      if (!parsedPayload || !Array.isArray(parsedPayload.origin)) {
        reject(new Error('OpenAI API response did not contain a valid origin array.'));
        return;
      }

      const originValues = normaliseOriginValues(parsedPayload.origin);
      if (originValues.length === 0) {
        reject(new Error('OpenAI API response did not contain recognised origin values.'));
        return;
      }

      resolve(originValues);
    });

    child.stdin?.end();
  });
}

function sortOriginValues(values) {
  const order = new Map(ALLOWED_ORIGINS.map((origin, index) => [origin, index]));
  return values.slice().sort((a, b) => {
    const indexA = order.has(a) ? order.get(a) : Number.MAX_SAFE_INTEGER;
    const indexB = order.has(b) ? order.get(b) : Number.MAX_SAFE_INTEGER;
    return indexA - indexB;
  });
}

async function processAdditive({
  additive,
  props,
  promptTemplate,
  apiKey,
  index,
  total,
  debug = false,
}) {
  const relativePropsPath = path.join('data', additive.slug, 'props.json');
  const additiveLabel = [additive.eNumber, additive.title].filter(Boolean).join(' - ') || additive.slug;

  console.log(`[${index + 1}/${total}] Fetching origin for ${additiveLabel}...`);

  const originValues = await callOpenAi({ apiKey, systemPrompt: promptTemplate, additive, debug });
  const sortedOrigin = sortOriginValues(originValues);

  const updated = {
    ...props.data,
    origin: sortedOrigin,
  };

  await fs.writeFile(props.filePath, `${JSON.stringify(updated, null, 2)}\n`, 'utf8');

  console.log(`[${index + 1}/${total}] Saved origin (${sortedOrigin.join(', ')}) to ${relativePropsPath}.`);
}

async function run() {
  try {
    const apiKey = await loadApiKey();
    const promptTemplate = await readPromptTemplate();
    const additives = await readAdditivesIndex();
    const cliArgs = parseCommandLineArgs(process.argv);

    const envLimitRaw = process.env.GENERATOR_LIMIT;
    const envBatchRaw = process.env.GENERATOR_BATCH;

    let limit = DEFAULT_LIMIT;
    if (cliArgs.limit !== null) {
      limit = cliArgs.limit;
      console.log(`Using CLI limit=${limit}`);
    } else if (envLimitRaw) {
      const parsed = Number.parseInt(envLimitRaw, 10);
      if (!Number.isNaN(parsed) && parsed > 0) {
        limit = parsed;
        console.log(`Using GENERATOR_LIMIT=${parsed}`);
      } else {
        console.warn(`Ignoring invalid GENERATOR_LIMIT value: ${envLimitRaw}`);
      }
    }

    let batchSize = DEFAULT_BATCH_SIZE;
    if (cliArgs.batchSize !== null) {
      batchSize = cliArgs.batchSize;
      console.log(`Using CLI parallel=${batchSize}`);
    } else if (envBatchRaw) {
      const parsed = Number.parseInt(envBatchRaw, 10);
      if (!Number.isNaN(parsed) && parsed > 0) {
        batchSize = parsed;
        console.log(`Using GENERATOR_BATCH=${parsed}`);
      } else {
        console.warn(`Ignoring invalid GENERATOR_BATCH value: ${envBatchRaw}`);
      }
    }

    const additiveMap = new Map(additives.map((entry) => [entry.slug, entry]));
    const candidates = [];

    if (cliArgs.additives.length > 0) {
      if (cliArgs.limit !== null) {
        console.warn('Ignoring --limit because specific additives were provided via --additive.');
      }

      const missingSlugs = [];

      for (const slug of cliArgs.additives) {
        const additive = additiveMap.get(slug);
        if (!additive) {
          missingSlugs.push(slug);
          continue;
        }

        let props;
        try {
          props = await readAdditiveProps(additive.slug);
        } catch (error) {
          console.error(`Failed to load props for ${slug}: ${error.message}`);
          continue;
        }

        if (cliArgs.mode === 'skip' && props.origin.length > 0) {
          console.log(
            `Skipping ${slug} because origin already exists (${props.origin.join(', ')}). Use --override to regenerate.`,
          );
          continue;
        }

        if (props.origin.length > 0) {
          console.log(`Will regenerate existing origin for ${slug}.`);
        } else {
          console.log(`Will create new origin for ${slug}.`);
        }

        candidates.push({ additive, props });
      }

      if (missingSlugs.length) {
        missingSlugs.forEach((slug) => {
          console.warn(`No additive found for slug: ${slug}`);
        });
      }

      if (candidates.length === 0) {
        console.log('No additives matched the provided slugs. Exiting.');
        return;
      }
    } else {
      for (const additive of additives) {
        let props;
        try {
          props = await readAdditiveProps(additive.slug);
        } catch (error) {
          console.error(`Failed to load props for ${additive.slug}: ${error.message}`);
          continue;
        }

        if (cliArgs.mode === 'skip' && props.origin.length > 0) {
          const additiveLabel = [additive.eNumber, additive.title].filter(Boolean).join(' - ') || additive.slug;
          console.log(`Skipping existing origin: ${additiveLabel}`);
          continue;
        }

        candidates.push({ additive, props });

        if (candidates.length >= limit) {
          break;
        }
      }

      if (candidates.length === 0) {
        console.log('No additives require new origins. Exiting.');
        return;
      }
    }

    console.log(
      `Preparing to update origins for ${candidates.length} additive(s) with batch size ${Math.min(
        batchSize,
        candidates.length,
      )}...`,
    );

    let currentIndex = 0;
    const total = candidates.length;
    const errors = [];

    const workers = Array.from({ length: Math.min(batchSize, candidates.length) }, async () => {
      while (true) {
        let localIndex;
        let entry;

        if (currentIndex >= candidates.length) {
          return;
        }

        localIndex = currentIndex;
        currentIndex += 1;
        entry = candidates[localIndex];

        try {
          await processAdditive({
            additive: entry.additive,
            props: entry.props,
            promptTemplate,
            apiKey,
            index: localIndex,
            total,
            debug: cliArgs.debug,
          });
        } catch (error) {
          console.error(
            `[${localIndex + 1}/${total}] Failed to update origin for ${entry.additive.slug}: ${error.message}`,
          );
          errors.push({ slug: entry.additive.slug, error });
        }
      }
    });

    await Promise.all(workers);

    if (errors.length > 0) {
      console.error(`Completed with ${errors.length} error(s).`);
      process.exitCode = 1;
    } else {
      console.log('Completed updating origins for all additives.');
    }
  } catch (error) {
    console.error('Fatal error:', error.message);
    process.exitCode = 1;
  }
}

run();
