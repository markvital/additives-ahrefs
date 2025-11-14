'use client';

import { useEffect } from 'react';

import { useCompareFlap } from './CompareFlap';

export function HideCompareFlap() {
  const { setWidgetHidden } = useCompareFlap();

  useEffect(() => {
    setWidgetHidden(true);

    return () => {
      setWidgetHidden(false);
    };
  }, [setWidgetHidden]);

  return null;
}
