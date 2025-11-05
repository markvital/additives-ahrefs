import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('site URL helpers', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  it('prefixes https when the configured URL is missing a protocol', async () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'compareadditives.com');

    const { siteUrl, absoluteUrl } = await import('./site');

    expect(siteUrl).toBe('https://compareadditives.com');
    expect(absoluteUrl('/sitemap.xml')).toBe('https://compareadditives.com/sitemap.xml');
  });

  it('preserves the provided protocol and trims trailing slashes', async () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'http://localhost:3000/');

    const { siteUrl, absoluteUrl } = await import('./site');

    expect(siteUrl).toBe('http://localhost:3000');
    expect(absoluteUrl('api')).toBe('http://localhost:3000/api');
  });
});
