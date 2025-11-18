import type { Metadata } from 'next';
import { Box, Typography } from '@mui/material';
import path from 'path';
import { promises as fs } from 'fs';

import { MarkdownArticle } from '../../components/MarkdownArticle';

const aboutFilePath = path.join(process.cwd(), 'data', 'pages', 'about.md');

async function getAboutContent(): Promise<string> {
  const file = await fs.readFile(aboutFilePath, 'utf8');

  return file;
}

export const metadata: Metadata = {
  title: 'About the Food Additive Catalogue',
  description:
    'Learn how the Food Additive Catalogue combines open data sources, Codex functional classes, and Ahrefs search metrics to explain E-numbers.',
  alternates: {
    canonical: '/about',
  },
};

export default async function AboutPage() {
  const rawContent = await getAboutContent();
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
