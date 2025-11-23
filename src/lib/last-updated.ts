import lastUpdatedData from '../../data/lastUpdated.json';

interface LastUpdatedPayload {
  lastUpdated?: string;
}

function parseLastUpdatedDate(payload: LastUpdatedPayload): Date | null {
  if (!payload || typeof payload.lastUpdated !== 'string') {
    return null;
  }

  const parsed = new Date(payload.lastUpdated);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
}

export function getLastUpdatedDate(): Date | null {
  return parseLastUpdatedDate(lastUpdatedData as LastUpdatedPayload);
}

export function getFormattedLastUpdated(): string | null {
  const parsed = getLastUpdatedDate();

  if (!parsed) {
    return null;
  }

  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(parsed);
}
