import type { Additive, AdditiveSortMode } from './additives';
import {
  getAdditiveBySlug,
  sortAdditivesByMode,
  filterAdditivesByClassVisibility,
  parseAdditiveSortMode,
} from './additives';
import supplementDataset from '../data/supplement-additives.json';

interface SupplementDatasetEntry {
  slug: string;
  roles: string[];
  deliveryFormats: string[];
  highlights: string;
  safetyNotes: string;
  regulatoryNotes: string;
}

export interface SupplementAdditiveMetadata {
  supplementRoles: string[];
  supplementDeliveryFormats: string[];
  supplementHighlights: string;
  supplementSafetyNotes: string;
  supplementRegulatoryNotes: string;
}

export type SupplementAdditive = Additive & SupplementAdditiveMetadata;

interface SupplementFilterOption {
  value: string;
  slug: string;
}

const toStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter((item, index, list) => item.length > 0 && list.indexOf(item) === index);
};

const createFilterSlug = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const normaliseEntry = (entry: SupplementDatasetEntry): SupplementAdditive | null => {
  const base = getAdditiveBySlug(entry.slug);

  if (!base) {
    return null;
  }

  const roles = toStringArray(entry.roles);
  const deliveryFormats = toStringArray(entry.deliveryFormats);

  return {
    ...base,
    supplementRoles: roles,
    supplementDeliveryFormats: deliveryFormats,
    supplementHighlights: typeof entry.highlights === 'string' ? entry.highlights.trim() : '',
    supplementSafetyNotes: typeof entry.safetyNotes === 'string' ? entry.safetyNotes.trim() : '',
    supplementRegulatoryNotes: typeof entry.regulatoryNotes === 'string' ? entry.regulatoryNotes.trim() : '',
  };
};

const mapSupplementAdditives = (): SupplementAdditive[] => {
  if (!Array.isArray((supplementDataset as { supplements?: SupplementDatasetEntry[] }).supplements)) {
    return [];
  }

  const items = (supplementDataset as { supplements: SupplementDatasetEntry[] }).supplements
    .map((entry) => normaliseEntry(entry))
    .filter((item): item is SupplementAdditive => Boolean(item));

  const sorted = sortAdditivesByMode(items, 'product-count');

  return sorted as SupplementAdditive[];
};

const supplementCache = mapSupplementAdditives();

const collectUniqueValues = (selector: (item: SupplementAdditive) => string[]): SupplementFilterOption[] => {
  const unique = new Set<string>();

  supplementCache.forEach((item) => {
    selector(item).forEach((value) => {
      const normalised = value.trim();

      if (normalised.length > 0) {
        unique.add(normalised);
      }
    });
  });

  return Array.from(unique.values())
    .sort((a, b) => a.localeCompare(b))
    .map((value) => ({ value, slug: createFilterSlug(value) }));
};

const roleFilters = collectUniqueValues((item) => item.supplementRoles);
const formatFilters = collectUniqueValues((item) => item.supplementDeliveryFormats);

const roleSlugToValue = new Map(roleFilters.map(({ slug, value }) => [slug, value]));
const formatSlugToValue = new Map(formatFilters.map(({ slug, value }) => [slug, value]));

export const getSupplementAdditives = (): SupplementAdditive[] => supplementCache;

export const getSupplementRoleFilters = (): SupplementFilterOption[] => roleFilters;

export const getSupplementFormatFilters = (): SupplementFilterOption[] => formatFilters;

export const getSupplementRoleValueBySlug = (slug: string): string | null => roleSlugToValue.get(slug) ?? null;

export const getSupplementFormatValueBySlug = (slug: string): string | null => formatSlugToValue.get(slug) ?? null;

export const getSupplementAdditiveBySlug = (slug: string): SupplementAdditive | null => {
  const normalised = slug?.trim();

  if (!normalised) {
    return null;
  }

  return supplementCache.find((item) => item.slug === normalised) ?? null;
};

export const getSupplementAdditiveSlugs = (): string[] => supplementCache.map((item) => item.slug);

export const filterSupplementAdditives = (
  roleSlug: string | null,
  formatSlug: string | null,
  sortMode: AdditiveSortMode,
  showClasses: boolean,
): SupplementAdditive[] => {
  let items = getSupplementAdditives();

  if (roleSlug) {
    const roleValue = getSupplementRoleValueBySlug(roleSlug);

    if (roleValue) {
      items = items.filter((item) => item.supplementRoles.includes(roleValue));
    }
  }

  if (formatSlug) {
    const formatValue = getSupplementFormatValueBySlug(formatSlug);

    if (formatValue) {
      items = items.filter((item) => item.supplementDeliveryFormats.includes(formatValue));
    }
  }

  const withoutClasses = filterAdditivesByClassVisibility(items, showClasses);
  const sorted = sortAdditivesByMode(withoutClasses, sortMode);

  return sorted as SupplementAdditive[];
};

export const parseSupplementSortMode = (value: string | string[] | null | undefined): AdditiveSortMode =>
  parseAdditiveSortMode(value);
