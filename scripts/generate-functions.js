#!/usr/bin/env node

/**
 * Additive functions enrichment script
 *
 * Behaviour
 * - Loads additives missing function metadata (empty `functions` array in `data/<slug>/props.json`) and
 *   enriches them via the OpenAI Responses API (model `gpt-5`).
 * - Existing function arrays are skipped by default. Use --override to refresh them.
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
 *     --override, --mode=override          → regenerate functions even if already present.
 *     --skip, --mode=skip                  → skip additives with existing functions (default).
 *     --debug                              → print OpenAI request/response payloads.
 */

const fs = require('fs/promises');
const path = require('path');
const dns = require('dns');
const { execFile } = require('child_process');

const { createAdditiveSlug } = require('./utils/slug');
const { loadEnvConfig, resolveOpenAiApiKey } = require('./utils/env');

dns.setDefaultResultOrder('ipv4first');

const DEFAULT_LIMIT = 10;
const DEFAULT_BATCH_SIZE = 10;
const OPENAI_MODEL = 'gpt-5';
const OPENAI_MAX_OUTPUT_TOKENS = 2500;
const PROMPT_PATH = path.join(__dirname, 'prompts', 'additive-functions.txt');
const DATA_DIR = path.join(__dirname, '..', 'data');
const ADDITIVES_INDEX_PATH = path.join(DATA_DIR, 'additives.json');
const FUNCTIONS_REFERENCE_PATH = path.join(DATA_DIR, 'functions.json');


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
    modeExplicit: false,
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
      result.modeExplicit = true;
      index += 1;
      continue;
    }

    if (arg === '--skip' || arg === '--mode=skip') {
      result.mode = 'skip';
      result.modeExplicit = true;
      index += 1;
      continue;
    }

    if (arg.startsWith('--mode=')) {
      const value = arg.substring('--mode='.length).trim().toLowerCase();
      if (value === 'override' || value === 'skip') {
        result.mode = value;
        result.modeExplicit = true;
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

function normaliseFunctionIdentifier(value) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function addLookupEntry(map, key, value) {
  if (!key || map.has(key)) {
    return;
  }
  map.set(key, value);
}

async function loadFunctionReference() {
  const data = await readJson(FUNCTIONS_REFERENCE_PATH);
  if (!Array.isArray(data)) {
    throw new Error('Unexpected functions reference format.');
  }

  const entries = [];
  const lookup = new Map();

  for (const item of data) {
    const label = typeof item?.name === 'string' ? item.name.trim() : '';
    if (!label) {
      continue;
    }

    const description = typeof item?.description === 'string' ? item.description.trim() : '';
    const identifier = normaliseFunctionIdentifier(label);
    if (!identifier) {
      continue;
    }

    const usedAs = Array.isArray(item?.usedAs)
      ? item.usedAs
          .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
          .filter((entry) => entry.length > 0)
      : [];

    const reference = {
      value: identifier,
      label,
      description,
      usedAs,
    };

    entries.push(reference);

    const aliasValues = [label, identifier.replace(/-/g, ' '), ...usedAs];

    for (const alias of aliasValues) {
      if (!alias) {
        continue;
      }

      const lowerAlias = alias.toLowerCase();
      addLookupEntry(lookup, lowerAlias, reference);
      addLookupEntry(lookup, lowerAlias.replace(/-/g, ' '), reference);

      const aliasIdentifier = normaliseFunctionIdentifier(alias);
      if (aliasIdentifier) {
        addLookupEntry(lookup, aliasIdentifier, reference);
        addLookupEntry(lookup, aliasIdentifier.replace(/-/g, ' '), reference);
      }
    }
  }

  const names = entries.map((entry) => entry.label);

  return { entries, lookup, names };
}

async function readPromptTemplate() {
  return fs.readFile(PROMPT_PATH, 'utf8');
}

async function readAdditiveProps(slug) {
  const filePath = path.join(DATA_DIR, slug, 'props.json');
  const directoryPath = path.dirname(filePath);

  await fs.mkdir(directoryPath, { recursive: true });

  if (!(await fileExists(filePath))) {
    return {
      filePath,
      data: {},
      functions: [],
    };
  }

  try {
    const raw = await fs.readFile(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    const functions = Array.isArray(parsed.functions)
      ? parsed.functions
          .map((item) => (typeof item === 'string' ? item.trim() : ''))
          .filter((item, index, list) => item.length > 0 && list.indexOf(item) === index)
      : [];

    return {
      filePath,
      data: parsed,
      functions,
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

function sanitiseJsonCandidate(candidate) {
  if (!candidate) {
    return null;
  }

  let text = candidate.trim();

  if (!text) {
    return null;
  }

  if (text.startsWith('```')) {
    const blockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (blockMatch) {
      text = blockMatch[1].trim();
    }
  }

  if (!text.startsWith('{') && !text.startsWith('[')) {
    const bracesMatch = text.match(/\{[\s\S]*\}/);
    if (bracesMatch) {
      text = bracesMatch[0];
    } else {
      return null;
    }
  }

  text = text.replace(/^[\ufeff\s]+/, '').replace(/;?\s*$/, '');

  const withQuotedKeys = text.replace(/([,{]\s*)([A-Za-z0-9_-]+)\s*:/g, (match, prefix, key) => {
    return `${prefix}"${key}":`;
  });

  const withNormalisedQuotes = withQuotedKeys.replace(/'([^'\\]*)'/g, (match, value) => {
    return `"${value.replace(/"/g, '\\"')}"`;
  });

  const withoutTrailingCommas = withNormalisedQuotes.replace(/,\s*([}\]])/g, '$1');

  return withoutTrailingCommas;
}

function extractJsonPayload(rawText) {
  if (!rawText) {
    return null;
  }

  const candidates = [];
  const trimmed = rawText.trim();

  if (trimmed) {
    candidates.push(trimmed);
  }

  const codeBlockMatches = trimmed.match(/```(?:json)?\s*[\s\S]*?```/gi);
  if (Array.isArray(codeBlockMatches)) {
    codeBlockMatches.forEach((match) => {
      candidates.push(match);
    });
  }

  const bracesMatch = trimmed.match(/\{[\s\S]*\}/);
  if (bracesMatch) {
    candidates.push(bracesMatch[0]);
  }

  for (const candidate of candidates) {
    const sanitised = sanitiseJsonCandidate(candidate);
    if (!sanitised) {
      continue;
    }

    try {
      return JSON.parse(sanitised);
    } catch (error) {
      // try next candidate
    }
  }

  return null;
}

function normaliseFunctionValues(input, lookup) {
  if (!Array.isArray(input)) {
    return [];
  }

  const result = [];
  const seen = new Set();

  for (const item of input) {
    if (typeof item !== 'string') {
      continue;
    }

    const trimmed = item.trim();
    if (!trimmed) {
      continue;
    }

    const normalized = trimmed.toLowerCase();
    const slugValue = normaliseFunctionIdentifier(trimmed);

    const candidates = [normalized, normalized.replace(/-/g, ' '), slugValue, slugValue.replace(/-/g, ' ')];

    let matched = null;
    for (const candidate of candidates) {
      if (lookup.has(candidate)) {
        matched = lookup.get(candidate);
        break;
      }
    }

    if (!matched) {
      throw new Error(`Unrecognised function value: ${trimmed}`);
    }

    if (!seen.has(matched.value)) {
      seen.add(matched.value);
      result.push(matched.value);
    }
  }

  return result;
}

function sortFunctionValues(values) {
  return values.slice().sort((a, b) => a.localeCompare(b));
}

function createAdditivePrompt(additive) {
  const eNumber = typeof additive.eNumber === 'string' ? additive.eNumber.trim() : '';
  const title = typeof additive.title === 'string' ? additive.title.trim() : '';

  const parts = [];
  if (eNumber) {
    parts.push(eNumber);
  }
  if (title && title.toLowerCase() !== eNumber.toLowerCase()) {
    parts.push(title);
  }

  const label = parts.length > 0 ? parts.join(' – ') : additive.slug;
  return `Additive: ${label}`;
}

function callOpenAi({ apiKey, systemPrompt, functionListInput, additiveInput, debug = false }) {
  const trimmedList = typeof functionListInput === 'string' ? functionListInput.trim() : '';
  if (!trimmedList) {
    throw new Error('Function list input must be a non-empty string.');
  }

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
            text: trimmedList,
          },
        ],
      },
      {
        role: 'user',
        content: [
          {
            type: 'input_text',
            text: additiveInput,
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

      const responseStatus = typeof parsedResponse?.status === 'string' ? parsedResponse.status : null;
      if (responseStatus && responseStatus !== 'completed') {
        const incompleteReason = parsedResponse?.incomplete_details?.reason;
        const errorMessage = parsedResponse?.error?.message;
        const detailFragments = [];
        if (incompleteReason) {
          detailFragments.push(`reason=${incompleteReason}`);
        }
        if (errorMessage) {
          detailFragments.push(`error=${errorMessage}`);
        }
        const detailMessage = detailFragments.length > 0 ? detailFragments.join(', ') : 'no additional details';
        console.error(`[error] OpenAI response not completed (status=${responseStatus}): ${detailMessage}`);
        reject(new Error(`OpenAI API response status was ${responseStatus}.`));
        return;
      }

      const outputText = extractTextOutput(parsedResponse);
      if (!outputText) {
        console.error('[error] OpenAI response did not include output_text field.', {
          hasOutputArray: Array.isArray(parsedResponse?.output),
        });
        reject(new Error('OpenAI API returned an empty response.'));
        return;
      }

      resolve(outputText);
    });

    child.stdin?.end();
  });
}

async function processAdditive({
  additive,
  props,
  systemPrompt,
  functionListInput,
  lookup,
  apiKey,
  index,
  total,
  debug = false,
}) {
  const relativePropsPath = path.join('data', additive.slug, 'props.json');
  const additiveLabel = [additive.eNumber, additive.title].filter(Boolean).join(' - ') || additive.slug;

  console.log(`[${index + 1}/${total}] Fetching functions for ${additiveLabel}...`);

  const additiveInput = createAdditivePrompt(additive);
  const outputText = await callOpenAi({
    apiKey,
    systemPrompt,
    functionListInput,
    additiveInput,
    debug,
  });
  const parsedPayload = extractJsonPayload(outputText);

  if (!parsedPayload || !Array.isArray(parsedPayload.functions)) {
    throw new Error('OpenAI API response did not contain a valid functions array.');
  }

  const normalizedFunctions = sortFunctionValues(normaliseFunctionValues(parsedPayload.functions, lookup));

  if (normalizedFunctions.length === 0) {
    throw new Error('OpenAI API response resulted in an empty function list.');
  }

  const updated = {
    ...props.data,
    functions: normalizedFunctions,
  };

  await fs.writeFile(props.filePath, `${JSON.stringify(updated, null, 2)}\n`, 'utf8');

  console.log(
    `[${index + 1}/${total}] Saved functions (${normalizedFunctions.join(', ')}) to ${relativePropsPath}.`,
  );
}

async function run() {
  try {
    await loadEnvConfig();
    const apiKey = resolveOpenAiApiKey();
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY not found in environment or env.local.');
    }

    const functionReference = await loadFunctionReference();
    const promptTemplate = await readPromptTemplate();
    const systemPrompt = typeof promptTemplate === 'string' ? promptTemplate.trim() : '';
    if (!systemPrompt) {
      throw new Error('Prompt template is empty.');
    }

    if (functionReference.names.length === 0) {
      throw new Error('No function names loaded from reference.');
    }

    const functionListInput = ['Allowed function names:', ...functionReference.names].join('\n');
    const additives = await readAdditivesIndex();
    const cliArgs = parseCommandLineArgs(process.argv);

    if (cliArgs.additives.length > 0 && !cliArgs.modeExplicit) {
      cliArgs.mode = 'override';
    }

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

        if (cliArgs.mode === 'skip' && props.functions.length > 0) {
          console.log(
            `Skipping ${slug} because functions already exist (${props.functions.join(', ')}). Use --override to regenerate.`,
          );
          continue;
        }

        if (props.functions.length > 0) {
          console.log(`Will regenerate existing functions for ${slug}.`);
        } else {
          console.log(`Will create new functions for ${slug}.`);
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

        if (cliArgs.mode === 'skip' && props.functions.length > 0) {
          const additiveLabel = [additive.eNumber, additive.title].filter(Boolean).join(' - ') || additive.slug;
          console.log(`Skipping existing functions: ${additiveLabel}`);
          continue;
        }

        candidates.push({ additive, props });

        if (candidates.length >= limit) {
          break;
        }
      }

      if (candidates.length === 0) {
        console.log('No additives require new functions. Exiting.');
        return;
      }
    }

    console.log(
      `Preparing to update functions for ${candidates.length} additive(s) with batch size ${Math.min(
        batchSize,
        candidates.length,
      )}...`,
    );

    let currentIndex = 0;
    const total = candidates.length;
    const errors = [];

    const workers = Array.from({ length: Math.min(batchSize, candidates.length) }, async () => {
      while (true) {
        if (currentIndex >= candidates.length) {
          return;
        }

        const localIndex = currentIndex;
        currentIndex += 1;
        const entry = candidates[localIndex];

        try {
          await processAdditive({
            additive: entry.additive,
            props: entry.props,
            systemPrompt,
            functionListInput,
            lookup: functionReference.lookup,
            apiKey,
            index: localIndex,
            total,
            debug: cliArgs.debug,
          });
        } catch (error) {
          console.error(
            `[${localIndex + 1}/${total}] Failed to update functions for ${entry.additive.slug}: ${error.message}`,
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
      console.log('Completed updating functions for all additives.');
    }
  } catch (error) {
    console.error('Fatal error:', error.message);
    process.exitCode = 1;
  }
}

run();
