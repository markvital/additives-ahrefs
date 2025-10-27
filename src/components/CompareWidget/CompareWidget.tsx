'use client';

import { useMemo, useState } from 'react';
import {
  Box,
  ButtonBase,
  Dialog,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';

import { AdditiveLookup } from '../AdditiveLookup';
import type { Additive } from '../../lib/additives';
import type { CompareWidgetAdditive, SlotIndex } from './types';
import { useCompareWidgetContext } from './CompareWidgetProvider';
import { CompareWidgetSlot } from './CompareWidgetSlot';

interface CompareWidgetProps {
  selectorState: { open: boolean; slot: SlotIndex } | null;
  onSelectorClose: () => void;
  onSlotSelect: (index: SlotIndex, additive: CompareWidgetAdditive | null) => void;
  lookupAdditives: Additive[];
}

const panelShadow = '0px 4px 18px rgba(0, 0, 0, 0.08)';

export function CompareWidget({ selectorState, onSelectorClose, onSlotSelect, lookupAdditives }: CompareWidgetProps) {
  const { isExpanded, setExpanded, selection, requestSlotSelector, isHintVisible, dismissHint } =
    useCompareWidgetContext();
  const [lastOpenedSlot, setLastOpenedSlot] = useState<SlotIndex | null>(null);

  const [firstSelection, secondSelection] = selection;

  const handleToggle = () => {
    setExpanded(!isExpanded);
  };

  const handleClose = () => {
    dismissHint();
    onSelectorClose();
    setExpanded(false);
  };

  const handleSlotClick = (index: SlotIndex) => {
    if (!isExpanded) {
      setExpanded(true);
    }

    requestSlotSelector(index);
    setLastOpenedSlot(index);
  };

  const handleDialogClose = () => {
    onSelectorClose();
  };

  const selectorSlotIndex = selectorState?.slot ?? lastOpenedSlot ?? 0;
  const selectorLabel = selectorSlotIndex === 0 ? 'Select first additive' : 'Select second additive';
  const selectorPlaceholder = selectorSlotIndex === 0 ? 'Search additives' : 'Search additives';
  const disabledSlugs = useMemo(() => {
    const otherSelection = selectorSlotIndex === 0 ? secondSelection : firstSelection;

    return otherSelection ? [otherSelection.slug] : undefined;
  }, [selectorSlotIndex, firstSelection, secondSelection]);

  const selectedSlug = selectorSlotIndex === 0 ? firstSelection?.slug : secondSelection?.slug;
  const dialogValue = useMemo(() => {
    if (!selectedSlug) {
      return null;
    }

    return lookupAdditives.find((item) => item.slug === selectedSlug) ?? null;
  }, [lookupAdditives, selectedSlug]);

  return (
    <Box
      sx={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 1300,
        pointerEvents: 'none',
      }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'center', pb: { xs: 1, sm: 2 }, px: 2 }}>
        <Box
          role="group"
          aria-label="Additives comparison widget"
          sx={{
            pointerEvents: 'auto',
            width: { xs: '100%', sm: 'auto' },
            maxWidth: 480,
            borderRadius: '18px 18px 0 0',
            backgroundColor: '#fdfdfd',
            boxShadow: panelShadow,
            overflow: 'hidden',
            transform: isExpanded ? 'translateY(0)' : 'translateY(calc(100% - 38px))',
            transition: 'transform 0.28s ease',
          }}
        >
          <Stack spacing={0} sx={{ position: 'relative' }}>
            <ButtonBase
              onClick={handleToggle}
              sx={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                height: 38,
                textTransform: 'uppercase',
                letterSpacing: 1,
                fontWeight: 600,
                fontSize: 12,
                color: '#4A4A4A',
                bgcolor: '#E7E7E7',
              }}
            >
              compare
            </ButtonBase>
            <Box
              sx={{
                position: 'relative',
                bgcolor: '#f5f5f5',
                px: 2,
                pb: 2,
                pt: 2,
                display: isExpanded ? 'block' : 'none',
              }}
            >
              <Box display="flex" justifyContent="center" alignItems="center" mb={1.5}>
                <Typography variant="subtitle2" sx={{ textTransform: 'uppercase', letterSpacing: 1 }}>
                  compare
                </Typography>
                <IconButton
                  aria-label="Close compare widget"
                  size="small"
                  onClick={handleClose}
                  sx={{ position: 'absolute', top: 6, right: 6 }}
                >
                  <CloseIcon fontSize="small" />
                </IconButton>
              </Box>
              <Stack direction="row" spacing={1.5} alignItems="stretch">
                <CompareWidgetSlot
                  id="compare-slot-0"
                  label={firstSelection?.eNumber ?? ''}
                  placeholderIcon={<AddIcon />}
                  onClick={() => handleSlotClick(0)}
                  isFilled={Boolean(firstSelection)}
                />
                <Divider flexItem orientation="vertical" sx={{ borderColor: '#d4d4d4' }} />
                <CompareWidgetSlot
                  id="compare-slot-1"
                  label={secondSelection?.eNumber ?? ''}
                  placeholderIcon={<AddIcon />}
                  onClick={() => handleSlotClick(1)}
                  isFilled={Boolean(secondSelection)}
                />
              </Stack>
              {isHintVisible ? (
                <Tooltip
                  open
                  placement="top"
                  title="drag & drop cards here or click on slots to select additive"
                  componentsProps={{
                    tooltip: {
                      sx: {
                        bgcolor: '#4a4a4a',
                        color: '#ffffff',
                        fontSize: 12,
                        px: 2,
                        py: 1,
                        borderRadius: 1,
                        textTransform: 'none',
                      },
                    },
                    arrow: {
                      sx: {
                        color: '#4a4a4a',
                      },
                    },
                  }}
                  arrow
                >
                  <Box sx={{ position: 'absolute', left: '50%', bottom: '100%', transform: 'translate(-50%, -8px)' }}>
                    <Box sx={{ width: 1, height: 1 }} />
                  </Box>
                </Tooltip>
              ) : null}
            </Box>
          </Stack>
        </Box>
      </Box>

      <Dialog
        open={Boolean(selectorState?.open)}
        onClose={handleDialogClose}
        fullWidth
        maxWidth="xs"
        aria-labelledby="compare-widget-selector-title"
      >
        <DialogTitle id="compare-widget-selector-title">{selectorLabel}</DialogTitle>
        <DialogContent>
          <AdditiveLookup
            additives={lookupAdditives}
            value={dialogValue}
            onChange={(value) => {
              onSlotSelect(
                selectorSlotIndex,
                value
                  ? {
                      slug: value.slug,
                      eNumber: value.eNumber,
                      title: value.title,
                    }
                  : null,
              );
              handleDialogClose();
            }}
            placeholder={selectorPlaceholder}
            label={selectorLabel}
            disabledSlugs={disabledSlugs}
            textFieldProps={{ autoFocus: true }}
            clearOnSelect
          />
        </DialogContent>
      </Dialog>
    </Box>
  );
}
