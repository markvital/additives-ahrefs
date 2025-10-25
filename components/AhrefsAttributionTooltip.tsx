"use client";

import Image from 'next/image';
import { Box, Link as MuiLink, Tooltip, Typography, useTheme } from '@mui/material';

import ahrefsLogo from '../img/branded/ahrefs-logo.svg';

export function AhrefsAttributionTooltip() {
  const theme = useTheme();
  const backgroundColor = '#e5e5e5';
  const textColor = '#666666';

  return (
    <Box
      component="span"
      sx={{
        position: 'relative',
        display: 'inline-flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: theme.spacing(0.5),
        pb: theme.spacing(4),
      }}
    >
      <Tooltip
        arrow
        open
        disableFocusListener
        disableHoverListener
        disableTouchListener
        placement="bottom"
        componentsProps={{
          popper: {
            modifiers: [
              { name: 'flip', enabled: false },
              { name: 'preventOverflow', options: { altAxis: false, tether: false } },
            ],
            sx: {
              zIndex: theme.zIndex.tooltip - 2,
            },
          },
          tooltip: {
            sx: {
              maxWidth: 'none',
              backgroundColor: 'transparent',
              boxShadow: 'none',
              padding: 0,
              zIndex: theme.zIndex.tooltip - 1,
            },
          },
          arrow: {
            sx: {
              color: backgroundColor,
              fontSize: 20,
              '&::before': {
                backgroundColor,
                border: 'none',
                boxSizing: 'border-box',
              },
            },
          },
        }}
        title={
          <MuiLink
            href="https://ahrefs.com"
            target="_blank"
            rel="noopener noreferrer"
            underline="none"
            aria-label="Explore all keywords on Ahrefs"
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: theme.spacing(0.75),
              padding: `${theme.spacing(0.75)} ${theme.spacing(1.5)}`,
              borderRadius: theme.shape.borderRadius,
              backgroundColor,
              boxShadow: 'none',
              fontSize: theme.typography.pxToRem(13),
              fontWeight: 400,
              lineHeight: 1.2,
              color: textColor,
              textDecoration: 'none',
              cursor: 'pointer',
              pointerEvents: 'auto',
              transition: 'box-shadow 150ms ease, transform 150ms ease',
              '&:hover': {
                boxShadow: theme.shadows[4],
                transform: 'translateY(-1px)',
              },
              '&:focus-visible': {
                outline: `2px solid ${theme.palette.primary.main}`,
                outlineOffset: 2,
              },
            }}
          >
            <Image
              src={ahrefsLogo}
              alt="Ahrefs"
              height={16}
              width={63}
              priority={false}
              style={{ display: 'block', height: '16px', width: 'auto' }}
            />
            <Typography
              component="span"
              variant="body2"
              sx={{
                color: 'inherit',
                fontWeight: 400,
                letterSpacing: 0,
                lineHeight: 1,
                display: 'inline-flex',
                alignItems: 'center',
                height: 16,
              }}
            >
              Explore all 28+ billion keywords
            </Typography>
          </MuiLink>
        }
      >
        <MuiLink
          href="https://ahrefs.com"
          target="_blank"
          rel="noopener noreferrer"
          underline="hover"
          sx={{ fontWeight: 500, lineHeight: 1 }}
        >
          Ahrefs
        </MuiLink>
      </Tooltip>
    </Box>
  );
}
