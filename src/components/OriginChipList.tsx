import Image from 'next/image';
import NextLink from 'next/link';
import { Box, Chip, Stack, Tooltip, type StackProps } from '@mui/material';

import { formatOriginLabel } from '../lib/additive-format';
import { createFilterSlug, mergeChipStackSx, uniqueStrings } from '../lib/chip-list';
import { getOriginIcon, getOriginAbbreviation } from '../lib/origin-icons';
import { getOriginDescriptionBySlug, getOriginDescriptionByValue } from '../lib/origins';

type OriginChipListProps = Omit<StackProps, 'children' | 'direction' | 'spacing'> & {
  origins: string[];
  chipVariant?: 'outlined' | 'filled';
  chipSize?: 'small' | 'medium';
};

export function OriginChipList({
  origins,
  chipVariant = 'outlined',
  chipSize = 'medium',
  sx,
  ...stackProps
}: OriginChipListProps) {
  const uniqueOrigins = uniqueStrings(origins);

  if (uniqueOrigins.length === 0) {
    return null;
  }

  const combinedSx = mergeChipStackSx(sx);

  return (
    <Stack direction="row" spacing={1} alignItems="center" {...stackProps} sx={combinedSx}>
      {uniqueOrigins.map((origin) => {
        const originSlug = createFilterSlug(origin);
        const label = formatOriginLabel(origin);
        const icon = getOriginIcon(origin);
        const abbreviation = getOriginAbbreviation(origin);
        const description =
          (originSlug ? getOriginDescriptionBySlug(originSlug) : null) ??
          getOriginDescriptionByValue(origin);
        const tooltipTitle = description ?? '';
        const tooltipProps = description
          ? {}
          : {
              disableFocusListener: true,
              disableHoverListener: true,
              disableTouchListener: true,
            };
        const chipLabel = (
          <Stack direction="row" spacing={0.75} alignItems="center">
            <Box
              component="span"
              aria-hidden="true"
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 18,
                height: 18,
              }}
            >
              {icon ? (
                <Image
                  src={icon}
                  alt={`${label} flag`}
                  width={16}
                  height={16}
                  style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                />
              ) : (
                <Box component="span" sx={{ fontSize: 12, fontWeight: 600, lineHeight: 1 }}>
                  {abbreviation}
                </Box>
              )}
            </Box>
            <Box component="span" sx={{ lineHeight: 1 }}>
              {label}
            </Box>
          </Stack>
        );

        const commonProps = {
          label: chipLabel,
          variant: chipVariant,
          size: chipSize,
          sx: { px: 1 },
        } as const;

        if (!originSlug) {
          return (
            <Tooltip key={origin} title={tooltipTitle} arrow enterTouchDelay={0} leaveTouchDelay={1500} {...tooltipProps}>
              <Chip {...commonProps} />
            </Tooltip>
          );
        }

        return (
          <Tooltip key={origin} title={tooltipTitle} arrow enterTouchDelay={0} leaveTouchDelay={1500} {...tooltipProps}>
            <Chip
              {...commonProps}
              component={NextLink}
              href={`/origin/${originSlug}`}
              clickable
            />
          </Tooltip>
        );
      })}
    </Stack>
  );
}
