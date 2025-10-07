import type { MetadataRoute } from 'next';

import { getAdditives, getFunctionFilters, getOriginFilters } from '../lib/additives';
import { absoluteUrl } from '../lib/site';

const createSitemapEntries = (): MetadataRoute.Sitemap => {
  const entries: MetadataRoute.Sitemap = [];

  entries.push({ url: absoluteUrl('/') });
  entries.push({ url: absoluteUrl('/compare') });

  const additives = getAdditives();

  for (const additive of additives) {
    entries.push({ url: absoluteUrl(`/${additive.slug}`) });
  }

  const functionFilters = getFunctionFilters();
  for (const { slug } of functionFilters) {
    entries.push({ url: absoluteUrl(`/function/${slug}`) });
  }

  const originFilters = getOriginFilters();
  for (const { slug } of originFilters) {
    entries.push({ url: absoluteUrl(`/origin/${slug}`) });
  }

  for (let i = 0; i < additives.length; i += 1) {
    const first = additives[i];

    for (let j = i + 1; j < additives.length; j += 1) {
      const second = additives[j];
      entries.push({ url: absoluteUrl(`/compare/${first.slug}-vs-${second.slug}`) });
    }
  }

  return entries;
};

export default function sitemap(): MetadataRoute.Sitemap {
  return createSitemapEntries();
}
