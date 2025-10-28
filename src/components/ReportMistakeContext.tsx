'use client';

import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

interface ReportMistakeContextValue {
  name: string | null;
  setName: (value: string | null) => void;
}

const ReportMistakeContext = createContext<ReportMistakeContextValue>({
  name: null,
  setName: () => {},
});

interface ReportMistakeProviderProps {
  children: ReactNode;
}

export function ReportMistakeProvider({ children }: ReportMistakeProviderProps) {
  const [name, setNameState] = useState<string | null>(null);

  const setName = useCallback((value: string | null) => {
    const trimmed = typeof value === 'string' ? value.trim() : '';
    setNameState(trimmed.length > 0 ? trimmed : null);
  }, []);

  const contextValue = useMemo(
    () => ({
      name,
      setName,
    }),
    [name, setName],
  );

  return <ReportMistakeContext.Provider value={contextValue}>{children}</ReportMistakeContext.Provider>;
}

export const useReportMistake = () => useContext(ReportMistakeContext);

interface ReportMistakeNameProps {
  value: string | null;
}

export function ReportMistakeName({ value }: ReportMistakeNameProps) {
  const { setName } = useReportMistake();

  useEffect(() => {
    setName(value);

    return () => {
      setName(null);
    };
  }, [setName, value]);

  return null;
}
