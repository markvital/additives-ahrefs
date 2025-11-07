import type { Metadata } from 'next';
import { Box, Typography } from '@mui/material';
import path from 'path';
import { promises as fs } from 'fs';

import { MarkdownArticle } from '../../components/MarkdownArticle';

const privacyFilePath = path.join(process.cwd(), 'data', 'pages', 'privacy.md');

async function getPrivacyContent(): Promise<string> {
  const file = await fs.readFile(privacyFilePath, 'utf8');

  return file;
}

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description:
    'Learn how the Food Additives Catalogue collects and uses information, including analytics practices and data rights.',
  alternates: {
    canonical: '/privacy',
  },
};

export default async function PrivacyPage() {
  const rawContent = await getPrivacyContent();
  const [firstLine, ...restLines] = rawContent.split('\n');
  const hasMarkdownTitle = firstLine.trim().startsWith('# ');
  const title = hasMarkdownTitle ? firstLine.replace(/^#\s*/, '').trim() : undefined;
  const content = hasMarkdownTitle ? restLines.join('\n').replace(/^\s*/, '') : rawContent;

  return (
    <Box component="section" sx={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 4 }}>
      {title ? (
        <Box className="page-hero">
          <Box
            className="page-hero-content"
            display="flex"
            flexDirection="column"
            alignItems="center"
            gap={1.5}
            textAlign="center"
            sx={{ width: '100%', maxWidth: 760, margin: '0 auto' }}
          >
            <Typography component="h1" variant="h1" sx={{ color: 'inherit' }}>
              {title}
            </Typography>
          </Box>
        </Box>
      ) : null}
      <Box sx={{ width: '100%', maxWidth: 760, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 3 }}>
        <MarkdownArticle content={content} />
      </Box>
    </Box>
  );
}
