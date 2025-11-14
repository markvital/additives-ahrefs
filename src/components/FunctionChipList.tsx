import NextLink from 'next/link';
import { Chip, Stack, type StackProps } from '@mui/material';
import type { SxProps, Theme } from '@mui/material/styles';

import { formatFunctionLabel } from '../lib/additive-format';

const createFilterSlug = (value: string): string | null => {
  const slug = value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

  return slug.length > 0 ? slug : null;
};

type StackStyle = SxProps<Theme>;

interface FunctionChipListProps extends Omit<StackProps, 'children' | 'direction' | 'spacing'> {
  functions: string[];
  chipVariant?: 'outlined' | 'filled';
  chipSize?: 'small' | 'medium';
}

export function FunctionChipList({
  functions,
  chipVariant = 'outlined',
  chipSize = 'medium',
  sx,
  ...stackProps
}: FunctionChipListProps) {
  const uniqueFunctions = functions.filter((value, index, list) => list.indexOf(value) === index);

  if (uniqueFunctions.length === 0) {
    return null;
  }

  const combinedSx: StackStyle = Array.isArray(sx)
    ? [{ flexWrap: 'wrap' }, ...sx]
    : typeof sx === 'function'
      ? (theme) => ({ flexWrap: 'wrap', ...sx(theme) })
      : { flexWrap: 'wrap', ...(sx ?? {}) };

  return (
    <Stack direction="row" spacing={1} alignItems="center" {...stackProps} sx={combinedSx}>
      {uniqueFunctions.map((fn) => {
        const slug = createFilterSlug(fn);
        const label = formatFunctionLabel(fn);
        const commonProps = {
          label,
          variant: chipVariant,
          size: chipSize,
          sx: { textTransform: 'none' as const },
        } as const;

        if (!slug) {
          return <Chip key={fn} {...commonProps} />;
        }

        return (
          <Chip
            key={fn}
            {...commonProps}
            component={NextLink}
            href={`/function/${slug}`}
            clickable
          />
        );
      })}
    </Stack>
  );
}
