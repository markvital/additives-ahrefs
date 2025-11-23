#!/usr/bin/env node

/**
 * Article generator script
 *
 * Behaviour
 * - Loads unpublished additives (no `data/additive/<slug>/article.md`) and creates Markdown articles in batches
 *   using the OpenAI Responses API (model `gpt-5`, 6000 max output tokens).
 * - Already generated articles are skipped automatically in default mode.
 * - The generated markdown is written to `data/additive/<slug>/article.md`; `props.json` remains untouched.
 *
 * Defaults & overrides
 * - Default limit: 10 new articles per run.
 * - Default parallelism: 10 concurrent workers.
 * - Environment overrides: `GENERATOR_LIMIT`, `GENERATOR_BATCH` (must be positive integers).
 * - CLI overrides:
 *     --limit, -n, --limit=<value>          → set number of articles to create (ignored with --additive).
 *     --parallel, --batch, -p, --parallel=<value>
                                          → set parallel worker count.
 *     --additive/-additive/-a <slug...> or --additive=<slug[,slug...]>
                                          → regenerate specific additive slugs (bypasses skip logic).
 *   Positional arguments without flags are treated as additive slugs as well.
 *
 * Examples
 *   node src/scripts/generate-articles.js                 # default behaviour, skip existing
 *   node src/scripts/generate-articles.js --limit 5 -p 2  # headless batch with overrides
 *   node src/scripts/generate-articles.js -additive e1503-castor-oil e1510-ethanol
 *                                                   # targeted regeneration for listed slugs
 */

const fs = require('fs/promises');
const path = require('path');
const dns = require('dns');

const OpenAI = require('openai');

const { createAdditiveSlug } = require('./utils/slug');
const { updateLastUpdatedTimestamp } = require('./utils/last-updated');

dns.setDefaultResultOrder('ipv4first');

const DEFAULT_LIMIT = 10;
const DEFAULT_BATCH_SIZE = 10;
const OPENAI_MODEL = 'gpt-5';
const OPENAI_MAX_OUTPUT_TOKENS = 15000;
const PROMPT_PATH = path.join(__dirname, 'prompts', 'additive-article.txt');
const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const ADDITIVE_DIR = path.join(DATA_DIR, 'additive');
const ADDITIVES_INDEX_PATH = path.join(DATA_DIR, 'additives.json');
const ENV_LOCAL_PATH = path.join(__dirname, '..', '..', 'env.local');

let hasChanges = false;


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

    if (
      arg === '--additive'
      || arg === '-additive'
      || arg === '-a'
    ) {
      const values = [];
      let next = index + 1;
      while (next < args.length && !args[next].startsWith('-')) {
        values.push(args[next]);
        next += 1;
      }
      if (values.length === 0) {
        throw new Error('No additive slugs supplied after --additive.');
      }
      result.additives.push(...values);
      index = next;
      continue;
    }

    if (arg.startsWith('--additive=') || arg.startsWith('-additive=')) {
      const value = arg.substring(arg.indexOf('=') + 1);
      if (!value) {
        throw new Error('No additive slug supplied after --additive=.');
      }
      const parts = value.split(',').map((entry) => entry.trim()).filter(Boolean);
      if (parts.length === 0) {
        throw new Error('No additive slug supplied after --additive=.');
      }
      result.additives.push(...parts);
      index += 1;
      continue;
    }

    if (arg === '--debug' || arg === '-debug') {
      result.debug = true;
      index += 1;
      continue;
    }

    if (arg.startsWith('-')) {
      console.warn(`Ignoring unknown argument: ${arg}`);
      index += 1;
      continue;
    }

    // Positional arguments without flags are treated as additive slugs for convenience.
    result.additives.push(arg);
    index += 1;
  }

  if (result.additives.length) {
    const seen = new Set();
    result.additives = result.additives
      .map(normaliseAdditiveSlug)
      .filter((slug) => {
        if (!slug || seen.has(slug)) {
          return false;
        }
        seen.add(slug);
        return true;
      });
  }

  return result;
}

async function readAdditiveProps(slug) {
  const propsPath = path.join(ADDITIVE_DIR, slug, 'props.json');
  if (!(await fileExists(propsPath))) {
    return {};
  }

  try {
    return await readJson(propsPath);
  } catch (error) {
    console.warn(`Failed to read props for ${slug}: ${error.message}`);
    return {};
  }
}

function normaliseSynonyms(synonyms) {
  if (!Array.isArray(synonyms)) {
    return [];
  }

  return synonyms
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter((item, index, list) => item.length > 0 && list.indexOf(item) === index);
}

function normaliseFunctions(functions) {
  if (!Array.isArray(functions)) {
    return [];
  }

  return functions
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter((item, index, list) => item.length > 0 && list.indexOf(item) === index);
}

async function callOpenAi(client, systemPrompt, payload, slugListText, { debug = false } = {}) {
  const additiveLabel = [payload.eNumber, payload.title].filter(Boolean).join(' — ') || 'the additive';

  try {
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
              text: [
                'Known additive slugs for internal linking (comma separated):',
                slugListText,
                '',
                `Create a publish-ready Markdown article about ${additiveLabel}.`,
                'Respect all layout, linking, and validation requirements in the system prompt.',
                'Return only the Markdown article content. Do not include summaries or additional formats.',
                '',
                `Additive metadata:\n${JSON.stringify(payload, null, 2)}`,
                `Additive title: ${payload.title ?? ''}`,
                `Additive e-number: ${payload.eNumber ?? ''}`,
              ].join('\n'),
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

    const response = await client.responses.create(requestPayload);

    if (debug) {
      console.log('[debug] OpenAI response payload:');
      try {
        console.log(JSON.stringify(response, null, 2));
      } catch (stringifyError) {
        console.dir(response, { depth: null });
      }
    }

    let articleMarkdown = '';
    if (typeof response.output_text === 'string' && response.output_text.trim()) {
      articleMarkdown = response.output_text.trim();
    }

    if (!articleMarkdown && Array.isArray(response.output)) {
      for (const item of response.output) {
        if (item?.type === 'message' && Array.isArray(item.content)) {
          const textPart = item.content.find((contentItem) => contentItem?.type === 'output_text');
          if (textPart && typeof textPart.text === 'string' && textPart.text.trim()) {
            articleMarkdown = textPart.text.trim();
            break;
          }
        }
      }
    }

    if (!articleMarkdown) {
      throw new Error('OpenAI API returned an empty article.');
    }

    return articleMarkdown;
  } catch (error) {
    if (error instanceof OpenAI.APIError) {
      const details = error.error?.message || error.message;
      throw new Error(`OpenAI API request failed (status ${error.status ?? 'unknown'}): ${details}`);
    }

    if (error && typeof error === 'object' && 'message' in error) {
      throw new Error(error.message);
    }

    throw error;
  }
}

async function processAdditive({
  additive,
  props,
  promptTemplate,
  apiClient,
  index,
  total,
  slugListText,
  debug = false,
}) {
  const relativeSlugDir = path.join('data', 'additive', additive.slug);
  const articlePath = path.join(ADDITIVE_DIR, additive.slug, 'article.md');
  const additiveLabel = [additive.eNumber, additive.title].filter(Boolean).join(' - ') || additive.slug;
  console.log(`[${index + 1}/${total}] Generating article for ${additiveLabel}...`);

  const synonyms = normaliseSynonyms(props.synonyms);
  const functions = normaliseFunctions(props.functions);
  const metadataPayload = {
    title: additive.title,
    eNumber: additive.eNumber,
    synonyms,
    functions,
    wikipedia: typeof props.wikipedia === 'string' ? props.wikipedia : '',
  };

  const articleMarkdown = await callOpenAi(apiClient, promptTemplate, metadataPayload, slugListText, { debug });

  await fs.mkdir(path.join(ADDITIVE_DIR, additive.slug), { recursive: true });
  await fs.writeFile(articlePath, `${articleMarkdown.trim()}\n`, 'utf8');
  hasChanges = true;

  console.log(`[${index + 1}/${total}] Saved article to ${path.join(relativeSlugDir, 'article.md')}.`);
}

async function run() {
  try {
    const apiKey = await loadApiKey();
    const apiClient = new OpenAI({ apiKey });
    const promptTemplate = await readPromptTemplate();
    const additives = await readAdditivesIndex();
    const allSlugs = Array.from(new Set(additives.map((entry) => entry.slug).filter(Boolean)));
    const slugListText = allSlugs.join(', ');
    const cliArgs = parseCommandLineArgs(process.argv);

    const envLimitRaw = process.env.GENERATOR_LIMIT;
    const envBatchRaw = process.env.GENERATOR_BATCH;
    const debugEnabled = Boolean(cliArgs.debug);

    if (debugEnabled) {
      console.log('Debug logging enabled: OpenAI request and response payloads will be printed.');
    }

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

    const candidates = [];

    if (cliArgs.additives.length > 0) {
      if (cliArgs.limit !== null) {
        console.warn('Ignoring --limit because specific additives were provided via --additive.');
      }

      const additiveMap = new Map(additives.map((entry) => [entry.slug, entry]));
      const missingSlugs = [];

      for (const slug of cliArgs.additives) {
        const additive = additiveMap.get(slug);
        if (!additive) {
          missingSlugs.push(slug);
          continue;
        }

        const articlePath = path.join(ADDITIVE_DIR, additive.slug, 'article.md');
        const additiveLabel = [additive.eNumber, additive.title].filter(Boolean).join(' - ') || additive.slug;
        if (await fileExists(articlePath)) {
          console.log(`Will regenerate existing article: ${additiveLabel}`);
        } else {
          console.log(`Will create new article: ${additiveLabel}`);
        }

        candidates.push(additive);
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
        const articlePath = path.join(ADDITIVE_DIR, additive.slug, 'article.md');
        if (await fileExists(articlePath)) {
          const additiveLabel = [additive.eNumber, additive.title].filter(Boolean).join(' - ') || additive.slug;
          console.log(`Skipping existing article: ${additiveLabel}`);
          continue;
        }
        candidates.push(additive);
        if (candidates.length >= limit) {
          break;
        }
      }

      if (candidates.length === 0) {
        console.log('No additives require new articles. Exiting.');
        return;
      }
    }

    console.log(
      `Preparing to generate ${candidates.length} article(s) with batch size ${Math.min(batchSize, candidates.length)}...`,
    );

    let currentIndex = 0;
    const total = candidates.length;
    const errors = [];

    const workers = Array.from({ length: Math.min(batchSize, candidates.length) }, async () => {
      while (currentIndex < candidates.length) {
        const localIndex = currentIndex;
        currentIndex += 1;
        const additive = candidates[localIndex];
        const props = await readAdditiveProps(additive.slug);

        try {
          await processAdditive({
            additive,
            props,
            promptTemplate,
            apiClient,
            index: localIndex,
            total,
            slugListText,
            debug: debugEnabled,
          });
        } catch (error) {
          console.error(
            `[${localIndex + 1}/${total}] Failed to generate article for ${additive.slug}: ${error.message}`,
          );
          errors.push({ slug: additive.slug, error });
        }
      }
    });

    await Promise.all(workers);

    if (hasChanges) {
      await updateLastUpdatedTimestamp();
    }

    if (errors.length) {
      console.log('Completed with errors for the following additives:');
      errors.forEach((entry) => {
        console.log(` - ${entry.slug}: ${entry.error.message}`);
      });
      process.exitCode = 1;
    } else {
      console.log('All requested articles generated successfully.');
    }
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}

run();
