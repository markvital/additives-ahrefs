import { Box, Link as MuiLink, Typography } from '@mui/material';
import type { Components } from 'react-markdown';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeRaw from 'rehype-raw';
import { isValidElement, type ReactNode } from 'react';

const collectText = (children: ReactNode): string => {
  if (typeof children === 'string') {
    return children;
  }

  if (typeof children === 'number') {
    return children.toString();
  }

  if (Array.isArray(children)) {
    return children.map((child) => collectText(child)).join('');
  }

  if (isValidElement(children)) {
    const elementProps = children.props as { children?: ReactNode };

    return collectText(elementProps.children);
  }

  return '';
};

const resolveHeadingId = (children: ReactNode, explicitId?: string): string | undefined => {
  if (explicitId && explicitId.trim().length > 0) {
    return explicitId;
  }

  const text = collectText(children).trim().toLowerCase();

  if (!text) {
    return undefined;
  }

  return text.replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
};

const createHeadingComponent = (
  component: 'h2' | 'h3' | 'h4' | 'h5',
  variant: 'h3' | 'h4' | 'h5' | 'h6',
) => {
  const HeadingComponent = ({ children, node, ...props }: any) => {
    const explicitId = node?.properties?.id as string | undefined;
    const headingId = resolveHeadingId(children, explicitId ?? props?.id);

    return (
      <Typography
        component={component}
        variant={variant}
        fontWeight={600}
        gutterBottom
        id={headingId}
        {...props}
      >
        {children}
      </Typography>
    );
  };

  HeadingComponent.displayName = `MarkdownHeading${variant.toUpperCase()}`;

  return HeadingComponent;
};

interface MarkdownArticleProps {
  content: string;
}

const markdownComponents: Components = {
  h1: createHeadingComponent('h2', 'h3'),
  h2: createHeadingComponent('h3', 'h4'),
  h3: createHeadingComponent('h4', 'h5'),
  h4: createHeadingComponent('h5', 'h6'),
  p: ({ children, ...props }) => (
    <Typography component="p" variant="body1" color="text.primary" paragraph {...props}>
      {children}
    </Typography>
  ),
  a: ({ children, href, ...props }) => (
    <MuiLink
      href={href}
      underline="hover"
      sx={{ overflowWrap: 'anywhere', wordBreak: 'break-word' }}
      {...props}
    >
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
      className="markdown-article"
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: 1.5,
        '& section.footnotes > h2, & section.footnotes > h3': {
          display: 'none',
        },
      }}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeRaw, rehypeKatex]}
        components={markdownComponents}
      >
        {content}
      </ReactMarkdown>
    </Box>
  );
}
