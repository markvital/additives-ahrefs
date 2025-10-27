'use client';

import { useMemo } from 'react';
import { useDraggable } from '@dnd-kit/core';

import type { CompareWidgetAdditive } from './types';
import { useCompareWidgetContext } from './CompareWidgetProvider';

export function useCompareDraggable(additive: CompareWidgetAdditive) {
  const { isExpanded } = useCompareWidgetContext();
  const draggable = useDraggable({
    id: `compare-card-${additive.slug}`,
    data: { additive },
    disabled: !isExpanded,
  });

  const style = useMemo(() => {
    if (!draggable.transform) {
      return undefined;
    }

    const { x, y } = draggable.transform;

    return {
      transform: `translate3d(${x}px, ${y}px, 0)`,
    } as const;
  }, [draggable.transform]);

  return {
    ...draggable,
    style,
    isEnabled: isExpanded,
  };
}
