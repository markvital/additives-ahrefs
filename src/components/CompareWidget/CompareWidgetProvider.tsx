'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useRouter, usePathname } from 'next/navigation';
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
  type DragCancelEvent,
} from '@dnd-kit/core';

import type { Additive } from '../../lib/additives';
import type { CompareWidgetAdditive, SlotIndex } from './types';
import { CompareWidget } from './CompareWidget';

interface CompareWidgetProviderProps {
  children: ReactNode;
  additives: Additive[];
}

interface CompareWidgetContextValue {
  isExpanded: boolean;
  setExpanded: (value: boolean) => void;
  selection: [CompareWidgetAdditive | null, CompareWidgetAdditive | null];
  setSelection: (
    updater:
      | [CompareWidgetAdditive | null, CompareWidgetAdditive | null]
      | ((prev: [CompareWidgetAdditive | null, CompareWidgetAdditive | null]) => [
          CompareWidgetAdditive | null,
          CompareWidgetAdditive | null,
        ]),
  ) => void;
  requestSlotSelector: (index: SlotIndex) => void;
  isHintVisible: boolean;
  dismissHint: () => void;
  activeDrag: CompareWidgetAdditive | null;
  additiveMap: Map<string, CompareWidgetAdditive>;
}

const CompareWidgetContext = createContext<CompareWidgetContextValue | null>(null);

export const useCompareWidgetContext = () => {
  const context = useContext(CompareWidgetContext);

  if (!context) {
    throw new Error('useCompareWidgetContext must be used within CompareWidgetProvider');
  }

  return context;
};

export function CompareWidgetProvider({ children, additives }: CompareWidgetProviderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const compareAdditives = useMemo(
    () => additives.map<CompareWidgetAdditive>(({ slug, eNumber, title }) => ({ slug, eNumber, title })),
    [additives],
  );
  const additiveMap = useMemo(() => new Map(compareAdditives.map((item) => [item.slug, item])), [compareAdditives]);
  const [isExpanded, setIsExpanded] = useState(false);
  const [selection, setSelection] = useState<[
    CompareWidgetAdditive | null,
    CompareWidgetAdditive | null,
  ]>([null, null]);
  const [selectorState, setSelectorState] = useState<{ open: boolean; slot: SlotIndex } | null>(null);
  const [isHintVisible, setIsHintVisible] = useState(false);
  const [activeDrag, setActiveDrag] = useState<CompareWidgetAdditive | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
  );

  const maybeNavigateToCompare = useCallback(
    (nextSelection: [CompareWidgetAdditive | null, CompareWidgetAdditive | null]) => {
      const [first, second] = nextSelection;

      if (first && second) {
        router.push(`/compare/${first.slug}-vs-${second.slug}`);
      }
    },
    [router],
  );

  const handleSelectionUpdate = useCallback(
    (index: SlotIndex, additive: CompareWidgetAdditive | null) => {
      setSelection((prev) => {
        const next: [CompareWidgetAdditive | null, CompareWidgetAdditive | null] = [...prev];
        next[index] = additive;

        if (additive && prev[1 - index]?.slug === additive.slug) {
          next[1 - index] = null;
        }

        setIsHintVisible(false);
        maybeNavigateToCompare(next);

        return next;
      });
    },
    [maybeNavigateToCompare],
  );

  const requestSlotSelector = useCallback((index: SlotIndex) => {
    setSelectorState({ open: true, slot: index });
  }, []);

  const dismissHint = useCallback(() => {
    setIsHintVisible(false);
  }, []);

  useEffect(() => {
    if (isExpanded && !selection[0] && !selection[1]) {
      setIsHintVisible(true);
    }
  }, [isExpanded, selection]);

  useEffect(() => {
    if (!pathname) {
      return;
    }

    const trimmed = pathname.replace(/\?.*$/, '').replace(/\/$/, '');
    const segments = trimmed.split('/').filter(Boolean);

    if (segments.length === 1) {
      const detailSlug = segments[0];
      const additive = additiveMap.get(detailSlug);

      if (additive) {
        setSelection((prev) => {
          if (prev[0]?.slug === additive.slug && prev[1]?.slug !== additive.slug) {
            return prev;
          }

          const next: [CompareWidgetAdditive | null, CompareWidgetAdditive | null] = [additive, prev[1]];

          if (prev[1]?.slug === additive.slug) {
            next[1] = null;
          }

          return next;
        });
        return;
      }
    }
  }, [additiveMap, pathname]);

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const additive = event.active.data.current?.additive as CompareWidgetAdditive | undefined;

      if (additive) {
        setActiveDrag(additive);
      }
    },
    [],
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const additive = event.active.data.current?.additive as CompareWidgetAdditive | undefined;

      setActiveDrag(null);

      if (!additive) {
        return;
      }

      const targetId = event.over?.id;

      if (targetId === 'compare-slot-0' || targetId === 'compare-slot-1') {
        const slotIndex = targetId === 'compare-slot-0' ? 0 : 1;
        handleSelectionUpdate(slotIndex, additive);
      }
    },
    [handleSelectionUpdate],
  );

  const handleDragCancel = useCallback((_: DragCancelEvent) => {
    setActiveDrag(null);
  }, []);

  const contextValue = useMemo<CompareWidgetContextValue>(
    () => ({
      isExpanded,
      setExpanded: setIsExpanded,
      selection,
      setSelection,
      requestSlotSelector,
      isHintVisible,
      dismissHint,
      activeDrag,
      additiveMap,
    }),
    [isExpanded, selection, requestSlotSelector, isHintVisible, dismissHint, activeDrag, additiveMap],
  );

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <CompareWidgetContext.Provider value={contextValue}>
        {children}
        <CompareWidget
          selectorState={selectorState}
          onSelectorClose={() => setSelectorState(null)}
          onSlotSelect={handleSelectionUpdate}
          lookupAdditives={additives}
        />
      </CompareWidgetContext.Provider>
    </DndContext>
  );
}
