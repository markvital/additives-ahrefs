#!/usr/bin/env node

const { updateLastUpdatedTimestamp } = require('./utils/last-updated');

function formatDisplayDate(isoTimestamp) {
  const parsed = new Date(isoTimestamp);
  return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(parsed);
}

async function run() {
  try {
    const isoTimestamp = await updateLastUpdatedTimestamp();
    console.log(`Last updated timestamp saved: ${formatDisplayDate(isoTimestamp)} (${isoTimestamp})`);
  } catch (error) {
    console.error(`Failed to update last updated timestamp: ${error.message}`);
    process.exit(1);
  }
}

run();
