#!/usr/bin/env node

const fs = require('fs/promises');
const path = require('path');
const dns = require('dns');

const OpenAI = require('openai');

const { createAdditiveSlug } = require('./utils/slug');

dns.setDefaultResultOrder('ipv4first');

const DEFAULT_LIMIT = 10;
const DEFAULT_BATCH_SIZE = 10;
const OPENAI_MODEL = 'gpt-5';
const OPENAI_MAX_OUTPUT_TOKENS = 6000;
const PROMPT_PATH = path.join(__dirname, 'prompts', 'additive-article.txt');
const DATA_DIR = path.join(__dirname, '..', 'data');
const ADDITIVES_INDEX_PATH = path.join(DATA_DIR, 'additives.json');
const ENV_LOCAL_PATH = path.join(__dirname, '..', 'env.local');


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

async function readAdditiveProps(slug) {
  const propsPath = path.join(DATA_DIR, slug, 'props.json');
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

async function callOpenAi(client, systemPrompt, payload) {
  const additiveLabel = [payload.eNumber, payload.title].filter(Boolean).join(' — ') || 'the additive';

  try {
    const response = await client.responses.create({
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
                `Create a publish-ready Markdown article about ${additiveLabel}.`,
                'Respect all layout, linking, and validation requirements in the system prompt.',
                'Use the PubChem URL exactly as provided. Do not fabricate URLs.',
                'Return only the Markdown article content. Do not include summaries or additional formats.',
                '',
                `Additive metadata:\n${JSON.stringify(payload, null, 2)}`,
              ].join('\n'),
            },
          ],
        },
      ],
    });

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
}) {
  const relativeSlugDir = path.join('data', additive.slug);
  const articlePath = path.join(DATA_DIR, additive.slug, 'article.md');
  console.log(`[${index + 1}/${total}] Generating article for ${additive.eNumber || additive.title || additive.slug}...`);

  const synonyms = normaliseSynonyms(props.synonyms);
  const functions = normaliseFunctions(props.functions);
  const metadataPayload = {
    title: additive.title,
    eNumber: additive.eNumber,
    synonyms,
    functions,
    wikipedia: typeof props.wikipedia === 'string' ? props.wikipedia : '',
  };

  const articleMarkdown = await callOpenAi(apiClient, promptTemplate, metadataPayload);

  await fs.mkdir(path.join(DATA_DIR, additive.slug), { recursive: true });
  await fs.writeFile(articlePath, `${articleMarkdown.trim()}\n`, 'utf8');

  console.log(`[${index + 1}/${total}] Saved article to ${path.join(relativeSlugDir, 'article.md')}.`);
}

async function run() {
  try {
    const apiKey = await loadApiKey();
    const apiClient = new OpenAI({ apiKey });
    const promptTemplate = await readPromptTemplate();
    const additives = await readAdditivesIndex();

    const rl = stdin.isTTY && stdout.isTTY
      ? readline.createInterface({ input: stdin, output: stdout })
      : null;

    try {
      const envLimitRaw = process.env.GENERATOR_LIMIT;
      const envBatchRaw = process.env.GENERATOR_BATCH;

      let limit;
      if (envLimitRaw) {
        const parsed = Number.parseInt(envLimitRaw, 10);
        if (!Number.isNaN(parsed) && parsed > 0) {
          limit = parsed;
          console.log(`Using GENERATOR_LIMIT=${parsed}`);
        } else {
          console.warn(`Ignoring invalid GENERATOR_LIMIT value: ${envLimitRaw}`);
        }
      }
      if (!limit) {
        limit = await promptForNumber('How many new articles should be generated?', DEFAULT_LIMIT, rl);
      }

      let batchSize;
      if (envBatchRaw) {
        const parsed = Number.parseInt(envBatchRaw, 10);
        if (!Number.isNaN(parsed) && parsed > 0) {
          batchSize = parsed;
          console.log(`Using GENERATOR_BATCH=${parsed}`);
        } else {
          console.warn(`Ignoring invalid GENERATOR_BATCH value: ${envBatchRaw}`);
        }
      }
      if (!batchSize) {
        batchSize = await promptForNumber('How many articles should be generated in parallel?', DEFAULT_BATCH_SIZE, rl);
      }

      if (rl) {
        rl.close();
      }

      const candidates = [];
      for (const additive of additives) {
        const articlePath = path.join(DATA_DIR, additive.slug, 'article.md');
        if (await fileExists(articlePath)) {
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

      if (errors.length) {
        console.log('Completed with errors for the following additives:');
        errors.forEach((entry) => {
          console.log(` - ${entry.slug}: ${entry.error.message}`);
        });
        process.exitCode = 1;
      } else {
        console.log('All requested articles generated successfully.');
      }
    } finally {
      if (rl && !rl.closed) {
        rl.close();
      }
    }
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}

run();
