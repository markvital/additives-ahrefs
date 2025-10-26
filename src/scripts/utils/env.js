const fs = require('fs/promises');
const path = require('path');

const ROOT_DIR = path.join(__dirname, '..', '..', '..');
const ENV_FILENAMES = ['.env.local', 'env.local'];
const AHREFS_KEYS = ['AHREFS_API_KEY', 'AHREFS_API_TOKEN', 'AHREFS_TOKEN'];
const OPENAI_KEYS = ['OPENAI_API_KEY'];

let cachedEnv = null;
let loadPromise = null;

const parseEnvValue = (raw) => {
  if (typeof raw !== 'string') {
    return '';
  }
  const trimmed = raw.trim();
  if (!trimmed) {
    return '';
  }
  const withoutQuotes =
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
      ? trimmed.slice(1, -1)
      : trimmed;
  return withoutQuotes.replace(/\\n/g, '\n');
};

const parseEnvFile = (contents) => {
  const result = {};
  const lines = contents.split(/\r?\n/);
  lines.forEach((line) => {
    if (!line || typeof line !== 'string') {
      return;
    }
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      return;
    }
    const equalsIndex = trimmed.indexOf('=');
    if (equalsIndex === -1) {
      return;
    }
    const key = trimmed.slice(0, equalsIndex).trim();
    const value = parseEnvValue(trimmed.slice(equalsIndex + 1));
    if (!key) {
      return;
    }
    result[key] = value;
  });
  return result;
};

const applyEnv = (entries, { override = false, debug = false } = {}) => {
  Object.entries(entries).forEach(([key, value]) => {
    if (!override && Object.prototype.hasOwnProperty.call(process.env, key)) {
      return;
    }
    if (debug) {
      console.log(`Loaded env ${key}`);
    }
    process.env[key] = value;
  });
};

const loadEnvConfig = async ({ debug = false, override = false } = {}) => {
  if (cachedEnv) {
    return cachedEnv;
  }
  if (loadPromise) {
    return loadPromise;
  }

  loadPromise = (async () => {
    const aggregated = {};
    for (const filename of ENV_FILENAMES) {
      const filePath = path.join(ROOT_DIR, filename);
      try {
        const raw = await fs.readFile(filePath, 'utf8');
        const parsed = parseEnvFile(raw);
        Object.assign(aggregated, parsed);
      } catch (error) {
        if (error && error.code !== 'ENOENT') {
          throw error;
        }
      }
    }

    applyEnv(aggregated, { override, debug });
    cachedEnv = aggregated;
    loadPromise = null;
    return cachedEnv;
  })();

  return loadPromise;
};

const resolveAhrefsApiKey = () => {
  for (const key of AHREFS_KEYS) {
    const value = process.env[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return null;
};

const resolveOpenAiApiKey = () => {
  for (const key of OPENAI_KEYS) {
    const value = process.env[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return null;
};

module.exports = {
  loadEnvConfig,
  resolveAhrefsApiKey,
  resolveOpenAiApiKey,
};
