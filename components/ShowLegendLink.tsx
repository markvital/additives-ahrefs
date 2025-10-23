'use client';

import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { ButtonBase, Typography } from '@mui/material';
import { useCallback } from 'react';

import { useAdditiveLegend } from './AdditiveLegendContext';

export function ShowLegendLink() {
  const { openLegend } = useAdditiveLegend();

  const handleClick = useCallback(() => {
    openLegend();
  }, [openLegend]);

  return (
    <ButtonBase
      onClick={handleClick}
      sx={{
        alignSelf: 'flex-start',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.75,
        px: 0.5,
        py: 0.25,
        borderRadius: 999,
        color: '#cb2cff',
        textTransform: 'none',
        fontWeight: 600,
        fontSize: 16,
        lineHeight: 1.2,
        '&:hover': {
          backgroundColor: 'rgba(203, 44, 255, 0.08)',
        },
        '&:focus-visible': {
          outline: '2px solid rgba(203, 44, 255, 0.5)',
          outlineOffset: 2,
        },
      }}
    >
      <InfoOutlinedIcon sx={{ fontSize: 20 }} />
      <Typography component="span" sx={{ fontSize: 'inherit', fontWeight: 'inherit' }}>
        show legend
      </Typography>
    </ButtonBase>
  );
}
