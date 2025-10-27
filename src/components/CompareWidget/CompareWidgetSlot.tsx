'use client';

import { Box, ButtonBase, Typography } from '@mui/material';
import { useDroppable } from '@dnd-kit/core';

interface CompareWidgetSlotProps {
  id: string;
  label: string;
  isFilled: boolean;
  placeholderIcon: React.ReactNode;
  onClick: () => void;
}

export function CompareWidgetSlot({ id, label, isFilled, placeholderIcon, onClick }: CompareWidgetSlotProps) {
  const { isOver, setNodeRef } = useDroppable({ id });
  const content = isFilled ? (
    <Typography variant="h6" component="span" sx={{ fontWeight: 600, letterSpacing: 1 }}>
      {label}
    </Typography>
  ) : (
    <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
      {placeholderIcon}
    </Box>
  );

  return (
    <ButtonBase
      id={id}
      ref={setNodeRef}
      onClick={onClick}
      sx={{
        flex: 1,
        minHeight: 72,
        borderRadius: 1.5,
        border: '1px dashed',
        borderColor: isOver ? '#999999' : '#BDBDBD',
        bgcolor: isOver ? '#ffffff' : '#f9f9f9',
        color: '#555555',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'background-color 0.2s ease, border-color 0.2s ease',
      }}
    >
      {content}
    </ButtonBase>
  );
}
