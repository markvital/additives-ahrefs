import { Box, Link as MuiLink, Typography } from '@mui/material';
import type { Components } from 'react-markdown';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface MarkdownArticleProps {
  content: string;
}

const markdownComponents: Components = {
  h1: ({ children, ...props }) => (
    <Typography component="h2" variant="h3" fontWeight={600} gutterBottom {...props}>
      {children}
    </Typography>
  ),
  h2: ({ children, ...props }) => (
    <Typography component="h3" variant="h4" fontWeight={600} gutterBottom {...props}>
      {children}
    </Typography>
  ),
  h3: ({ children, ...props }) => (
    <Typography component="h4" variant="h5" fontWeight={600} gutterBottom {...props}>
      {children}
    </Typography>
  ),
  h4: ({ children, ...props }) => (
    <Typography component="h5" variant="h6" fontWeight={600} gutterBottom {...props}>
      {children}
    </Typography>
  ),
  p: ({ children, ...props }) => (
    <Typography component="p" variant="body1" color="text.primary" paragraph {...props}>
      {children}
    </Typography>
  ),
  a: ({ children, href, ...props }) => (
    <MuiLink href={href} underline="hover" {...props}>
      {children}
    </MuiLink>
  ),
  ul: ({ children, ...props }) => (
    <Box component="ul" sx={{ paddingLeft: 3, display: 'grid', gap: 1 }} {...props}>
      {children}
    </Box>
  ),
  ol: ({ children, ...props }) => (
    <Box component="ol" sx={{ paddingLeft: 3, display: 'grid', gap: 1 }} {...props}>
      {children}
    </Box>
  ),
  li: ({ children, ...props }) => (
    <Typography component="li" variant="body1" color="text.primary" {...props}>
      {children}
    </Typography>
  ),
  strong: ({ children, ...props }) => (
    <Box component="span" fontWeight={600} {...props}>
      {children}
    </Box>
  ),
  em: ({ children, ...props }) => (
    <Box component="span" fontStyle="italic" {...props}>
      {children}
    </Box>
  ),
  hr: (props) => <Box component="hr" sx={{ border: 0, borderTop: '1px solid', borderColor: 'divider', my: 3 }} {...props} />,
};

export function MarkdownArticle({ content }: MarkdownArticleProps) {
  if (!content.trim()) {
    return null;
  }

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: 1.5,
        '& section.footnotes > h2, & section.footnotes > h3': {
          display: 'none',
        },
      }}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
        {content}
      </ReactMarkdown>
    </Box>
  );
}
