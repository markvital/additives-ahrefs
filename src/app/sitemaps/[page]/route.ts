import { getSitemapUrls } from '../../../lib/sitemap';

const XML_HEADER = '<?xml version="1.0" encoding="UTF-8"?>';
const NAMESPACE = 'http://www.sitemaps.org/schemas/sitemap/0.9';

const escapeXml = (value: string): string =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');

const createUrlSet = (urls: string[]): string => {
  const entries = urls.map((url) => `<url><loc>${escapeXml(url)}</loc></url>`).join('');

  return `${XML_HEADER}<urlset xmlns="${NAMESPACE}">${entries}</urlset>`;
};

type RouteParams = Record<string, string | string[] | undefined>;

const SLUG_PATTERN = /^[a-z0-9-]+$/i;

const extractSlug = (raw: string | string[] | undefined): string | null => {
  if (!raw) {
    return null;
  }

  const value = Array.isArray(raw) ? raw[0] : raw;

  if (!value) {
    return null;
  }

  const cleaned = value.replace(/\.xml$/i, '');

  if (!SLUG_PATTERN.test(cleaned)) {
    return null;
  }

  return cleaned.toLowerCase();
};

export const revalidate = 86400;

export async function GET(
  _request: Request,
  context: { params: Promise<any> },
): Promise<Response> {
  const params = (await context.params) as RouteParams;
  const slug = extractSlug(params?.page);

  if (!slug) {
    return new Response('Not Found', { status: 404 });
  }

  const urls = getSitemapUrls(slug);

  if (urls.length === 0) {
    return new Response('Not Found', { status: 404 });
  }

  const body = createUrlSet(urls);

  return new Response(body, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=0, s-maxage=86400',
    },
  });
}
