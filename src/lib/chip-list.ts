import type { SxProps, Theme } from '@mui/material/styles';

type StackStyle = SxProps<Theme>;

export const createFilterSlug = (value: string): string | null => {
  const slug = value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

  return slug.length > 0 ? slug : null;
};

export const uniqueStrings = (values: readonly string[]): string[] => {
  const seen = new Set<string>();

  return values.filter((value) => {
    if (seen.has(value)) {
      return false;
    }

    seen.add(value);

    return true;
  });
};

export const mergeChipStackSx = (sx: StackStyle | undefined): StackStyle => {
  if (Array.isArray(sx)) {
    return [{ flexWrap: 'wrap' }, ...sx];
  }

  if (typeof sx === 'function') {
    return (theme) => ({ flexWrap: 'wrap', ...sx(theme) });
  }

  return { flexWrap: 'wrap', ...(sx ?? {}) };
};
