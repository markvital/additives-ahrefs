import functionsData from '../../data/functions.json';
import { normalizeFilterValue } from './text';

interface FunctionDataEntry {
  name: string;
  description?: string;
  usedAs?: string[];
}

interface FunctionsData {
  functions?: FunctionDataEntry[];
}

type FunctionInfo = {
  name: string;
  description: string | null;
  usedAs: string[];
};

const functionMap = new Map<string, FunctionInfo>();

const functionEntries = (functionsData as FunctionsData).functions ?? [];

functionEntries.forEach((entry) => {
  if (!entry?.name) {
    return;
  }

  const info: FunctionInfo = {
    name: entry.name,
    description: entry.description?.trim() ?? null,
    usedAs: Array.isArray(entry.usedAs)
      ? entry.usedAs
          .map((value) => value.trim().toLowerCase())
          .filter((value, index, list) => value.length > 0 && list.indexOf(value) === index)
      : [],
  };

  const primaryKey = normalizeFilterValue(entry.name);
  functionMap.set(primaryKey, info);

  info.usedAs.forEach((alias) => {
    const aliasKey = normalizeFilterValue(alias);

    if (!functionMap.has(aliasKey)) {
      functionMap.set(aliasKey, info);
    }
  });
});

export const getFunctionInfo = (value: string | null | undefined): FunctionInfo | null => {
  if (!value) {
    return null;
  }

  const key = normalizeFilterValue(value);

  return functionMap.get(key) ?? null;
};

export const formatUsedAsList = (values: string[]): string => {
  if (values.length === 0) {
    return '';
  }

  if (values.length === 1) {
    return values[0];
  }

  if (values.length === 2) {
    return `${values[0]} and ${values[1]}`;
  }

  const leading = values.slice(0, -1).join(', ');
  const last = values[values.length - 1];

  return `${leading}, and ${last}`;
};
