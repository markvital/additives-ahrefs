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

    const propsPath = path.join(dataDir, entry.name, 'props.json');
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

      additives.push({ eNumber, title, synonyms, functions });
    } catch (error) {
      throw new Error(`Failed to parse ${propsPath}: ${error.message}`);
    }
  }

  additives.sort((a, b) => {
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

function exportCsv(additives) {
  const header = ['e_number', 'title', 'synonyms', 'functions'];
  const lines = [header.join(',')];

  for (const additive of additives) {
    const row = [
      escapeCsvValue(additive.eNumber),
      escapeCsvValue(additive.title),
      arrayToCsvField(additive.synonyms),
      arrayToCsvField(additive.functions),
    ];
    lines.push(row.join(','));
  }

  fs.writeFileSync(outputPath, `${lines.join('\n')}\n`, 'utf8');
}

(function main() {
  const additives = readAdditives();
  exportCsv(additives);
  console.log(`Exported ${additives.length} additives to ${path.relative(process.cwd(), outputPath)}`);
})();
