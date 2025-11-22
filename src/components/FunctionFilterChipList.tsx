import NextLink from 'next/link';
import { Chip, Stack, type StackProps } from '@mui/material';

import { formatFunctionLabel } from '../lib/additive-format';
import { createFilterSlug, mergeChipStackSx, uniqueStrings } from '../lib/chip-list';

type FunctionFilterChipListProps = Omit<StackProps, 'children' | 'direction' | 'spacing'> & {
  functions: string[];
  chipVariant?: 'outlined' | 'filled';
  chipSize?: 'small' | 'medium';
};

export function FunctionFilterChipList({
  functions,
  chipVariant = 'outlined',
  chipSize = 'medium',
  sx,
  ...stackProps
}: FunctionFilterChipListProps) {
  const uniqueFunctions = uniqueStrings(functions);

  if (uniqueFunctions.length === 0) {
    return null;
  }

  const combinedSx = mergeChipStackSx(sx);

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
