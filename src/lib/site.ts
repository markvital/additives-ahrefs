const DEFAULT_SITE_URL = 'https://additives.ahrefs.com';

const hasProtocol = (url: string): boolean => /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(url);

const withProtocol = (url: string): string => {
  if (hasProtocol(url)) {
    return url;
  }

  if (/^(localhost|127\.0\.0\.1|0\.0\.0\.0)(:\d+)?/i.test(url)) {
    return `http://${url}`;
  }

  return `https://${url}`;
};

const normalizeUrl = (url: string): string => {
  const trimmed = url.trim();

  if (!trimmed) {
    return DEFAULT_SITE_URL;
  }

  return withProtocol(trimmed).replace(/\/$/, '');
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
