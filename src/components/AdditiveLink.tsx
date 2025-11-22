'use client';

import { useMemo, useState, type KeyboardEvent, type MouseEvent, type ReactNode } from 'react';
import NextLink from 'next/link';
import { Box, ClickAwayListener, Link as MuiLink, Stack, Tooltip, Typography, useTheme } from '@mui/material';

const additiveIconPath =
  'm26.6 7-.2-.5-.6-2.2a2.3 2.3 0 0 0-1.3-1.4l-7.5-2.7h-.8l-1.1.1-.6.3-2.1 1.7a1.5 1.5 0 0 0-.6 1.9v.2h.1l1.5 4.2a10.5 10.5 0 0 1 .4 1.7 8.5 8.5 0 0 0-4.7-1.4h-.9l-1.3.2a8.3 8.3 0 0 0-5.9 5 7.6 7.6 0 0 0 .8 7.7 3.5 3.5 0 0 0 .5.8l1.1 1.7a4 4 0 0 1 .1 4.2l-.9 1.3a1.2 1.2 0 0 0-.3 1.3 1.5 1.5 0 0 0 1.1.8h.3a4.6 4.6 0 0 0 2.3-.6 10.7 10.7 0 0 0 2.2-1.5 5.1 5.1 0 0 1 1.8-.9 9.9 9.9 0 0 1 2.4-.3h4.5a9.5 9.5 0 0 0 5.6-2.9 7.8 7.8 0 0 0 1.7-8.1 7.6 7.6 0 0 0-3.8-4.3l-.5-.3 1.6-1.2h.1l4-2.4a1.9 1.9 0 0 0 1-2.4zm-20.1 19.8a7.5 7.5 0 0 0-.3-2 10.9 10.9 0 0 0-1.7-3.4h-.1a8.6 8.6 0 0 1-1.3-2 6.5 6.5 0 0 1-.2-2.4 6.1 6.1 0 0 1 1.4-3.3 5.9 5.9 0 0 1 2.8-1.8l1.7-.2h.6a5.1 5.1 0 0 1 2.1.6 9.1 9.1 0 0 1 2.3 1.5l.2.2h.1l.5.5a1.8 1.8 0 0 0 1 .4 8.1 8.1 0 0 1 3.7.9 5.1 5.1 0 0 1 2.3 2.3 10.5 10.5 0 0 1 .5 1.9 4.1 4.1 0 0 1-.3 2.2 5.2 5.2 0 0 1-1.1 1.9 4.9 4.9 0 0 1-1.8 1.4 8.3 8.3 0 0 1-2.2.8h-4.7a9.5 9.5 0 0 0-3.7.8 9.5 9.5 0 0 0-1.7 1l-.5.4a7.5 7.5 0 0 0 .4-1.7z';

const linkColor = '#717171';

interface AdditiveContext {
  slug: string;
  eNumber?: string | null;
  title?: string | null;
}

interface AdditiveLinkProps {
  href?: string;
  children: ReactNode;
  currentAdditive?: AdditiveContext;
  className?: string;
}

const extractSlugFromHref = (href?: string | null): string | null => {
  if (!href) {
    return null;
  }

  const withoutOrigin = href.replace(/^https?:\/\/[^/]+/i, '');
  const path = withoutOrigin.split(/[?#]/)[0] ?? '';
  const trimmed = path.replace(/^\/+/, '').replace(/\/+$/, '');

  return trimmed.length > 0 ? trimmed : null;
};

export function AdditiveLink({ href, children, currentAdditive, className }: AdditiveLinkProps) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);

  const targetSlug = useMemo(() => extractSlugFromHref(href), [href]);
  const compareHref = useMemo(() => {
    if (!targetSlug || !currentAdditive?.slug) {
      return null;
    }

    return `/compare/${targetSlug}-vs-${currentAdditive.slug}`;
  }, [currentAdditive?.slug, targetSlug]);

  const handleClose = () => {
    setOpen(false);
  };

  const handleTriggerClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (!href) {
      return;
    }

    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return;
    }

    event.preventDefault();
    setOpen((previous) => !previous);
  };

  const handleTriggerKeyDown = (event: KeyboardEvent<HTMLAnchorElement>) => {
    if (event.key === 'Escape' || event.key === 'Esc') {
      event.preventDefault();
      event.stopPropagation();
      handleClose();
      return;
    }

    if (event.key === ' ' || event.key === 'Spacebar' || event.key === 'Enter') {
      event.preventDefault();
      setOpen((previous) => !previous);
    }
  };

  const displayENumber = useMemo(() => {
    if (typeof currentAdditive?.eNumber === 'string' && currentAdditive.eNumber.trim().length > 0) {
      return currentAdditive.eNumber.trim();
    }

    return null;
  }, [currentAdditive?.eNumber]);

  const displayTitle = useMemo(() => {
    if (typeof currentAdditive?.title === 'string' && currentAdditive.title.trim().length > 0) {
      return currentAdditive.title.trim();
    }

    return null;
  }, [currentAdditive?.title]);

  if (!href) {
    return (
      <MuiLink className={className} underline="hover">
        {children}
      </MuiLink>
    );
  }

  return (
    <ClickAwayListener onClickAway={handleClose}>
      <Box component="span" sx={{ display: 'inline' }}>
        <Tooltip
          arrow
          open={open}
          onClose={handleClose}
          disableFocusListener
          disableHoverListener
          disableTouchListener
          placement="bottom-start"
          title={
            <Stack sx={{ minWidth: 220, maxWidth: 320 }}>
              <MuiLink
                component={NextLink}
                href={href}
                underline="none"
                sx={{
                  px: 1.75,
                  py: 1.25,
                  minHeight: 48,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  textAlign: 'center',
                  color: theme.palette.text.primary,
                  fontWeight: 500,
                  typography: 'body2',
                  lineHeight: 1.25,
                  '&:hover': { backgroundColor: theme.palette.action.hover },
                  '&:focus-visible': {
                    outline: `2px solid ${theme.palette.primary.main}`,
                    outlineOffset: 2,
                  },
                }}
              >
                Read more
              </MuiLink>
              {compareHref && (displayENumber || displayTitle) ? (
                <MuiLink
                  component={NextLink}
                  href={compareHref}
                  underline="none"
                  sx={{
                    px: 1.75,
                    py: 1.25,
                    minHeight: 48,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 0.5,
                    textAlign: 'center',
                    color: theme.palette.text.primary,
                    borderTop: `1px solid ${theme.palette.divider}`,
                    '&:hover': { backgroundColor: theme.palette.action.hover },
                    '&:focus-visible': {
                      outline: `2px solid ${theme.palette.primary.main}`,
                      outlineOffset: 2,
                    },
                  }}
                >
                  <Typography variant="body2" fontWeight={500} component="span">
                    Compare to
                  </Typography>
                  {(displayENumber || displayTitle) && (
                    <Typography
                      variant="body2"
                      component="span"
                      sx={{
                        color: 'text.secondary',
                        fontSize: '0.75em',
                        lineHeight: 1.25,
                        maxWidth: '100%',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {[displayENumber, displayTitle].filter(Boolean).join(' - ')}
                    </Typography>
                  )}
                </MuiLink>
              ) : null}
            </Stack>
          }
          slotProps={{
            popper: { disablePortal: true, keepMounted: true },
            tooltip: {
              sx: {
                backgroundColor: theme.palette.background.paper,
                border: `1px solid ${theme.palette.divider}`,
                boxShadow: theme.shadows[3],
                color: theme.palette.text.primary,
                borderRadius: 1,
                p: 0,
                overflow: 'visible',
              },
            },
            arrow: {
              sx: {
                color: theme.palette.background.paper,
                fontSize: 24,
                '&::before': {
                  border: `1px solid ${theme.palette.divider}`,
                  boxShadow: theme.shadows[1],
                },
              },
            },
          }}
        >
          <MuiLink
            href={href}
            onClick={handleTriggerClick}
            onKeyDown={handleTriggerKeyDown}
            underline="hover"
            className={className}
            sx={{
              display: 'inline',
              color: linkColor,
              fontWeight: 400,
              textDecorationColor: linkColor,
              cursor: 'pointer',
              '&:hover': {
                color: linkColor,
                textDecorationColor: linkColor,
              },
              '&:focus-visible': {
                outline: `2px solid ${theme.palette.primary.main}`,
                outlineOffset: 2,
              },
            }}
            aria-haspopup="true"
            aria-expanded={open}
          >
            <Box
              component="span"
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 0.25,
                verticalAlign: 'baseline',
                color: linkColor,
                lineHeight: 'inherit',
                '& svg': {
                  display: 'block',
                  width: 16,
                  height: 16,
                  flexShrink: 0,
                },
              }}
            >
              <Box component="svg" viewBox="0 0 27 32" aria-hidden focusable="false">
                <path fill="currentColor" d={additiveIconPath} />
              </Box>
              <Box component="span" sx={{ display: 'inline', lineHeight: 'inherit' }}>
                {children}
              </Box>
            </Box>
          </MuiLink>
        </Tooltip>
      </Box>
    </ClickAwayListener>
  );
}
