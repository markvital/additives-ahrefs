'use client';

import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

interface AdditiveLegendContextValue {
  isOpen: boolean;
  openLegend: () => void;
  closeLegend: () => void;
  toggleLegend: () => void;
}

const AdditiveLegendContext = createContext<AdditiveLegendContextValue | null>(null);

interface AdditiveLegendProviderProps {
  children: ReactNode;
}

export function AdditiveLegendProvider({ children }: AdditiveLegendProviderProps) {
  const [isOpen, setIsOpen] = useState(false);

  const openLegend = useCallback(() => {
    setIsOpen(true);
  }, []);

  const closeLegend = useCallback(() => {
    setIsOpen(false);
  }, []);

  const toggleLegend = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  const contextValue = useMemo<AdditiveLegendContextValue>(
    () => ({
      isOpen,
      openLegend,
      closeLegend,
      toggleLegend,
    }),
    [closeLegend, isOpen, openLegend, toggleLegend],
  );

  return <AdditiveLegendContext.Provider value={contextValue}>{children}</AdditiveLegendContext.Provider>;
}

export const useAdditiveLegend = () => {
  const context = useContext(AdditiveLegendContext);

  if (!context) {
    throw new Error('useAdditiveLegend must be used within an AdditiveLegendProvider.');
  }

  return context;
};
