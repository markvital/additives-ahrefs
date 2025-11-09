'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Avatar, Box, Card, CardActionArea, CardContent, Stack, Tooltip, Typography } from '@mui/material';

import type { AdditiveGridItem } from '../lib/additives';
import { formatOriginLabel } from '../lib/additive-format';
import { getOriginAbbreviation, getOriginIcon } from '../lib/origin-icons';
import { FunctionChipList } from './FunctionChipList';
import { AwarenessScoreChip } from './AwarenessScoreChip';
import type { AwarenessScoreResult } from '../lib/awareness';

interface FeaturedCardProps {
  additive: AdditiveGridItem;
  awarenessScore: AwarenessScoreResult | null | undefined;
}

export function FeaturedCard({ additive, awarenessScore }: FeaturedCardProps) {
  const origins = additive.origin.filter((origin) => origin.trim().length > 0);
  const normalizedTitle = additive.title.replace(/\s+/g, ' ').trim();

  return (
    <Card
      sx={{
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#ffffff',
        borderRadius: '24px',
        width: '70%',
      }}
    >
      <CardActionArea
        component={Link}
        href={`/${additive.slug}`}
        sx={{
          flexGrow: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'stretch',
          height: '100%',
        }}
      >
        <CardContent
          sx={{
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            width: '100%',
            boxSizing: 'border-box',
            px: 2,
            pt: 1.4,
            pb: 2,
            '&:last-child': { pb: 2 },
          }}
        >
          <Stack spacing={0.5}>
            {/* Row 1: E-number, origins, awareness score */}
            <Box display="flex" justifyContent="space-between" alignItems="center">
              <Typography
                variant="overline"
                color="text.secondary"
                letterSpacing={1.2}
                sx={{ fontSize: '0.875rem', fontWeight: 600 }}
              >
                {additive.eNumber}
              </Typography>

              <Stack direction="row" spacing={0.75} alignItems="center" sx={{ flex: 1, justifyContent: 'center' }}>
                {origins.map((origin) => {
                  const icon = getOriginIcon(origin);
                  const abbreviation = getOriginAbbreviation(origin);
                  const label = formatOriginLabel(origin);

                  return (
                    <Tooltip key={origin} title={label} arrow>
                      <Avatar
                        variant="circular"
                        sx={{
                          width: 28,
                          height: 28,
                          bgcolor: 'grey.100',
                          color: 'text.primary',
                          fontSize: 12,
                          fontWeight: 600,
                          p: 0.5,
                        }}
                      >
                        {icon ? (
                          <Image
                            src={icon}
                            alt={`${label} origin icon`}
                            width={20}
                            height={20}
                            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                          />
                        ) : (
                          abbreviation
                        )}
                      </Avatar>
                    </Tooltip>
                  );
                })}
              </Stack>

              <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                {awarenessScore ? (
                  <AwarenessScoreChip score={awarenessScore} labelStyle="grid" />
                ) : (
                  <Box sx={{ width: 24, height: 24 }} />
                )}
              </Box>
            </Box>

            {/* Row 2: Additive name */}
            <Typography
              component="h3"
              variant="h2"
              sx={{
                fontSize: '1.5rem',
                fontWeight: 700,
                lineHeight: 1.2,
                textAlign: 'left',
              }}
            >
              {normalizedTitle}
            </Typography>

            {/* Row 3: Function pills */}
            <Box display="flex" justifyContent="flex-start" alignItems="center">
              {additive.functions.length > 0 ? (
                <FunctionChipList functions={additive.functions} sx={{ maxWidth: '100%' }} />
              ) : (
                <Box sx={{ minHeight: 28 }} />
              )}
            </Box>
          </Stack>
        </CardContent>
      </CardActionArea>
    </Card>
  );
}
