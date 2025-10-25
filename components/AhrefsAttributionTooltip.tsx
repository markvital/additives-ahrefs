"use client";

import Image from 'next/image';
import { Box, Link as MuiLink, Typography, useTheme } from '@mui/material';

import ahrefsLogo from '../img/logo/logo_cropped.png';

export function AhrefsAttributionTooltip() {
  const theme = useTheme();
  const spacingY = theme.spacing(0.75);
  const spacingX = theme.spacing(2);

  const baseStyles = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    padding: `${spacingY} ${spacingX}`,
    borderRadius: 999,
    backgroundColor: '#f4f4f4',
    border: '1px solid rgba(15, 23, 42, 0.08)',
    boxShadow: '0 2px 6px rgba(15, 23, 42, 0.08)',
    color: theme.palette.text.primary,
    fontWeight: 600,
    textDecoration: 'none',
    transition: 'box-shadow 150ms ease, transform 150ms ease',
    '&:hover': {
      boxShadow: '0 6px 16px rgba(15, 23, 42, 0.12)',
      transform: 'translateY(-1px)',
    },
    '&:focus-visible': {
      outline: `2px solid ${theme.palette.primary.main}`,
      outlineOffset: 2,
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
      <Box
        component="span"
        sx={{
          width: 22,
          height: 22,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Image src={ahrefsLogo} alt="Ahrefs" width={22} height={22} />
      </Box>
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
