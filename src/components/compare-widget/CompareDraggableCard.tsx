'use client';

import { type CSSProperties, type ReactNode } from 'react';
import { useDraggable } from '@dnd-kit/core';

import type { Additive } from '../../lib/additives';
import { useCompareWidget } from './CompareWidgetProvider';

interface CompareDraggableCardProps {
  additive: Additive;
  children: ReactNode;
}

export function CompareDraggableCard({ additive, children }: CompareDraggableCardProps) {
  const { isDragEnabled } = useCompareWidget();
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: additive.slug,
    data: { slug: additive.slug },
    disabled: !isDragEnabled,
  });

  const dragStyle: CSSProperties | undefined = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
      }
    : undefined;

  const eventListeners = isDragEnabled ? listeners : undefined;

  return (
    <div
      ref={setNodeRef}
      style={{
        ...dragStyle,
        cursor: isDragEnabled ? 'grab' : undefined,
        touchAction: isDragEnabled ? 'none' : undefined,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        opacity: isDragging ? 0.92 : 1,
        transition: isDragEnabled ? undefined : 'opacity 0.2s ease',
      }}
      {...attributes}
      {...(eventListeners ?? {})}
    >
      {children}
    </div>
  );
}
