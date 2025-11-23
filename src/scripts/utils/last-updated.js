const fs = require('fs/promises');
const path = require('path');

const LAST_UPDATED_PATH = path.join(__dirname, '..', '..', '..', 'data', 'lastUpdated.json');

function normaliseDateInput(dateInput = new Date()) {
  const parsedDate = dateInput instanceof Date ? dateInput : new Date(dateInput);

  if (Number.isNaN(parsedDate.getTime())) {
    throw new Error('Invalid date supplied for last updated timestamp.');
  }

  return parsedDate.toISOString();
}

async function updateLastUpdatedTimestamp(dateInput = new Date()) {
  const isoTimestamp = normaliseDateInput(dateInput);
  const payload = { lastUpdated: isoTimestamp };

  await fs.writeFile(LAST_UPDATED_PATH, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');

  return isoTimestamp;
}

module.exports = { LAST_UPDATED_PATH, updateLastUpdatedTimestamp };
