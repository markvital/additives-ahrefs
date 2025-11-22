'use client';

import { useMemo, useState, type KeyboardEvent, type MouseEvent, type ReactNode } from 'react';
import NextLink from 'next/link';
import Image from 'next/image';
import { Box, ClickAwayListener, Link as MuiLink, Stack, Tooltip, Typography, useTheme } from '@mui/material';

import additiveLinkIcon from '../../img/additive-link.svg';

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
      <Box component="span" sx={{ display: 'inline-flex' }}>
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
                  px: 1.5,
                  py: 1,
                  color: 'text.primary',
                  fontWeight: 600,
                  display: 'block',
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
                    px: 1.5,
                    py: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 0.25,
                    color: 'text.primary',
                    borderTop: `1px solid ${theme.palette.divider}`,
                    '&:hover': { backgroundColor: theme.palette.action.hover },
                    '&:focus-visible': {
                      outline: `2px solid ${theme.palette.primary.main}`,
                      outlineOffset: 2,
                    },
                  }}
                >
                  <Typography variant="body2" fontWeight={700} component="span">
                    {displayENumber ? `Compare to ${displayENumber}` : 'Compare additives'}
                  </Typography>
                  {displayTitle ? (
                    <Typography
                      variant="body2"
                      component="span"
                      sx={{
                        color: 'text.secondary',
                        fontSize: '0.7em',
                        lineHeight: 1.25,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {displayTitle}
                    </Typography>
                  ) : null}
                </MuiLink>
              ) : null}
            </Stack>
          }
          slotProps={{
            popper: { disablePortal: true },
            tooltip: {
              sx: {
                backgroundColor: theme.palette.background.paper,
                border: `1px solid ${theme.palette.divider}`,
                boxShadow: theme.shadows[3],
                color: theme.palette.text.primary,
                borderRadius: 1,
                p: 0,
                overflow: 'hidden',
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
              display: 'inline-flex',
              alignItems: 'center',
              gap: 0.75,
              color: 'inherit',
              fontWeight: 600,
              cursor: 'pointer',
              '&:focus-visible': {
                outline: `2px solid ${theme.palette.primary.main}`,
                outlineOffset: 2,
              },
            }}
            aria-haspopup="true"
            aria-expanded={open}
          >
            <Image
              src={additiveLinkIcon}
              alt=""
              aria-hidden
              width={16}
              height={16}
              style={{ display: 'block', height: 16, width: 16, flexShrink: 0 }}
              priority={false}
            />
            <Box component="span" sx={{ display: 'inline' }}>
              {children}
            </Box>
          </MuiLink>
        </Tooltip>
      </Box>
    </ClickAwayListener>
  );
}
