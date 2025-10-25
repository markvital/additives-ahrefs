import originsDataset from '../data/origins.json';

interface OriginDatasetEntry {
  name?: unknown;
  description?: unknown;
}

interface OriginReference {
  name: string;
  slug: string;
  description: string;
}

const createOriginSlug = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const toOriginReference = (entry: OriginDatasetEntry): OriginReference | null => {
  const name = typeof entry.name === 'string' ? entry.name.trim() : '';
  const description = typeof entry.description === 'string' ? entry.description.trim() : '';

  if (!name) {
    return null;
  }

  const slug = createOriginSlug(name);

  if (!slug) {
    return null;
  }

  return {
    name,
    slug,
    description,
  };
};

const originEntries = Array.isArray((originsDataset as { origins?: OriginDatasetEntry[] }).origins)
  ? ((originsDataset as { origins: OriginDatasetEntry[] }).origins
      .map((entry) => toOriginReference(entry))
      .filter((entry): entry is OriginReference => entry !== null))
  : [];

const originBySlug = new Map(originEntries.map((entry) => [entry.slug, entry]));
const originByName = new Map(originEntries.map((entry) => [entry.name.toLowerCase(), entry]));

export const getOriginDescriptionBySlug = (slug: string): string | null => {
  const normalized = typeof slug === 'string' ? slug.trim().toLowerCase() : '';

  if (!normalized) {
    return null;
  }

  return originBySlug.get(normalized)?.description ?? null;
};

export const getOriginDescriptionByValue = (value: string): string | null => {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';

  if (!normalized) {
    return null;
  }

  const slug = createOriginSlug(normalized);

  return originBySlug.get(slug)?.description ?? originByName.get(normalized)?.description ?? null;
};

export const getOriginDescription = (identifier: string): string | null =>
  getOriginDescriptionBySlug(identifier) ?? getOriginDescriptionByValue(identifier);
