import type { Metadata } from 'next';
import { Box, Typography } from '@mui/material';
import path from 'path';
import { promises as fs } from 'fs';

import { MarkdownArticle } from '../../components/MarkdownArticle';

const termsFilePath = path.join(process.cwd(), 'data', 'term.md');

async function getTermsContent(): Promise<string> {
  const file = await fs.readFile(termsFilePath, 'utf8');

  return file;
}

export const metadata: Metadata = {
  title: 'Terms of Use',
  description:
    'Understand the conditions and limitations for using the Food Additives Catalogue, including liability and acceptable use.',
  alternates: {
    canonical: '/term',
  },
};

export default async function TermsPage() {
  const rawContent = await getTermsContent();
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
