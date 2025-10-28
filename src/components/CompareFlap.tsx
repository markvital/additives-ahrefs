'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Box, Dialog, DialogContent, DialogTitle, Divider, IconButton, Stack, Tooltip, Typography, useMediaQuery } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';
import { DndContext, PointerSensor, useDroppable, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import type { DragStartEvent, DragOverEvent } from '@dnd-kit/core';

import type { Additive } from '../lib/additives';
import { AdditiveLookup } from './AdditiveLookup';
import { theme } from '../lib/theme';

interface CompareFlapContextValue {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
  selectSlot: (index: number, slug: string | null) => void;
  prefillSlot: (slug: string) => void;
  getAdditiveBySlug: (slug: string) => Additive | null;
  slots: [string | null, string | null];
  additives: Additive[];
  activeDropIndex: number | null;
}

const CompareFlapContext = createContext<CompareFlapContextValue | null>(null);

export function useCompareFlap(): CompareFlapContextValue {
  const value = useContext(CompareFlapContext);

  if (!value) {
    throw new Error('useCompareFlap must be used within a CompareFlapProvider');
  }

  return value;
}

interface CompareFlapProviderProps {
  additives: Additive[];
  children: ReactNode;
}

type SlotState = [string | null, string | null];

export function CompareFlapProvider({ additives, children }: CompareFlapProviderProps) {
  const router = useRouter();
  const additiveMap = useMemo(() => new Map(additives.map((item) => [item.slug, item])), [additives]);
  const [slots, setSlots] = useState<SlotState>([null, null]);
  const [isOpen, setIsOpen] = useState(false);
  const [activeDropIndex, setActiveDropIndex] = useState<number | null>(null);
  const lastNavigatedPairRef = useRef<string | null>(null);
  const lastPrefilledSlugRef = useRef<string | null>(null);

  const selectSlot = useCallback(
    (index: number, slug: string | null) => {
      setSlots((prev) => {
        const next: SlotState = [...prev];
        let changed = false;

        if (slug) {
          if (!additiveMap.has(slug)) {
            return prev;
          }

          const otherIndex = index === 0 ? 1 : 0;

          if (next[otherIndex] === slug) {
            next[otherIndex] = null;
            changed = true;
          }

          if (next[index] !== slug) {
            next[index] = slug;
            changed = true;
          }
        } else {
          if (next[index] !== null) {
            next[index] = null;
            changed = true;
          }
        }

        if (!changed) {
          return prev;
        }

        if (index === 0) {
          lastPrefilledSlugRef.current = next[0];
        }

        return next;
      });
    },
    [additiveMap],
  );

  const prefillSlot = useCallback(
    (slug: string) => {
      if (!additiveMap.has(slug)) {
        return;
      }

      setSlots((prev) => {
        const next: SlotState = [...prev];

        if (next[0] === slug && lastPrefilledSlugRef.current === slug) {
          return prev;
        }

        next[0] = slug;

        if (next[1] === slug) {
          next[1] = null;
        }

        lastPrefilledSlugRef.current = slug;

        return next;
      });
    },
    [additiveMap],
  );

  useEffect(() => {
    if (!slots[0] || !slots[1]) {
      lastNavigatedPairRef.current = null;
      return;
    }

    const pair = `${slots[0]}-vs-${slots[1]}`;

    if (lastNavigatedPairRef.current === pair) {
      return;
    }

    lastNavigatedPairRef.current = pair;
    router.push(`/compare/${pair}`);
  }, [router, slots]);

  const open = useCallback(() => setIsOpen(true), []);

  const close = useCallback(() => {
    setIsOpen(false);
    setActiveDropIndex(null);
  }, []);

  const toggle = useCallback(() => {
    setIsOpen((prev) => !prev);
    setActiveDropIndex(null);
  }, []);

  const getAdditiveBySlug = useCallback((slug: string) => additiveMap.get(slug) ?? null, [additiveMap]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const slug = event.active?.data?.current?.slug;

    if (typeof slug === 'string') {
      setIsOpen(true);
    }
  }, []);

  const handleDragOver = useCallback((event: DragOverEvent) => {
    const overId = event.over?.id;

    if (typeof overId === 'string' && overId.startsWith('compare-slot-')) {
      const index = Number.parseInt(overId.replace('compare-slot-', ''), 10);

      if (!Number.isNaN(index)) {
        setActiveDropIndex(index);
        return;
      }
    }

    setActiveDropIndex(null);
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const slug = event.active?.data?.current?.slug;
      const overId = event.over?.id;

      setActiveDropIndex(null);

      if (typeof slug !== 'string') {
        return;
      }

      if (typeof overId === 'string' && overId.startsWith('compare-slot-')) {
        const index = Number.parseInt(overId.replace('compare-slot-', ''), 10);

        if (!Number.isNaN(index)) {
          selectSlot(index, slug);
          setIsOpen(true);
        }
      }
    },
    [selectSlot],
  );

  const handleDragCancel = useCallback(() => {
    setActiveDropIndex(null);
  }, []);

  const contextValue = useMemo<CompareFlapContextValue>(
    () => ({
      isOpen,
      open,
      close,
      toggle,
      selectSlot,
      prefillSlot,
      getAdditiveBySlug,
      slots,
      additives,
      activeDropIndex,
    }),
    [activeDropIndex, additives, close, getAdditiveBySlug, isOpen, open, prefillSlot, selectSlot, slots, toggle],
  );

  return (
    <CompareFlapContext.Provider value={contextValue}>
      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        {children}
        <CompareFlapUI />
      </DndContext>
    </CompareFlapContext.Provider>
  );
}

function CompareFlapUI() {
  const {
    isOpen,
    toggle,
    close,
    open,
    slots,
    getAdditiveBySlug,
    additives,
    selectSlot,
    activeDropIndex,
  } = useCompareFlap();
  const pathname = usePathname();
  const [activeSlotIndex, setActiveSlotIndex] = useState<number | null>(null);
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const leftAdditive = slots[0] ? getAdditiveBySlug(slots[0]) : null;
  const rightAdditive = slots[1] ? getAdditiveBySlug(slots[1]) : null;

  const isComparePage = pathname?.startsWith('/compare');
  const isAboutPage = pathname === '/about';

  if (isComparePage || isAboutPage) {
    return null;
  }

  const handleOpenSlot = (index: number) => {
    setActiveSlotIndex(index);
  };

  const handleCloseDialog = () => {
    setActiveSlotIndex(null);
  };

  const showHint = isOpen && !leftAdditive && !rightAdditive && activeSlotIndex === null;

  return (
    <Box
      component="aside"
      sx={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 0,
        pointerEvents: 'none',
        zIndex: (muiTheme) => muiTheme.zIndex.drawer + 1,
      }}
    >
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          pointerEvents: 'none',
        }}
      >
        <Box
          sx={{
            pointerEvents: 'auto',
            width: 'calc(100% - 24px)',
            maxWidth: 320,
            minWidth: 240,
            borderRadius: '16px 16px 0 0',
            border: '1px solid',
            borderColor: 'divider',
            borderBottomWidth: 0,
            backgroundColor: 'background.paper',
            boxShadow: '0px -10px 28px rgba(0, 0, 0, 0.18)',
            overflow: 'hidden',
            transform: 'translateZ(0)',
          }}
        >
          <Box
            role="button"
            tabIndex={0}
            onClick={toggle}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                toggle();
              }
            }}
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
              minHeight: 48,
              cursor: 'pointer',
              px: 3,
            }}
          >
            <Typography
              variant="subtitle1"
              sx={{
                fontWeight: 600,
                letterSpacing: 1.5,
                textTransform: 'lowercase',
              }}
            >
              compare
            </Typography>
            <IconButton
              aria-label="Close compare flap"
              onClick={(event) => {
                event.stopPropagation();
                close();
              }}
              size="small"
              sx={{
                position: 'absolute',
                right: 6,
                top: '50%',
                transform: 'translateY(-50%)',
              }}
            >
              <CloseIcon fontSize="small" />
            </IconButton>
          </Box>
          <Box
            sx={{
              maxHeight: isOpen ? 320 : 0,
              opacity: isOpen ? 1 : 0,
              transition: 'max-height 260ms ease, opacity 200ms ease',
              overflow: 'hidden',
            }}
          >
            <Stack spacing={2.5} sx={{ px: { xs: 2.5, sm: 3 }, pb: { xs: 2.5, sm: 3 }, pt: 2 }}>
              <Tooltip
                arrow
                open={showHint}
                placement="top"
                disableFocusListener
                disableHoverListener
                disableTouchListener
                title="drag & drop cards here or click on slots to select additive"
                slotProps={{
                  tooltip: {
                    sx: {
                      bgcolor: 'grey.900',
                      color: 'common.white',
                      fontSize: 13,
                      px: 2,
                      py: 1,
                      textAlign: 'center',
                      boxShadow: '0 6px 12px rgba(0, 0, 0, 0.28)',
                      borderRadius: 1.5,
                      maxWidth: 220,
                    },
                  },
                  arrow: {
                    sx: {
                      color: 'grey.900',
                    },
                  },
                }}
              >
                <Stack
                  direction={isMobile ? 'column' : 'row'}
                  spacing={isMobile ? 1.5 : 2}
                  alignItems="stretch"
                  sx={{ width: '100%' }}
                  divider={
                    <Divider
                      orientation={isMobile ? 'horizontal' : 'vertical'}
                      flexItem
                      sx={{ borderColor: 'grey.300' }}
                    />
                  }
                >
                  <Slot
                    index={0}
                    additive={leftAdditive}
                    isHighlighted={activeDropIndex === 0}
                    onClick={() => {
                      open();
                      handleOpenSlot(0);
                    }}
                  />
                  <Slot
                    index={1}
                    additive={rightAdditive}
                    isHighlighted={activeDropIndex === 1}
                    onClick={() => {
                      open();
                      handleOpenSlot(1);
                    }}
                  />
                </Stack>
              </Tooltip>
            </Stack>
          </Box>
        </Box>
      </Box>
      <Dialog
        open={activeSlotIndex !== null}
        onClose={handleCloseDialog}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Select additive</DialogTitle>
        <DialogContent>
          <AdditiveLookup
            additives={additives}
            value={
              activeSlotIndex === 0
                ? leftAdditive
                : activeSlotIndex === 1
                  ? rightAdditive
                  : null
            }
            onChange={(value) => {
              if (activeSlotIndex === null) {
                return;
              }

              selectSlot(activeSlotIndex, value ? value.slug : null);
              handleCloseDialog();
            }}
            placeholder="Search additives"
            disabledSlugs={(() => {
              if (activeSlotIndex === null) {
                return undefined;
              }

              const otherIndex = activeSlotIndex === 0 ? 1 : 0;
              const otherSlug = slots[otherIndex];

              return otherSlug ? [otherSlug] : undefined;
            })()}
            autoFocus
            clearOnSelect
            showPopupIcon={false}
            textFieldProps={{
              label: 'Additive name or E-number',
              placeholder: 'Start typing to search',
            }}
          />
        </DialogContent>
      </Dialog>
    </Box>
  );
}

interface SlotProps {
  index: number;
  additive: Additive | null;
  isHighlighted: boolean;
  onClick: () => void;
}

function Slot({ index, additive, isHighlighted, onClick }: SlotProps) {
  const droppable = useDroppable({ id: `compare-slot-${index}` });
  const isOver = droppable.isOver;
  const showHighlight = isOver || isHighlighted;

  return (
    <Box
      ref={droppable.setNodeRef}
      role="button"
      tabIndex={0}
      data-compare-slot={index}
      onClick={onClick}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onClick();
        }
      }}
      sx={{
        flex: 1,
        minHeight: 96,
        borderRadius: '14px',
        border: '1.5px dashed',
        borderColor: showHighlight ? 'primary.main' : additive ? 'grey.400' : 'grey.500',
        bgcolor: additive ? 'grey.100' : 'rgba(255, 255, 255, 0.8)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        transition: 'border-color 180ms ease, background-color 180ms ease, box-shadow 180ms ease',
        cursor: 'pointer',
        boxShadow: showHighlight
          ? '0 0 0 3px rgba(25, 118, 210, 0.25)'
          : 'inset 0 0 0 1px rgba(0, 0, 0, 0.04)',
        textAlign: 'center',
        px: { xs: 2, sm: 3 },
        outline: 'none',
        '&:focus-visible': {
          boxShadow: '0 0 0 3px rgba(25, 118, 210, 0.3)',
        },
      }}
    >
      {additive ? (
        <Typography
          variant="h4"
          component="span"
          sx={{
            fontWeight: 700,
            letterSpacing: 0.5,
          }}
        >
          {additive.eNumber || additive.title}
        </Typography>
      ) : (
        <Stack spacing={1} alignItems="center" justifyContent="center">
          <Box
            sx={{
              width: 36,
              height: 36,
              borderRadius: '50%',
              bgcolor: 'grey.100',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'grey.600',
              border: '1px solid',
              borderColor: 'grey.400',
            }}
          >
            <AddIcon />
          </Box>
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 500 }}>
            Add additive
          </Typography>
        </Stack>
      )}
    </Box>
  );
}

interface CompareFlapPrefillProps {
  slug: string;
}

export function CompareFlapPrefill({ slug }: CompareFlapPrefillProps) {
  const { prefillSlot } = useCompareFlap();

  useEffect(() => {
    prefillSlot(slug);
  }, [prefillSlot, slug]);

  return null;
}
