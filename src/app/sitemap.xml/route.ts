import { getSitemapSlugs } from '../../lib/sitemap';
import { absoluteUrl } from '../../lib/site';

const XML_HEADER = '<?xml version="1.0" encoding="UTF-8"?>';
const NAMESPACE = 'http://www.sitemaps.org/schemas/sitemap/0.9';

const escapeXml = (value: string): string =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');

const createIndex = (slugs: string[]): string => {
  const now = new Date().toISOString();

  const sitemaps = slugs
    .map((slug) => {
      const loc = absoluteUrl(`/sitemaps/${slug}.xml`);

      return `<sitemap><loc>${escapeXml(loc)}</loc><lastmod>${now}</lastmod></sitemap>`;
    })
    .join('');

  return `${XML_HEADER}<sitemapindex xmlns="${NAMESPACE}">${sitemaps}</sitemapindex>`;
};

export const revalidate = 86400;

export async function GET(): Promise<Response> {
  const slugs = getSitemapSlugs();
  const body = createIndex(slugs);

  return new Response(body, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=0, s-maxage=86400',
    },
  });
}
