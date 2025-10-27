'use client';

import { useMemo, useState, type MouseEvent } from 'react';
import CloseIcon from '@mui/icons-material/Close';
import AddIcon from '@mui/icons-material/Add';
import {
  Box,
  Collapse,
  IconButton,
  Paper,
  Popover,
  Typography,
} from '@mui/material';
import { useDroppable } from '@dnd-kit/core';

import { AdditiveLookup } from '../AdditiveLookup';
import type { Additive } from '../../lib/additives';
import { formatAdditiveDisplayName } from '../../lib/additive-format';
import { useCompareWidget } from './CompareWidgetProvider';

type SlotKey = 'left' | 'right';

interface SlotPickerState {
  slot: SlotKey;
  anchorEl: HTMLElement;
}

const slotButtonStyles = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: { xs: 132, sm: 148 },
  height: 72,
  borderRadius: '14px',
  border: '1.5px dashed #bdbdbd',
  backgroundColor: '#f4f4f4',
  transition: 'border-color 0.2s ease, background-color 0.2s ease, box-shadow 0.2s ease',
  cursor: 'pointer',
  padding: 0,
  font: 'inherit',
  color: 'inherit',
} as const;

const slotLabelStyles = {
  fontSize: '1.1rem',
  fontWeight: 600,
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
  color: '#5a5a5a',
} as const;

const tooltipStyles = {
  position: 'absolute',
  top: -54,
  left: '50%',
  transform: 'translateX(-50%)',
  backgroundColor: '#ffffff',
  borderRadius: '12px',
  padding: '0.6rem 0.9rem',
  boxShadow: '0 8px 20px rgba(0, 0, 0, 0.12)',
  border: '1px solid #e0e0e0',
  color: '#5a5a5a',
  fontSize: '0.95rem',
  lineHeight: 1.35,
  whiteSpace: 'nowrap',
  pointerEvents: 'none',
} as const;

const tooltipArrowStyles = {
  content: '""',
  position: 'absolute',
  bottom: -10,
  left: '50%',
  transform: 'translateX(-50%) rotate(45deg)',
  width: 16,
  height: 16,
  backgroundColor: '#ffffff',
  borderLeft: '1px solid #e0e0e0',
  borderBottom: '1px solid #e0e0e0',
  transformOrigin: 'center',
} as const;

const headerButtonStyles = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flex: 1,
  height: 44,
  cursor: 'pointer',
  userSelect: 'none',
} as const;

const headerLabelStyles = {
  fontSize: '1rem',
  fontWeight: 600,
  letterSpacing: '0.2em',
  textTransform: 'uppercase',
  color: '#5f5f5f',
} as const;

const containerPaperStyles = {
  borderRadius: '18px 18px 0 0',
  backgroundColor: '#f0f0f0',
  border: '1px solid #d5d5d5',
  boxShadow: '0 18px 40px rgba(0, 0, 0, 0.14)',
  overflow: 'hidden',
  maxWidth: 420,
  width: '100%',
} as const;

function SlotButton({
  slot,
  additive,
  onClick,
  isDragging,
}: {
  slot: SlotKey;
  additive: Additive | null;
  onClick: (event: MouseEvent<HTMLElement>) => void;
  isDragging: boolean;
}) {
  const id = slot === 'left' ? 'compare-slot-left' : 'compare-slot-right';
  const { isOver, setNodeRef } = useDroppable({ id });

  const highlight = isOver || (isDragging && !additive);

  return (
    <Box
      component="button"
      ref={setNodeRef}
      type="button"
      id={id}
      onClick={onClick}
      sx={{
        ...slotButtonStyles,
        borderStyle: additive ? 'solid' : 'dashed',
        borderColor: highlight ? '#7a7a7a' : '#c5c5c5',
        backgroundColor: highlight ? '#ffffff' : slotButtonStyles.backgroundColor,
        boxShadow: highlight ? '0 0 0 2px rgba(0,0,0,0.08)' : 'none',
        outline: 'none',
        '&:focus-visible': {
          boxShadow: '0 0 0 3px rgba(0, 86, 179, 0.35)',
        },
      }}
    >
      {additive ? (
        <Typography sx={slotLabelStyles} component="span">
          {additive.eNumber || formatAdditiveDisplayName(additive.eNumber, additive.title)}
        </Typography>
      ) : (
        <AddIcon sx={{ fontSize: 28, color: '#8a8a8a' }} />
      )}
    </Box>
  );
}

export function CompareWidget() {
  const {
    additives,
    selections,
    isExpanded,
    isVisible,
    isDragEnabled,
    activeDragId,
    showHint,
    openWidget,
    closeWidget,
    dismissHint,
    selectSlot,
  } = useCompareWidget();

  const [pickerState, setPickerState] = useState<SlotPickerState | null>(null);

  const otherSlug = useMemo(() => ({
    left: selections.right?.slug ?? null,
    right: selections.left?.slug ?? null,
  }), [selections.left, selections.right]);

  const handleSlotClick = (slot: SlotKey) => (event: MouseEvent<HTMLElement>) => {
    setPickerState({ slot, anchorEl: event.currentTarget });
    dismissHint();
  };

  const handlePickerClose = () => {
    setPickerState(null);
  };

  const handleAdditiveSelect = (value: Additive | null) => {
    if (!pickerState) {
      return;
    }

    if (value) {
      selectSlot(pickerState.slot, value.slug);
    }

    setPickerState(null);
  };

  const pickerValue = pickerState ? selections[pickerState.slot] : null;
  const disabledSlugs = pickerState ? [otherSlug[pickerState.slot]].filter(Boolean) : [];

  return (
    <Box
      sx={{
        position: 'fixed',
        bottom: { xs: 8, sm: 20 },
        left: 0,
        width: '100%',
        display: isVisible ? 'flex' : 'none',
        justifyContent: 'center',
        pointerEvents: 'none',
        zIndex: 1300,
        px: 1.5,
      }}
    >
      <Paper sx={containerPaperStyles} elevation={0}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            position: 'relative',
            borderBottom: isExpanded ? '1px solid #d0d0d0' : 'none',
            pointerEvents: 'auto',
          }}
        >
          <Box
            component="button"
            type="button"
            onClick={isExpanded ? undefined : openWidget}
            sx={{
              ...headerButtonStyles,
              opacity: isExpanded ? 1 : 0.88,
              border: 'none',
              background: 'transparent',
              padding: 0,
              outline: 'none',
              '&:focus-visible': {
                boxShadow: 'inset 0 0 0 2px rgba(0, 86, 179, 0.35)',
                borderRadius: '14px 14px 0 0',
              },
              '&:disabled': {
                cursor: 'default',
              },
            }}
            aria-label={isExpanded ? 'Compare widget' : 'Open compare widget'}
            disabled={isExpanded}
          >
            <Typography component="span" sx={headerLabelStyles}>
              compare
            </Typography>
          </Box>
          {isExpanded ? (
            <IconButton
              size="small"
              aria-label="Close compare widget"
              onClick={closeWidget}
              sx={{
                position: 'absolute',
                right: 4,
                top: 4,
                color: '#4a4a4a',
              }}
            >
              <CloseIcon fontSize="small" />
            </IconButton>
          ) : null}
        </Box>
        <Collapse in={isExpanded} timeout={220} unmountOnExit>
          <Box
            sx={{
              position: 'relative',
              pointerEvents: 'auto',
              px: { xs: 2, sm: 2.5 },
              py: 2.25,
            }}
          >
            {showHint ? (
              <Box sx={tooltipStyles}>
                drag & drop cards here or click on slots to select additive
                <Box component="span" sx={tooltipArrowStyles} />
              </Box>
            ) : null}
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 1.5,
              }}
            >
              <SlotButton
                slot="left"
                additive={selections.left}
                onClick={handleSlotClick('left')}
                isDragging={isDragEnabled && !!activeDragId}
              />
              <Box
                sx={{
                  width: 1,
                  height: 44,
                  backgroundColor: '#c0c0c0',
                  borderRadius: 0.5,
                }}
              />
              <SlotButton
                slot="right"
                additive={selections.right}
                onClick={handleSlotClick('right')}
                isDragging={isDragEnabled && !!activeDragId}
              />
            </Box>
          </Box>
        </Collapse>
      </Paper>
      <Popover
        open={Boolean(pickerState)}
        onClose={handlePickerClose}
        anchorEl={pickerState?.anchorEl}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        transformOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        slotProps={{ paper: { sx: { borderRadius: 2, width: 320, mt: -1 } } }}
      >
        <Box sx={{ p: 2, width: '100%' }}>
          <AdditiveLookup
            additives={additives}
            value={pickerValue}
            onChange={handleAdditiveSelect}
            clearOnSelect
            autoFocus
            disabledSlugs={disabledSlugs as string[]}
            placeholder="Search additives"
            label={pickerState?.slot === 'left' ? 'Select first additive' : 'Select second additive'}
            showPopupIcon={false}
          />
        </Box>
      </Popover>
    </Box>
  );
}
