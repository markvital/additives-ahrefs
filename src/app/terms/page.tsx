import type { Metadata } from 'next';
import { Box, Typography } from '@mui/material';
import path from 'path';
import { promises as fs } from 'fs';

import { MarkdownArticle } from '../../components/MarkdownArticle';
import { absoluteUrl } from '../../lib/site';

const termsFilePath = path.join(process.cwd(), 'data', 'pages', 'terms.md');
const termsTitle = 'Terms of Use';
const termsDescription =
  'Understand the conditions and limitations for using the Food Additive Catalogue, including liability and acceptable use.';
const termsCanonicalPath = '/terms';
const gridSocialImage = absoluteUrl('/img/grid-screenshot.png');

async function getTermsContent(): Promise<string> {
  const file = await fs.readFile(termsFilePath, 'utf8');

  return file;
}

export const metadata: Metadata = {
  title: termsTitle,
  description: termsDescription,
  alternates: {
    canonical: termsCanonicalPath,
  },
  openGraph: {
    title: termsTitle,
    description: termsDescription,
    url: absoluteUrl(termsCanonicalPath),
    type: 'website',
    images: [
      {
        url: gridSocialImage,
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: termsTitle,
    description: termsDescription,
    images: [gridSocialImage],
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
