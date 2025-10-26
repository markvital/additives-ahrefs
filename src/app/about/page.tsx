import type { Metadata } from 'next';
import { Box, Typography } from '@mui/material';
import path from 'path';
import { promises as fs } from 'fs';

import { MarkdownArticle } from '../../components/MarkdownArticle';

const aboutFilePath = path.join(process.cwd(), 'data', 'about.md');

async function getAboutContent(): Promise<string> {
  const file = await fs.readFile(aboutFilePath, 'utf8');

  return file;
}

export const metadata: Metadata = {
  title: 'About the Food Additives Catalogue',
  description:
    'Learn how the Food Additives Catalogue combines open data sources, Codex functional classes, and Ahrefs search metrics to explain E-numbers.',
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
    <Box
      component="section"
      sx={{
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 3,
        py: { xs: 2, md: 4 },
      }}
    >
      {title ? (
        <Box sx={{ width: '100%', maxWidth: 1200, textAlign: 'center' }}>
          <Typography component="h1" variant="h3" fontWeight={600}>
            {title}
          </Typography>
        </Box>
      ) : null}
      <Box sx={{ width: '100%', maxWidth: 760, display: 'flex', flexDirection: 'column', gap: 3 }}>
        <MarkdownArticle content={content} />
      </Box>
    </Box>
  );
}
