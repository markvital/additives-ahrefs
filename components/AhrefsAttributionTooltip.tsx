"use client";

import Image from 'next/image';
import { Box, Link as MuiLink, Typography, useTheme } from '@mui/material';

import ahrefsLogo from '../img/branded/ahrefs-logo.svg';

export function AhrefsAttributionTooltip() {
  const theme = useTheme();
  const spacingY = theme.spacing(0.75);
  const spacingX = theme.spacing(1.75);
  const arrowSize = 10;

  const baseStyles = {
    position: 'relative',
    display: 'inline-flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    padding: `${spacingY} ${spacingX}`,
    borderRadius: theme.shape.borderRadius,
    backgroundColor: theme.palette.background.paper,
    border: `1px solid ${theme.palette.divider}`,
    boxShadow: theme.shadows[3],
    color: theme.palette.text.primary,
    fontWeight: 600,
    fontSize: theme.typography.pxToRem(13),
    lineHeight: 1.2,
    textDecoration: 'none',
    transition: 'box-shadow 150ms ease, transform 150ms ease',
    mt: 1,
    '&:hover': {
      boxShadow: theme.shadows[6],
      transform: 'translateY(-1px)',
    },
    '&:focus-visible': {
      outline: `2px solid ${theme.palette.primary.main}`,
      outlineOffset: 2,
    },
    '&::before': {
      content: '""',
      position: 'absolute',
      top: -arrowSize / 2,
      left: '50%',
      width: arrowSize,
      height: arrowSize,
      transform: 'translateX(-50%) rotate(45deg)',
      backgroundColor: theme.palette.background.paper,
      borderLeft: `1px solid ${theme.palette.divider}`,
      borderTop: `1px solid ${theme.palette.divider}`,
      boxShadow: theme.shadows[1],
      zIndex: 0,
    },
  } as const;

  return (
    <MuiLink
      href="https://ahrefs.com"
      target="_blank"
      rel="noopener noreferrer"
      underline="none"
      aria-label="Explore all keywords on Ahrefs"
      sx={baseStyles}
    >
      <Image src={ahrefsLogo} alt="Ahrefs" width={22} height={22} />
      <Typography
        component="span"
        variant="body2"
        sx={{
          color: 'inherit',
          fontWeight: 600,
          letterSpacing: 0.1,
        }}
      >
        Explore all 28+ billion keywords
      </Typography>
    </MuiLink>
  );
}
