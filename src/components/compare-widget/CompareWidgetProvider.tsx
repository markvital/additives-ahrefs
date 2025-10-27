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
import {
  DndContext,
  PointerSensor,
  type DragEndEvent,
  type DragStartEvent,
  type DragCancelEvent,
  useSensor,
  useSensors,
} from '@dnd-kit/core';

import type { Additive } from '../../lib/additives';
import { CompareWidget } from './CompareWidget';

type CompareSlotKey = 'left' | 'right';

type SelectionState = Record<CompareSlotKey, Additive | null>;

interface CompareWidgetContextValue {
  additives: Additive[];
  selections: SelectionState;
  isExpanded: boolean;
  isVisible: boolean;
  isDragEnabled: boolean;
  activeDragId: string | null;
  showHint: boolean;
  openWidget: () => void;
  closeWidget: () => void;
  toggleWidget: () => void;
  dismissHint: () => void;
  selectSlot: (slot: CompareSlotKey, slug: string) => void;
  clearSlot: (slot: CompareSlotKey) => void;
  prefillFromSlug: (slug: string | null) => void;
}

const CompareWidgetContext = createContext<CompareWidgetContextValue | undefined>(undefined);

export const useCompareWidget = () => {
  const context = useContext(CompareWidgetContext);

  if (!context) {
    throw new Error('useCompareWidget must be used within a CompareWidgetProvider');
  }

  return context;
};

interface CompareWidgetProviderProps {
  additives: Additive[];
  children: ReactNode;
}

export function CompareWidgetProvider({ additives, children }: CompareWidgetProviderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [isExpanded, setIsExpanded] = useState(false);
  const [selections, setSelections] = useState<SelectionState>({ left: null, right: null });
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [hintEnabled, setHintEnabled] = useState(true);
  const [lastNavigatedPair, setLastNavigatedPair] = useState<string | null>(null);
  const additiveMap = useMemo(() => new Map(additives.map((item) => [item.slug, item])), [additives]);
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
  );

  const isVisible = useMemo(() => {
    if (!pathname) {
      return true;
    }

    return !pathname.startsWith('/compare');
  }, [pathname]);

  const isDragEnabled = isExpanded && isVisible;

  const selectSlot = useCallback(
    (slot: CompareSlotKey, slug: string) => {
      const additive = additiveMap.get(slug);

      if (!additive) {
        return;
      }

      setSelections((previous) => {
        const otherSlot: CompareSlotKey = slot === 'left' ? 'right' : 'left';
        const otherAdditive = previous[otherSlot];

        if (otherAdditive && otherAdditive.slug === additive.slug) {
          return previous;
        }

        if (previous[slot]?.slug === additive.slug) {
          return previous;
        }

        return {
          ...previous,
          [slot]: additive,
        };
      });
      setHintEnabled(false);
    },
    [additiveMap],
  );

  const clearSlot = useCallback((slot: CompareSlotKey) => {
    setSelections((previous) => ({
      ...previous,
      [slot]: null,
    }));
  }, []);

  const prefillFromSlug = useCallback(
    (slug: string | null) => {
      if (!slug) {
        return;
      }

      const additive = additiveMap.get(slug);

      if (!additive) {
        return;
      }

      setSelections((previous) => {
        const nextRight = previous.right && previous.right.slug === additive.slug ? null : previous.right;

        if (previous.left && previous.left.slug === additive.slug && nextRight === previous.right) {
          return previous;
        }

        return {
          left: additive,
          right: nextRight,
        };
      });
      setHintEnabled(false);
    },
    [additiveMap],
  );

  const openWidget = useCallback(() => {
    setIsExpanded(true);
  }, []);

  const closeWidget = useCallback(() => {
    setActiveDragId(null);
    setIsExpanded(false);
    setHintEnabled(false);
  }, []);

  const toggleWidget = useCallback(() => {
    setIsExpanded((value) => !value);
  }, []);

  const dismissHint = useCallback(() => {
    setHintEnabled(false);
  }, []);

  const showHint = Boolean(
    isExpanded &&
      hintEnabled &&
      !selections.left &&
      !selections.right &&
      !activeDragId &&
      isVisible,
  );

  const pairKey = useMemo(() => {
    if (!selections.left || !selections.right) {
      return null;
    }

    return `${selections.left.slug}-vs-${selections.right.slug}`;
  }, [selections.left, selections.right]);

  const pendingNavigationRef = useRef<string | null>(null);

  useEffect(() => {
    if (!pairKey) {
      pendingNavigationRef.current = null;
      setLastNavigatedPair(null);
      return;
    }

    const targetPath = `/compare/${pairKey}`;

    if (pathname === targetPath) {
      pendingNavigationRef.current = pairKey;
      setLastNavigatedPair(pairKey);
      return;
    }

    if (pendingNavigationRef.current === pairKey || lastNavigatedPair === pairKey) {
      return;
    }

    pendingNavigationRef.current = pairKey;
    router.push(targetPath);
    setLastNavigatedPair(pairKey);
  }, [pairKey, router, pathname, lastNavigatedPair]);

  useEffect(() => {
    if (!isVisible && isExpanded) {
      setIsExpanded(false);
    }
  }, [isVisible, isExpanded]);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    if (!isDragEnabled) {
      return;
    }

    setActiveDragId(String(event.active.id));
  }, [isDragEnabled]);

  const handleDragCancel = useCallback((_: DragCancelEvent) => {
    setActiveDragId(null);
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveDragId(null);

      if (!event.over) {
        return;
      }

      const { id } = event.over;

      if (id !== 'compare-slot-left' && id !== 'compare-slot-right') {
        return;
      }

      const slot: CompareSlotKey = id === 'compare-slot-left' ? 'left' : 'right';
      selectSlot(slot, String(event.active.id));
    },
    [selectSlot],
  );

  const contextValue = useMemo<CompareWidgetContextValue>(
    () => ({
      additives,
      selections,
      isExpanded,
      isVisible,
      isDragEnabled,
      activeDragId,
      showHint,
      openWidget,
      closeWidget,
      toggleWidget,
      dismissHint,
      selectSlot,
      clearSlot,
      prefillFromSlug,
    }),
    [
      additives,
      selections,
      isExpanded,
      isVisible,
      isDragEnabled,
      activeDragId,
      showHint,
      openWidget,
      closeWidget,
      toggleWidget,
      dismissHint,
      selectSlot,
      clearSlot,
      prefillFromSlug,
    ],
  );

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragCancel={handleDragCancel}
      onDragEnd={handleDragEnd}
    >
      <CompareWidgetContext.Provider value={contextValue}>
        {children}
        {isVisible ? <CompareWidget /> : null}
      </CompareWidgetContext.Provider>
    </DndContext>
  );
}
