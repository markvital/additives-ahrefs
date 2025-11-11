import fs from 'fs';
import path from 'path';

export interface FeaturedConfig {
  featuredSlug: string;
  description: string;
}

let cachedConfig: FeaturedConfig | null = null;

export function getFeaturedConfig(): FeaturedConfig | null {
  if (cachedConfig) {
    return cachedConfig;
  }

  const configPath = path.join(process.cwd(), 'data', 'featured.json');

  if (!fs.existsSync(configPath)) {
    return null;
  }

  try {
    const raw = fs.readFileSync(configPath, 'utf8');
    const parsed = JSON.parse(raw);

    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      typeof parsed.featuredSlug === 'string' &&
      typeof parsed.description === 'string'
    ) {
      cachedConfig = {
        featuredSlug: parsed.featuredSlug,
        description: parsed.description,
      };

      return cachedConfig;
    }

    return null;
  } catch (error) {
    console.error('Failed to load featured.json:', error);
    return null;
  }
}
