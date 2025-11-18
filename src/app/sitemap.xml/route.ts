import { getSitemapEntries } from '../../lib/sitemap';
import { absoluteUrl } from '../../lib/site';

const XML_HEADER = '<?xml version="1.0" encoding="UTF-8"?>';
const NAMESPACE = 'http://www.sitemaps.org/schemas/sitemap/0.9';

const escapeXml = (value: string): string =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');

const createIndex = (): string => {
  const now = new Date().toISOString();
  const entries = getSitemapEntries();

  const sitemaps = entries
    .map(({ id }) => {
      const loc = escapeXml(absoluteUrl(`/sitemaps/${id}.xml`));

      return `<sitemap><loc>${loc}</loc><lastmod>${now}</lastmod></sitemap>`;
    })
    .join('');

  return `${XML_HEADER}<sitemapindex xmlns="${NAMESPACE}">${sitemaps}</sitemapindex>`;
};

export const revalidate = 86400;

export async function GET(): Promise<Response> {
  const body = createIndex();

  return new Response(body, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=0, s-maxage=86400',
    },
  });
}
