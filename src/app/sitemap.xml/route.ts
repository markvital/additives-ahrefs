import { getSitemapPageCount } from '../../lib/sitemap';
import { absoluteUrl } from '../../lib/site';

const XML_HEADER = '<?xml version="1.0" encoding="UTF-8"?>';
const NAMESPACE = 'http://www.sitemaps.org/schemas/sitemap/0.9';

const createIndex = (pageCount: number): string => {
  const now = new Date().toISOString();

  const sitemaps = Array.from({ length: pageCount }, (_, index) => {
    const page = index + 1;
    const loc = absoluteUrl(`/sitemaps/${page}.xml`);

    return `<sitemap><loc>${loc}</loc><lastmod>${now}</lastmod></sitemap>`;
  }).join('');

  return `${XML_HEADER}<sitemapindex xmlns="${NAMESPACE}">${sitemaps}</sitemapindex>`;
};

export const revalidate = 86400;

export async function GET(): Promise<Response> {
  const pageCount = getSitemapPageCount();
  const body = createIndex(pageCount);

  return new Response(body, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=0, s-maxage=86400',
    },
  });
}
