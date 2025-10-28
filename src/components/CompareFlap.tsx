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
import { Box, ClickAwayListener, Divider, IconButton, Paper, Popper, Stack, Typography, useMediaQuery } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';
import { DndContext, PointerSensor, useDroppable, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import type { DragStartEvent, DragOverEvent } from '@dnd-kit/core';
import type { Modifier } from '@popperjs/core';

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
  dismissHint: () => void;
  hasDismissedHint: boolean;
  isDragging: boolean;
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

const SELECTOR_POPPER_HEIGHT = 56 + 6 * 48 + 32;

export function CompareFlapProvider({ additives, children }: CompareFlapProviderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const additiveMap = useMemo(() => new Map(additives.map((item) => [item.slug, item])), [additives]);
  const [slots, setSlots] = useState<SlotState>([null, null]);
  const [isOpen, setIsOpen] = useState(false);
  const [activeDropIndex, setActiveDropIndex] = useState<number | null>(null);
  const [hasDismissedHint, setHasDismissedHint] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const lastNavigatedPairRef = useRef<string | null>(null);
  const lastPrefilledSlugRef = useRef<string | null>(null);
  const previousPathRef = useRef<string | null>(null);

  const dismissHint = useCallback(() => {
    setHasDismissedHint(true);
  }, []);

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
    if (!pathname) {
      return;
    }

    if (previousPathRef.current === pathname) {
      return;
    }

    if (previousPathRef.current !== null && previousPathRef.current !== pathname) {
      setSlots([null, null]);
      setIsOpen(false);
      setActiveDropIndex(null);
      lastNavigatedPairRef.current = null;
      lastPrefilledSlugRef.current = null;
    }

    previousPathRef.current = pathname;
  }, [pathname]);

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
      dismissHint();
      setIsDragging(true);
      setIsOpen(true);
    }
  }, [dismissHint]);

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
      setIsDragging(false);
      dismissHint();

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
    [dismissHint, selectSlot],
  );

  const handleDragCancel = useCallback(() => {
    setActiveDropIndex(null);
    setIsDragging(false);
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
      dismissHint,
      hasDismissedHint,
      isDragging,
    }),
    [
      activeDropIndex,
      additives,
      close,
      dismissHint,
      getAdditiveBySlug,
      hasDismissedHint,
      isDragging,
      isOpen,
      open,
      prefillSlot,
      selectSlot,
      slots,
      toggle,
    ],
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
        {isDragging ? <ScreenMatte /> : null}
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
    open: openFlap,
    slots,
    getAdditiveBySlug,
    additives,
    selectSlot,
    activeDropIndex,
    dismissHint,
    hasDismissedHint,
  } = useCompareFlap();
  const pathname = usePathname();
  const [activeSlotIndex, setActiveSlotIndex] = useState<number | null>(null);
  const [slotAnchorEl, setSlotAnchorEl] = useState<HTMLElement | null>(null);
  const [hintAnchorEl, setHintAnchorEl] = useState<HTMLDivElement | null>(null);
  const [hintArrowEl, setHintArrowEl] = useState<HTMLDivElement | null>(null);
  const [selectorArrowEl, setSelectorArrowEl] = useState<HTMLDivElement | null>(null);
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const leftAdditive = slots[0] ? getAdditiveBySlug(slots[0]) : null;
  const rightAdditive = slots[1] ? getAdditiveBySlug(slots[1]) : null;

  const isComparePage = pathname?.startsWith('/compare');
  const isAboutPage = pathname === '/about';
  const shouldHide = isComparePage || isAboutPage;

  useEffect(() => {
    setActiveSlotIndex(null);
  }, [pathname]);

  useEffect(() => {
    if (activeSlotIndex === null) {
      setSlotAnchorEl(null);
    }
  }, [activeSlotIndex]);

  useEffect(() => {
    if (hasDismissedHint || shouldHide) {
      return;
    }

    const handleFirstInteraction = () => {
      dismissHint();
    };

    const handleFirstKey = () => {
      dismissHint();
    };

    window.addEventListener('pointerdown', handleFirstInteraction, { once: true });
    window.addEventListener('keydown', handleFirstKey, { once: true });

    return () => {
      window.removeEventListener('pointerdown', handleFirstInteraction);
      window.removeEventListener('keydown', handleFirstKey);
    };
  }, [dismissHint, hasDismissedHint, shouldHide]);

  const showHint = isOpen && !leftAdditive && !rightAdditive && activeSlotIndex === null && !hasDismissedHint;

  const handleToggle = () => {
    dismissHint();
    toggle();
  };

  const handleClose = () => {
    dismissHint();
    close();
    setActiveSlotIndex(null);
  };

  const handleOpenSlot = (index: number, element: HTMLElement) => {
    dismissHint();
    openFlap();
    setActiveSlotIndex(index);
    setSlotAnchorEl(element);
  };

  const handleCloseSelector = useCallback(() => {
    setActiveSlotIndex(null);
  }, []);

  useEffect(() => {
    if (activeSlotIndex === null || shouldHide) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        handleCloseSelector();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [activeSlotIndex, handleCloseSelector, shouldHide]);

  const selectorModifiers = useMemo(() => {
    const modifiers: any[] = [
      { name: 'offset', options: { offset: [0, 16] } },
      { name: 'flip', enabled: false },
    ];

    if (selectorArrowEl) {
      modifiers.push({ name: 'arrow', enabled: true, options: { element: selectorArrowEl } });
    }

    return modifiers;
  }, [selectorArrowEl]);

  const hintModifiers = useMemo(() => {
    const modifiers: any[] = [
      { name: 'offset', options: { offset: [0, 12] } },
      { name: 'flip', enabled: false },
    ];

    if (hintArrowEl) {
      modifiers.push({ name: 'arrow', enabled: true, options: { element: hintArrowEl } });
    }

    return modifiers;
  }, [hintArrowEl]);

  if (shouldHide) {
    return null;
  }

  return (
    <Box
      component="aside"
      sx={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 0,
        pointerEvents: 'none',
        zIndex: (muiTheme) => muiTheme.zIndex.tooltip + 2,
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
          ref={setHintAnchorEl}
          sx={{
            pointerEvents: 'auto',
            width: 'calc(100% - 20px)',
            maxWidth: 264,
            minWidth: 210,
            borderRadius: '16px 16px 0 0',
            border: '1px solid',
            borderColor: 'divider',
            borderBottomWidth: 0,
            backgroundColor: 'background.paper',
            boxShadow: '0px -12px 28px rgba(0, 0, 0, 0.18)',
            overflow: 'hidden',
            transform: 'translateZ(0)',
          }}
        >
          <Box
            role="button"
            tabIndex={0}
            onClick={handleToggle}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                handleToggle();
              }
            }}
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
              minHeight: isOpen ? 38 : 28,
              cursor: 'pointer',
              px: 2,
              py: 0.75,
              textTransform: 'lowercase',
            }}
          >
            <Typography
              variant="subtitle2"
              sx={{
                fontWeight: 600,
                letterSpacing: 1.6,
                textTransform: 'lowercase',
              }}
            >
              compare
            </Typography>
            {isOpen ? (
              <IconButton
                aria-label="Close compare flap"
                onClick={(event) => {
                  event.stopPropagation();
                  handleClose();
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
            ) : null}
          </Box>
          <Box
            sx={{
              maxHeight: isOpen ? 320 : 0,
              opacity: isOpen ? 1 : 0,
              transition: 'max-height 260ms ease, opacity 200ms ease',
              overflow: 'hidden',
              borderTop: '1px solid',
              borderColor: 'divider',
            }}
          >
            <Stack spacing={2} sx={{ px: { xs: 2.25, sm: 2.75 }, pb: { xs: 2.25, sm: 2.75 }, pt: 2 }}>
              <Stack
                direction={isMobile ? 'column' : 'row'}
                spacing={isMobile ? 1.25 : 1.75}
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
                  onSelect={(element) => {
                    handleOpenSlot(0, element);
                  }}
                />
                <Slot
                  index={1}
                  additive={rightAdditive}
                  isHighlighted={activeDropIndex === 1}
                  onSelect={(element) => {
                    handleOpenSlot(1, element);
                  }}
                />
              </Stack>
            </Stack>
          </Box>
        </Box>
      </Box>

      <Popper
        open={showHint}
        placement="top"
        anchorEl={hintAnchorEl}
        modifiers={hintModifiers as unknown as Modifier<any, any>[]}
        disablePortal
      >
        <Box sx={{ position: 'relative' }}>
          <Paper
            elevation={6}
            sx={{
              px: 2,
              py: 1,
              bgcolor: 'grey.900',
              color: 'common.white',
              fontSize: 13,
              textAlign: 'center',
              borderRadius: 2,
              maxWidth: 260,
            }}
          >
            drag & drop cards here or click on slots to select additive
          </Paper>
          <Box
            ref={setHintArrowEl}
            sx={{
              position: 'absolute',
              bottom: -6,
              left: '50%',
              width: 12,
              height: 6,
              transform: 'translateX(-50%)',
              '&::before': {
                content: "''",
                position: 'absolute',
                width: 12,
                height: 12,
                bgcolor: 'grey.900',
                transform: 'translateY(-50%) rotate(45deg)',
                left: 0,
                top: '50%',
              },
            }}
          />
        </Box>
      </Popper>

      <Popper
        open={activeSlotIndex !== null}
        placement="top"
        anchorEl={slotAnchorEl}
        modifiers={selectorModifiers as unknown as Modifier<any, any>[]}
      >
        <ClickAwayListener
          onClickAway={(event) => {
            if (slotAnchorEl && slotAnchorEl.contains(event.target as Node)) {
              return;
            }
            handleCloseSelector();
          }}
        >
          <Box sx={{ position: 'relative' }}>
            <Paper
              elevation={8}
              sx={{
                width: 360,
                maxWidth: 'calc(100vw - 32px)',
                minWidth: 280,
                borderRadius: 3,
                p: 2,
                pt: 2.5,
                height: SELECTOR_POPPER_HEIGHT,
                maxHeight: 'calc(100vh - 96px)',
                display: 'flex',
                flexDirection: 'column',
                boxShadow: '0px 12px 32px rgba(0, 0, 0, 0.28)',
              }}
            >
              <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1.5 }}>
                Select additive
              </Typography>
              <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
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

                    selectSlot(activeSlotIndex, value?.slug ?? null);
                    handleCloseSelector();
                  }}
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
                    label: 'Select additive',
                    placeholder: 'Start typing to search',
                    fullWidth: true,
                  }}
                />
              </Box>
            </Paper>
            <Box
              ref={setSelectorArrowEl}
              sx={{
                position: 'absolute',
                bottom: -8,
                left: '50%',
                width: 16,
                height: 8,
                transform: 'translateX(-50%)',
                '&::before': {
                  content: "''",
                  position: 'absolute',
                  width: 16,
                  height: 16,
                  bgcolor: 'background.paper',
                  transform: 'translateY(-50%) rotate(45deg)',
                  left: 0,
                  top: '50%',
                  boxShadow: '0px 12px 32px rgba(0, 0, 0, 0.12)',
                },
              }}
            />
          </Box>
        </ClickAwayListener>
      </Popper>
    </Box>
  );
}

function ScreenMatte() {
  return (
    <Box
      sx={{
        position: 'fixed',
        inset: 0,
        pointerEvents: 'none',
        touchAction: 'none',
        zIndex: (muiTheme) => muiTheme.zIndex.modal,
      }}
    />
  );
}

interface SlotProps {
  index: number;
  additive: Additive | null;
  isHighlighted: boolean;
  onSelect: (element: HTMLElement) => void;
}

function Slot({ index, additive, isHighlighted, onSelect }: SlotProps) {
  const droppable = useDroppable({ id: `compare-slot-${index}` });
  const isOver = droppable.isOver;
  const showHighlight = isOver || isHighlighted;

  return (
    <Box
      ref={droppable.setNodeRef}
      role="button"
      tabIndex={0}
      data-compare-slot={index}
      onClick={(event) => {
        onSelect(event.currentTarget as HTMLElement);
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onSelect(event.currentTarget as HTMLElement);
        }
      }}
      sx={{
        flex: 1,
        minHeight: 72,
        borderRadius: '12px',
        border: '1.5px dashed',
        borderColor: showHighlight ? 'primary.main' : additive ? 'grey.400' : 'grey.500',
        bgcolor: additive ? 'grey.100' : 'rgba(255, 255, 255, 0.86)',
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
        px: { xs: 1.75, sm: 2.5 },
        outline: 'none',
        '&:focus-visible': {
          boxShadow: '0 0 0 3px rgba(25, 118, 210, 0.3)',
        },
      }}
    >
      {additive ? (
        <Typography
          variant="h5"
          component="span"
          sx={{
            fontWeight: 700,
            letterSpacing: 0.4,
          }}
        >
          {additive.eNumber || additive.title}
        </Typography>
      ) : (
        <Box
          sx={{
            width: 32,
            height: 32,
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
          <AddIcon fontSize="small" />
        </Box>
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
