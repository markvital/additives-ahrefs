import type { ReactNode } from 'react';
import Link from 'next/link';
import { Box, Typography } from '@mui/material';

export interface InfoListCardProps {
  href: string;
  title: string;
  description?: string | null;
  count: number;
  countSuffix: string;
  icon?: ReactNode;
}

export default function InfoListCard({
  href,
  title,
  description,
  count,
  countSuffix,
  icon,
}: InfoListCardProps) {
  return (
    <Box
      component={Link}
      href={href}
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: 0.75,
        textDecoration: 'none',
        color: 'text.primary',
        backgroundColor: '#ffffff',
        px: 2.5,
        py: 2,
        borderRadius: '35px',
        width: '100%',
        maxWidth: '720px',
        marginRight: 'auto',
        boxShadow: '0px 1px 2px rgba(17, 17, 17, 0.08)',
        transition: 'background-color 0.2s ease, color 0.2s ease, box-shadow 0.2s ease',
        '&:hover': {
          backgroundColor: 'action.hover',
          boxShadow: '0px 4px 12px rgba(17, 17, 17, 0.12)',
        },
        '&:focus-visible': {
          outline: '2px solid #111111',
          outlineOffset: 4,
        },
      }}
    >
      <Typography component="h2" variant="h5" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        {icon}
        {title}
      </Typography>
      {description ? (
        <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 660 }}>
          {description}
        </Typography>
      ) : null}
      <Typography variant="body2" color="text.secondary">
        <Box component="span" fontWeight={600}>
          {count}
        </Box>{' '}
        {countSuffix}
      </Typography>
    </Box>
  );
}
