'use client';

import { useEffect } from 'react';

import { useCompareWidget } from './CompareWidgetProvider';

interface CompareWidgetInitializerProps {
  additiveSlug: string;
}

export function CompareWidgetInitializer({ additiveSlug }: CompareWidgetInitializerProps) {
  const { prefillFromSlug } = useCompareWidget();

  useEffect(() => {
    if (!additiveSlug) {
      return;
    }

    prefillFromSlug(additiveSlug);
  }, [additiveSlug, prefillFromSlug]);

  return null;
}
