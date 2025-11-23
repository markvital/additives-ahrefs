'use client';

import { useMemo, useState, type KeyboardEvent, type MouseEvent, type ReactNode } from 'react';
import NextLink from 'next/link';
import { Box, ClickAwayListener, Link as MuiLink, Stack, Tooltip, Typography, useTheme } from '@mui/material';
import additiveIcon from '../../img/additive-link.svg';

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

const additiveIconUrl = typeof additiveIcon === 'string' ? additiveIcon : additiveIcon?.src ?? '';

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

  const compareLineTwo = useMemo(() => {
    const parts = [displayENumber, displayTitle].filter(Boolean);

    return parts.length > 0 ? parts.join(' - ') : null;
  }, [displayENumber, displayTitle]);

  const actionBaseSx = {
    px: 1.75,
    py: 1.25,
    minHeight: 52,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
    color: theme.palette.text.primary,
    fontWeight: 500,
    typography: 'body2',
    fontSize: '1.15em',
    lineHeight: 1.25,
    textTransform: 'none',
    '&:hover': { backgroundColor: theme.palette.action.hover },
    '&:focus-visible': {
      outline: `2px solid ${theme.palette.primary.main}`,
      outlineOffset: 2,
    },
  } as const;

  const iconBeforeStyles = {
    content: '""',
    position: 'absolute',
    left: 0,
    top: '50%',
    transform: 'translateY(-50%)',
    display: 'block',
    width: 16,
    height: 16,
    maskRepeat: 'no-repeat',
    WebkitMaskRepeat: 'no-repeat',
    maskSize: 'contain',
    WebkitMaskSize: 'contain',
    backgroundColor: 'currentColor',
    ...(additiveIconUrl
      ? {
          maskImage: `url(${additiveIconUrl})`,
          WebkitMaskImage: `url(${additiveIconUrl})`,
        }
      : {}),
  } as const;

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
          placement="bottom"
          title={
            <Stack sx={{ minWidth: 220, maxWidth: 320 }}>
              <MuiLink
                component={NextLink}
                href={href}
                underline="none"
                sx={actionBaseSx}
              >
                read more
              </MuiLink>
              {compareHref && compareLineTwo ? (
                <MuiLink
                  component={NextLink}
                  href={compareHref}
                  underline="none"
                  sx={{
                    ...actionBaseSx,
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 0.5,
                    borderTop: `1px solid ${theme.palette.divider}`,
                  }}
                >
                  <Typography
                    component="span"
                    sx={{ fontSize: '1.15em', fontWeight: 500, lineHeight: 1.25 }}
                  >
                    compare to
                  </Typography>
                  <Typography
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
                    {compareLineTwo}
                  </Typography>
                </MuiLink>
              ) : null}
            </Stack>
          }
          slotProps={{
            popper: {
              disablePortal: true,
              keepMounted: true,
              modifiers: [{ name: 'preventOverflow', options: { padding: 8 } }],
            },
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
              position: 'relative',
              display: 'inline',
              color: linkColor,
              fontWeight: 400,
              textDecorationColor: linkColor,
              lineHeight: 'inherit',
              cursor: 'pointer',
              verticalAlign: 'baseline',
              paddingLeft: '18px',
              '&::before': iconBeforeStyles,
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
            {children}
          </MuiLink>
        </Tooltip>
      </Box>
    </ClickAwayListener>
  );
}
