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
import { Box, Dialog, DialogContent, DialogTitle, Divider, IconButton, Stack, Typography, useMediaQuery } from '@mui/material';
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

  const selectSlot = useCallback(
    (index: number, slug: string | null) => {
      setSlots((prev) => {
        const next: SlotState = [...prev];

        if (slug) {
          if (!additiveMap.has(slug)) {
            return prev;
          }

          const otherIndex = index === 0 ? 1 : 0;

          if (next[otherIndex] === slug) {
            next[otherIndex] = null;
          }

          next[index] = slug;
        } else {
          next[index] = null;
        }

        return next;
      });
    },
    [additiveMap],
  );

  const prefillSlot = useCallback(
    (slug: string) => {
      setSlots((prev) => {
        if (prev[0] || prev[1] || !additiveMap.has(slug)) {
          return prev;
        }

        const next: SlotState = [slug, prev[1]];

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

  if (isComparePage) {
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
        zIndex: 1200,
        pointerEvents: 'none',
      }}
    >
      <Box
        sx={{
          maxWidth: 1280,
          mx: 'auto',
          px: { xs: 1.5, sm: 2.5 },
          pb: { xs: 1.5, sm: 2 },
          pointerEvents: 'none',
        }}
      >
        <Box
          sx={{
            borderRadius: '16px 16px 0 0',
            boxShadow: '0px -8px 24px rgba(0, 0, 0, 0.1)',
            backgroundColor: 'background.paper',
            border: '1px solid',
            borderColor: 'divider',
            overflow: 'hidden',
            pointerEvents: 'auto',
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
              minHeight: 56,
              cursor: 'pointer',
              px: 3,
            }}
          >
            <Typography
              variant="subtitle1"
              sx={{
                textTransform: 'uppercase',
                letterSpacing: 2,
                fontWeight: 600,
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
                right: 8,
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
              transition: 'max-height 240ms ease, opacity 200ms ease',
              overflow: 'hidden',
            }}
          >
            <Stack spacing={2} sx={{ px: { xs: 2, sm: 3 }, pb: { xs: 2.5, sm: 3 } }}>
              {showHint ? (
                <Box
                  sx={{
                    alignSelf: 'center',
                    bgcolor: 'grey.900',
                    color: 'common.white',
                    px: 2,
                    py: 1,
                    borderRadius: 2,
                    fontSize: 14,
                    textAlign: 'center',
                    boxShadow: '0 6px 12px rgba(0, 0, 0, 0.2)',
                  }}
                >
                  drag & drop cards here or click on slots to select additive
                </Box>
              ) : null}
              <Stack
                direction={isMobile ? 'column' : 'row'}
                spacing={isMobile ? 1.5 : 2}
                alignItems="stretch"
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
        minHeight: 108,
        borderRadius: 3,
        border: '2px dashed',
        borderColor: showHighlight ? 'primary.main' : additive ? 'divider' : 'grey.400',
        bgcolor: additive ? 'grey.100' : 'transparent',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        transition: 'border-color 160ms ease, background-color 160ms ease, box-shadow 160ms ease',
        cursor: 'pointer',
        boxShadow: showHighlight ? '0 0 0 3px rgba(25, 118, 210, 0.25)' : undefined,
        textAlign: 'center',
        px: { xs: 2, sm: 3 },
      }}
    >
      {additive ? (
        <Typography
          variant="h4"
          component="span"
          sx={{
            fontWeight: 700,
            letterSpacing: 1,
          }}
        >
          {additive.eNumber || additive.title}
        </Typography>
      ) : (
        <Stack spacing={1} alignItems="center" justifyContent="center">
          <Box
            sx={{
              width: 40,
              height: 40,
              borderRadius: '50%',
              bgcolor: 'grey.200',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'grey.600',
            }}
          >
            <AddIcon />
          </Box>
          <Typography variant="body2" color="text.secondary">
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
