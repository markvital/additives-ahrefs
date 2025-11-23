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
import { Box, ButtonBase, ClickAwayListener, Divider, IconButton, Paper, Popper, Stack, Typography, useMediaQuery } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';
import { DndContext, PointerSensor, TouchSensor, useDroppable, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
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
  isWidgetDroppableActive: boolean;
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

const SELECTOR_POPPER_HEIGHT_DESKTOP = 495;
const SELECTOR_POPPER_HEIGHT_MOBILE = 440;
const HINT_APPEAR_DELAY_MS = 280;

function extractAdditiveSlug(pathname: string | null): string | null {
  if (!pathname || pathname === '/' || pathname === '/about' || pathname === '/privacy' || pathname === '/terms') {
    return null;
  }

  if (pathname.startsWith('/compare') || pathname.startsWith('/function') || pathname.startsWith('/origin')) {
    return null;
  }

  const segments = pathname.split('/').filter(Boolean);

  if (segments.length !== 1) {
    return null;
  }

  return segments[0] ?? null;
}

export function CompareFlapProvider({ additives, children }: CompareFlapProviderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const additiveMap = useMemo(() => new Map(additives.map((item) => [item.slug, item])), [additives]);
  const [slots, setSlots] = useState<SlotState>([null, null]);
  const [isOpen, setIsOpen] = useState(false);
  const [activeDropIndex, setActiveDropIndex] = useState<number | null>(null);
  const [hasDismissedHint, setHasDismissedHint] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isWidgetDroppableActive, setIsWidgetDroppableActive] = useState(false);
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

    const potentialSlug = extractAdditiveSlug(pathname);
    const resolvedSlug = potentialSlug && additiveMap.has(potentialSlug) ? potentialSlug : null;

    setSlots([resolvedSlug, null]);
    setIsOpen(false);
    setActiveDropIndex(null);
    lastNavigatedPairRef.current = null;
    lastPrefilledSlugRef.current = resolvedSlug;

    previousPathRef.current = pathname;
  }, [additiveMap, pathname]);

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
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 150,
        tolerance: 8,
      },
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

  useEffect(() => {
    const previousCursor = document.body.style.cursor;

    if (isDragging) {
      document.body.style.cursor = 'grabbing';
    } else {
      document.body.style.cursor = previousCursor || '';
    }

    return () => {
      document.body.style.cursor = previousCursor;
    };
  }, [isDragging]);

  const handleDragOver = useCallback(
    (event: DragOverEvent) => {
      const overId = event.over?.id;

      if (typeof overId === 'string') {
        if (overId.startsWith('compare-slot-')) {
          const index = Number.parseInt(overId.replace('compare-slot-', ''), 10);

          if (!Number.isNaN(index)) {
            setActiveDropIndex(index);
            setIsWidgetDroppableActive(false);
            return;
          }
        }

        if (overId === 'compare-widget') {
          const firstAvailableIndex = slots.findIndex((slot) => slot === null);

          setActiveDropIndex(firstAvailableIndex >= 0 ? firstAvailableIndex : null);
          setIsWidgetDroppableActive(firstAvailableIndex >= 0);
          return;
        }
      }

      setActiveDropIndex(null);
      setIsWidgetDroppableActive(false);
    },
    [slots],
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const slug = event.active?.data?.current?.slug;
      const overId = event.over?.id;

      setActiveDropIndex(null);
      setIsDragging(false);
      dismissHint();
      setIsWidgetDroppableActive(false);

      if (typeof slug !== 'string') {
        return;
      }

      if (typeof overId === 'string') {
        if (overId.startsWith('compare-slot-')) {
          const index = Number.parseInt(overId.replace('compare-slot-', ''), 10);

          if (!Number.isNaN(index)) {
            selectSlot(index, slug);
            setIsOpen(true);
          }

          return;
        }

        if (overId === 'compare-widget') {
          const firstAvailableIndex = slots.findIndex((slot) => slot === null);

          if (firstAvailableIndex >= 0) {
            selectSlot(firstAvailableIndex, slug);
            setIsOpen(true);
          }

          return;
        }
      }
    },
    [dismissHint, selectSlot, slots],
  );

  const handleDragCancel = useCallback(() => {
    setActiveDropIndex(null);
    setIsDragging(false);
    setIsWidgetDroppableActive(false);
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
      isWidgetDroppableActive,
    }),
    [
      activeDropIndex,
      additives,
      close,
      dismissHint,
      getAdditiveBySlug,
      hasDismissedHint,
      isWidgetDroppableActive,
      isDragging,
      isOpen,
      open,
      prefillSlot,
      selectSlot,
      slots,
      toggle,
    ],
  );

  // Don't render CompareFlap UI on preview pages
  const isPreview = pathname?.startsWith('/_preview');

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
        {!isPreview && isDragging ? <ScreenMatte /> : null}
        {!isPreview && <CompareFlapUI />}
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
    isWidgetDroppableActive,
  } = useCompareFlap();
  const pathname = usePathname();
  const [activeSlotIndex, setActiveSlotIndex] = useState<number | null>(null);
  const [slotAnchorEl, setSlotAnchorEl] = useState<HTMLElement | null>(null);
  const [slotReferenceEl, setSlotReferenceEl] = useState<HTMLElement | null>(null);
  const [hintAnchorEl, setHintAnchorEl] = useState<HTMLElement | null>(null);
  const [hintArrowEl, setHintArrowEl] = useState<HTMLDivElement | null>(null);
  const [selectorArrowEl, setSelectorArrowEl] = useState<HTMLDivElement | null>(null);
  const [showHint, setShowHint] = useState(false);
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const selectorHeight = isMobile ? SELECTOR_POPPER_HEIGHT_MOBILE : SELECTOR_POPPER_HEIGHT_DESKTOP;
  const headerRef = useRef<HTMLDivElement | null>(null);
  const widgetDropTarget = useDroppable({ id: 'compare-widget' });
  const isWidgetOver = widgetDropTarget.isOver || isWidgetDroppableActive;

  const handleHeaderRef = useCallback((element: HTMLDivElement | null) => {
    headerRef.current = element;
    setHintAnchorEl(element);
  }, []);

  const leftAdditive = slots[0] ? getAdditiveBySlug(slots[0]) : null;
  const rightAdditive = slots[1] ? getAdditiveBySlug(slots[1]) : null;

  const isComparePage = pathname?.startsWith('/compare');
  const isAboutPage = pathname === '/about';
  const isPrivacyPage = pathname === '/privacy';
  const isTermsPage = pathname === '/terms';
  const potentialSlug = extractAdditiveSlug(pathname ?? null);
  const isUnknownAdditivePath = potentialSlug ? !getAdditiveBySlug(potentialSlug) : false;
  const shouldHide =
    isComparePage || isAboutPage || isPrivacyPage || isTermsPage || isUnknownAdditivePath;

  useEffect(() => {
    if (shouldHide) {
      setHintAnchorEl(null);
      return;
    }

    setHintAnchorEl(headerRef.current);
  }, [shouldHide]);

  useEffect(() => {
    setActiveSlotIndex(null);
  }, [pathname]);

  useEffect(() => {
    console.log('[CompareFlap] visibility change', {
      timestamp: performance.now(),
      isOpen,
    });
  }, [isOpen]);

  useEffect(() => {
    if (activeSlotIndex === null) {
      setSlotAnchorEl(null);
      setSlotReferenceEl(null);
    }
  }, [activeSlotIndex]);

  const shouldDisplayHint =
    isOpen &&
    !leftAdditive &&
    !rightAdditive &&
    activeSlotIndex === null &&
    !hasDismissedHint &&
    !shouldHide;

  useEffect(() => {
    if (!shouldDisplayHint) {
      setShowHint(false);
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setShowHint(true);
    }, HINT_APPEAR_DELAY_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [shouldDisplayHint]);

  useEffect(() => {
    if (!showHint) {
      return;
    }

    const handlePointerDown = () => {
      dismissHint();
    };

    const handleKeyDown = () => {
      dismissHint();
    };

    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [dismissHint, showHint]);

  const handleToggle = () => {
    console.log('[CompareFlap] toggle requested', {
      timestamp: performance.now(),
      currentState: isOpen,
    });
    toggle();
  };

  const handleClose = () => {
    console.log('[CompareFlap] close requested', {
      timestamp: performance.now(),
    });
    dismissHint();
    close();
    setActiveSlotIndex(null);
    setSlotAnchorEl(null);
    setSlotReferenceEl(null);
  };

  const handleOpenSlot = (
    index: number,
    elements: { anchorEl: HTMLElement | null; slotEl: HTMLElement },
  ) => {
    dismissHint();
    openFlap();
    setActiveSlotIndex(index);
    setSlotAnchorEl(elements.anchorEl ?? elements.slotEl);
    setSlotReferenceEl(elements.slotEl);
  };

  const handleCloseSelector = useCallback(() => {
    setActiveSlotIndex(null);
    setSlotAnchorEl(null);
    setSlotReferenceEl(null);
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
      { name: 'offset', options: { offset: [0, 18] } },
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
        zIndex: (muiTheme) => muiTheme.zIndex.tooltip + 10,
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
          ref={widgetDropTarget.setNodeRef}
          sx={{
            pointerEvents: 'auto',
            width: isOpen ? 'min(250px, calc(100vw - 24px))' : '100px',
            transition: 'width 220ms ease, border-radius 220ms ease, box-shadow 220ms ease',
            borderRadius: isOpen ? '26px 26px 0 0' : '22px 22px 0 0',
            border: '1px solid',
            borderColor: isWidgetOver ? 'primary.main' : 'divider',
            borderBottomWidth: 0,
            backgroundColor: 'background.paper',
            boxShadow: isWidgetOver
              ? '0px -12px 28px rgba(0, 0, 0, 0.18), 0 0 0 3px rgba(25, 118, 210, 0.16)'
              : '0px -12px 28px rgba(0, 0, 0, 0.18)',
            overflow: 'hidden',
            transform: 'translateZ(0)',
            maxWidth: 'min(250px, calc(100vw - 24px))',
            position: 'relative',
          }}
        >
          <Box
            ref={handleHeaderRef}
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
              minHeight: isOpen ? 44 : 30,
              cursor: 'pointer',
              px: isOpen ? 2.75 : 1.75,
              py: isOpen ? 1.25 : 0.75,
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
                  right: '10px',
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
              maxHeight: isOpen ? 260 : 0,
              opacity: isOpen ? 1 : 0,
              transition: 'max-height 260ms ease, opacity 200ms ease',
              overflow: 'hidden',
              borderTop: '1px solid',
              borderColor: 'divider',
            }}
          >
            <Stack spacing={0} sx={{ px: 0, pb: 0, pt: 0 }}>
              <Stack
                direction="row"
                spacing={0}
                alignItems="stretch"
                sx={{
                  width: '100%',
                  flexWrap: 'nowrap',
                  minWidth: 0,
                  transition: 'background-color 160ms ease',
                  backgroundColor: isWidgetOver ? 'rgba(25, 118, 210, 0.08)' : 'transparent',
                }}
                divider={<Divider orientation="vertical" flexItem sx={{ borderColor: 'grey.300', my: 0 }} />}
              >
                <Slot
                  index={0}
                  additive={leftAdditive}
                  isHighlighted={activeDropIndex === 0}
                  onSelect={(payload) => {
                    handleOpenSlot(0, payload);
                  }}
                />
                <Slot
                  index={1}
                  additive={rightAdditive}
                  isHighlighted={activeDropIndex === 1}
                  onSelect={(payload) => {
                    handleOpenSlot(1, payload);
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
        sx={{ zIndex: (muiTheme) => muiTheme.zIndex.tooltip + 12 }}
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
              bottom: -12,
              left: '50%',
              width: 0,
              height: 0,
              transform: 'translateX(-50%)',
              borderLeft: '10px solid transparent',
              borderRight: '10px solid transparent',
              borderTop: '12px solid',
              borderTopColor: 'grey.900',
              filter: 'drop-shadow(0px 4px 12px rgba(0, 0, 0, 0.24))',
            }}
          />
        </Box>
      </Popper>

      <Popper
        open={activeSlotIndex !== null}
        placement="top"
        anchorEl={slotAnchorEl}
        modifiers={selectorModifiers as unknown as Modifier<any, any>[]}
        sx={{ zIndex: (muiTheme) => muiTheme.zIndex.tooltip + 14 }}
      >
        <ClickAwayListener
          onClickAway={(event) => {
            if (slotReferenceEl && slotReferenceEl.contains(event.target as Node)) {
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
                px: { xs: 2.5, sm: 3 },
                pt: { xs: 3, sm: 3.5 },
                pb: { xs: 3, sm: 3.5 },
                height: `${selectorHeight}px`,
                maxHeight: `min(${selectorHeight}px, calc(100vh - 64px))`,
                display: 'flex',
                flexDirection: 'column',
                boxShadow: '0px 18px 36px rgba(0, 0, 0, 0.24)',
                overflow: 'visible',
                zIndex: (muiTheme) => muiTheme.zIndex.tooltip + 16,
                backgroundColor: '#f3f3f3',
                border: '1px solid',
                borderColor: 'grey.200',
              }}
            >
              <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
                <AdditiveLookup
                  key={activeSlotIndex ?? 'selector'}
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
                    label:
                      activeSlotIndex === 0
                        ? 'Select first additive'
                        : activeSlotIndex === 1
                          ? 'Select second additive'
                          : 'Choose additive',
                    placeholder: 'Search additives',
                    fullWidth: true,
                    inputProps: {
                      'aria-label': 'Search additives',
                    },
                  }}
                  disablePortal={false}
                />
              </Box>
            </Paper>
            <Box
              ref={setSelectorArrowEl}
              sx={{
                position: 'absolute',
                bottom: -18,
                left: '50%',
                width: 0,
                height: 0,
                transform: 'translateX(-50%)',
                borderLeft: '16px solid transparent',
                borderRight: '16px solid transparent',
                borderTop: '18px solid',
                borderTopColor: '#f3f3f3',
                filter: 'drop-shadow(0px 12px 32px rgba(0, 0, 0, 0.18))',
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
        pointerEvents: 'auto',
        touchAction: 'none',
        backgroundColor: 'transparent',
        zIndex: (muiTheme) => muiTheme.zIndex.tooltip + 8,
      }}
    />
  );
}

interface SlotSelectPayload {
  anchorEl: HTMLElement | null;
  slotEl: HTMLElement;
}

interface SlotProps {
  index: number;
  additive: Additive | null;
  isHighlighted: boolean;
  onSelect: (payload: SlotSelectPayload) => void;
}

function Slot({ index, additive, isHighlighted, onSelect }: SlotProps) {
  const droppable = useDroppable({ id: `compare-slot-${index}` });
  const anchorRef = useRef<HTMLDivElement | null>(null);

  const { isOver, setNodeRef } = droppable;
  const showHighlight = isOver || isHighlighted;

  return (
    <ButtonBase
      focusRipple={false}
      disableRipple
      data-compare-slot={index}
      onClick={(event) => {
        onSelect({
          anchorEl: anchorRef.current,
          slotEl: event.currentTarget as HTMLElement,
        });
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onSelect({
            anchorEl: anchorRef.current,
            slotEl: event.currentTarget as HTMLElement,
          });
        }
      }}
      sx={{
        flex: 1,
        minWidth: 0,
        borderRadius: 0,
        border: 'none',
        backgroundColor: additive ? '#f7f7f7' : 'transparent',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'background-color 160ms ease, box-shadow 160ms ease',
        cursor: 'pointer',
        padding: 0,
        height: 44,
        boxShadow: 'none',
        backgroundImage: showHighlight
          ? 'linear-gradient(0deg, rgba(25,118,210,0.18), rgba(25,118,210,0.18))'
          : undefined,
        '&:focus-visible': {
          outline: 'none',
          backgroundImage: 'linear-gradient(0deg, rgba(25,118,210,0.24), rgba(25,118,210,0.24))',
        },
        '&:hover': {
          backgroundColor: additive ? '#ededed' : 'rgba(0,0,0,0.05)',
        },
      }}
      ref={(node) => {
        setNodeRef(node);
      }}
    >
      <Box
        ref={anchorRef}
        sx={{
          position: 'absolute',
          top: 0,
          left: '50%',
          width: 0,
          height: 0,
          transform: 'translateX(-50%)',
          pointerEvents: 'none',
        }}
      />
      {additive ? (
        <Typography
          variant="subtitle1"
          component="span"
          sx={{
            fontWeight: 600,
            fontSize: { xs: '0.95rem', sm: '1.05rem' },
            color: 'text.primary',
            letterSpacing: 0.4,
          }}
        >
          {additive.eNumber || additive.title}
        </Typography>
      ) : (
        <AddIcon sx={{ fontSize: 20, color: 'grey.600' }} />
      )}
    </ButtonBase>
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
