import { Box, Link as MuiLink, Typography } from '@mui/material';
import type { Components } from 'react-markdown';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeRaw from 'rehype-raw';
import { isValidElement, type ReactNode } from 'react';
import { AdditiveLink } from './AdditiveLink';

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

const additiveAttributePattern = /\[([^\]]+)\]\(([^)]+)\)\{([^}]*)\}/g;

const sanitizeHref = (href: string) => href.replace(/"/g, '&quot;');

const sanitizeText = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const convertAdditiveAttributes = (content: string): string => {
  return content.replace(additiveAttributePattern, (match: string, text: string, href: string, attributeText: string) => {
    const tokens: string[] = attributeText
      .split(/\s+/)
      .map((token: string) => token.trim())
      .filter(Boolean);

    const classNames = tokens
      .filter((token) => token.startsWith('.'))
      .map((token) => token.slice(1))
      .filter((token) => token.length > 0);

    if (!classNames.includes('additive')) {
      return match;
    }

    const uniqueClassList = Array.from(new Set(classNames));
    const safeHref = sanitizeHref(href);
    const safeText = sanitizeText(text);

    return `<a href="${safeHref}" class="${uniqueClassList.join(' ')}">${safeText}</a>`;
  });
};

interface MarkdownArticleProps {
  content: string;
  currentAdditive?: {
    slug: string;
    eNumber?: string | null;
    title?: string | null;
  };
}

export function MarkdownArticle({ content, currentAdditive }: MarkdownArticleProps) {
  if (!content.trim()) {
    return null;
  }

  const normalizedContent = convertAdditiveAttributes(content);

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
    a: ({ children, href, node, ...props }) => {
      const nodeClassName = node?.properties?.className;
      const normalizedNodeClasses = Array.isArray(nodeClassName)
        ? (nodeClassName as string[])
        : typeof nodeClassName === 'string'
          ? nodeClassName.split(/\s+/)
          : [];

      const classNames = ((props.className as string | undefined)?.split(/\s+/) ?? [])
        .concat(normalizedNodeClasses)
        .map((value) => value?.trim())
        .filter((value): value is string => typeof value === 'string' && value.length > 0);

      const isAdditiveLink = classNames.includes('additive');

      if (isAdditiveLink) {
        return (
          <AdditiveLink href={href} currentAdditive={currentAdditive} className={props.className}>
            {children}
          </AdditiveLink>
        );
      }

      return (
        <MuiLink href={href} underline="hover" {...props}>
          {children}
        </MuiLink>
      );
    },
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
        {normalizedContent}
      </ReactMarkdown>
    </Box>
  );
}
