import { getSitemapPageUrls } from '../../../lib/sitemap';

const XML_HEADER = '<?xml version="1.0" encoding="UTF-8"?>';
const NAMESPACE = 'http://www.sitemaps.org/schemas/sitemap/0.9';

const createUrlSet = (urls: string[]): string => {
  const entries = urls.map((url) => `<url><loc>${url}</loc></url>`).join('');

  return `${XML_HEADER}<urlset xmlns="${NAMESPACE}">${entries}</urlset>`;
};

type RouteParams = Record<string, string | string[] | undefined>;

const extractPageNumber = (raw: string | string[] | undefined): number | null => {
  if (!raw) {
    return null;
  }

  const value = Array.isArray(raw) ? raw[0] : raw;

  if (!value) {
    return null;
  }

  const cleaned = value.replace(/\.xml$/i, '');
  const parsed = Number.parseInt(cleaned, 10);

  if (Number.isNaN(parsed) || parsed < 1) {
    return null;
  }

  return parsed;
};

export const revalidate = 86400;

export async function GET(
  _request: Request,
  context: { params: Promise<any> },
): Promise<Response> {
  const params = (await context.params) as RouteParams;
  const page = extractPageNumber(params?.page);

  if (!page) {
    return new Response('Not Found', { status: 404 });
  }

  const urls = getSitemapPageUrls(page);

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
