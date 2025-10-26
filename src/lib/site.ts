const DEFAULT_SITE_URL = 'https://additives.ahrefs.com';

const normalizeUrl = (url: string): string => {
  const trimmed = url.trim();

  if (!trimmed) {
    return DEFAULT_SITE_URL;
  }

  return trimmed.replace(/\/$/, '');
};

const envSiteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ?? process.env.SITE_URL ?? process.env.VERCEL_PROJECT_PRODUCTION_URL ?? '';

export const siteUrl = normalizeUrl(envSiteUrl || DEFAULT_SITE_URL);

export const absoluteUrl = (path: string): string => {
  if (!path.startsWith('/')) {
    return `${siteUrl}/${path}`;
  }

  return `${siteUrl}${path}`;
};
