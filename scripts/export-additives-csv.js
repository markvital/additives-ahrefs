const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '..', 'data');
const outputPath = path.join(dataDir, 'additives.csv');

function readAdditives() {
  const entries = fs.readdirSync(dataDir, { withFileTypes: true });
  const additives = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }

    const dirPath = path.join(dataDir, entry.name);
    const propsPath = path.join(dirPath, 'props.json');
    if (!fs.existsSync(propsPath)) {
      continue;
    }

    const raw = fs.readFileSync(propsPath, 'utf8');
    try {
      const props = JSON.parse(raw);
      const eNumber = typeof props.eNumber === 'string' ? props.eNumber : '';
      const title = typeof props.title === 'string' ? props.title : '';
      const synonyms = Array.isArray(props.synonyms) ? props.synonyms : [];
      const functions = Array.isArray(props.functions) ? props.functions : [];
      const searchVolume = readSearchVolume(dirPath);

      additives.push({
        eNumber,
        title,
        synonyms,
        functions,
        searchVolume,
      });
    } catch (error) {
      throw new Error(`Failed to parse ${propsPath}: ${error.message}`);
    }
  }

  additives.sort((a, b) => {
    const totalA =
      typeof a.searchVolume.totalSortValue === 'number' ? a.searchVolume.totalSortValue : -1;
    const totalB =
      typeof b.searchVolume.totalSortValue === 'number' ? b.searchVolume.totalSortValue : -1;

    if (totalA !== totalB) {
      return totalB - totalA;
    }

    const eNumberA = a.eNumber || '\uFFFF';
    const eNumberB = b.eNumber || '\uFFFF';

    if (eNumberA.toUpperCase() < eNumberB.toUpperCase()) return -1;
    if (eNumberA.toUpperCase() > eNumberB.toUpperCase()) return 1;
    return a.title.localeCompare(b.title);
  });

  return additives;
}

function escapeCsvValue(value) {
  const stringValue = String(value ?? '');
  const needsEscaping = /[",\n\r]/.test(stringValue);
  if (needsEscaping) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
}

function arrayToCsvField(values) {
  if (!Array.isArray(values) || values.length === 0) {
    return '';
  }
  const joined = values.map((item) => String(item ?? '')).join(', ');
  return escapeCsvValue(joined);
}

function readSearchVolume(dirPath) {
  const searchVolumePath = path.join(dirPath, 'searchVolume.json');
  if (!fs.existsSync(searchVolumePath)) {
    return { total: '', keywords: [], totalSortValue: -1 };
  }

  const raw = fs.readFileSync(searchVolumePath, 'utf8');
  try {
    const data = JSON.parse(raw);
    const total = typeof data.totalSearchVolume === 'number' ? data.totalSearchVolume : '';
    const totalSortValue =
      typeof data.totalSearchVolume === 'number' && Number.isFinite(data.totalSearchVolume)
        ? data.totalSearchVolume
        : -1;
    const keywords = Array.isArray(data.keywords)
      ? data.keywords
          .filter((item) => item && typeof item.keyword === 'string' && typeof item.volume === 'number')
          .map((item) => ({ keyword: item.keyword, volume: item.volume }))
      : [];

    return { total, keywords, totalSortValue };
  } catch (error) {
    throw new Error(`Failed to parse ${searchVolumePath}: ${error.message}`);
  }
}

function formatKeywordVolumes(keywords) {
  if (!Array.isArray(keywords) || keywords.length === 0) {
    return '';
  }

  const parts = keywords.map((item) => `${item.keyword}: ${item.volume}`);
  return escapeCsvValue(parts.join('; '));
}

function buildCsv(additives) {
  const header = ['e_number', 'title', 'synonyms', 'functions', 'search_volume_total', 'search_volume_keywords'];
  const lines = [header.join(',')];

  for (const additive of additives) {
    const totalSearchVolume = additive.searchVolume.total;
    const keywordBreakdown = formatKeywordVolumes(additive.searchVolume.keywords);
    const row = [
      escapeCsvValue(additive.eNumber),
      escapeCsvValue(additive.title),
      arrayToCsvField(additive.synonyms),
      arrayToCsvField(additive.functions),
      escapeCsvValue(totalSearchVolume),
      keywordBreakdown,
    ];
    lines.push(row.join(','));
  }

  return `${lines.join('\n')}\n`;
}

(function main() {
  const additives = readAdditives();
  const csvContent = buildCsv(additives);
  const args = new Set(process.argv.slice(2));
  const shouldPrint = args.has('--stdout') || args.has('--stdout-only');
  const shouldWrite = !args.has('--stdout-only') && !args.has('--no-write');
  const shouldLog = !args.has('--quiet');

  if (shouldWrite) {
    fs.writeFileSync(outputPath, csvContent, 'utf8');
  }

  if (shouldPrint) {
    process.stdout.write(csvContent);
  }

  if (shouldLog) {
    const messageParts = [];
    if (shouldWrite) {
      messageParts.push(`exported ${additives.length} additives to ${path.relative(process.cwd(), outputPath)}`);
    }
    if (shouldPrint) {
      messageParts.push(`printed ${additives.length} additives to stdout`);
    }
    if (messageParts.length === 0) {
      messageParts.push(`processed ${additives.length} additives`);
    }

    const log = shouldPrint ? console.error : console.log;
    log(`Successfully ${messageParts.join(' and ')}.`);
  }
})();
