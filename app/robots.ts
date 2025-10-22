import type { MetadataRoute } from 'next';

import { absoluteUrl } from '../lib/site';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        disallow: '/',
      },
      {
        userAgent: 'AhrefsBot',
        allow: '/',
      },
      {
        userAgent: 'GPTBot',
        allow: '/',
      },
      {
        userAgent: 'ChatGPT-User',
        allow: '/',
      },
      {
        userAgent: 'ChatGPT',
        allow: '/',
      },
    ],
    sitemap: absoluteUrl('/sitemap.xml'),
  };
}
