import { Box, Typography } from '@mui/material';

import type { SearchQuestionItem } from '../lib/search-questions';
import { AhrefsAttributionTooltip } from './AhrefsAttributionTooltip';

interface SearchQuestionsProps {
  questions: SearchQuestionItem[];
  variant?: 'default' | 'plain';
  spacing?: { mobile?: number; desktop?: number };
}

export function SearchQuestions({
  questions,
  variant = 'default',
  spacing,
}: SearchQuestionsProps) {
  const formatQuestion = (raw: string) => {
    const trimmed = raw.trim();

    if (!trimmed) {
      return '';
    }

    const capitalized = `${trimmed.charAt(0).toUpperCase()}${trimmed.slice(1)}`;
    const hasQuestionMark = /[?？]\s*$/.test(capitalized);

    return hasQuestionMark ? capitalized : `${capitalized}?`;
  };

  const formatted = questions
    .map((question) => {
      const keyword = typeof question.keyword === 'string' ? question.keyword : '';
      const answer = typeof question.answer === 'string' ? question.answer.trim() : '';
      const formattedQuestion = formatQuestion(keyword);

      if (!formattedQuestion) {
        return null;
      }

      return {
        keyword: formattedQuestion,
        answer,
        hasAnswer: answer.length > 0,
      };
    })
    .filter((entry): entry is { keyword: string; answer: string; hasAnswer: boolean } => entry !== null)
    .filter((entry, index, list) => list.findIndex((item) => item.keyword.toLowerCase() === entry.keyword.toLowerCase()) === index);

  const answeredItems = formatted.filter((entry) => entry.hasAnswer).slice(0, 5);
  const fallbackItems = formatted.slice(0, 5);
  const items = answeredItems.length > 0 ? answeredItems : fallbackItems;

  if (items.length === 0) {
    return null;
  }

  const showHeading = variant === 'default';
  const showAttribution = variant === 'default';
  const containerSpacing = showAttribution ? 1.5 : 1;

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: containerSpacing,
        '& > *:last-child': {
          mb: 0,
        },
      }}
    >
      <Box
        sx={{
          backgroundColor: showHeading ? '#ebebeb' : 'transparent',
          p: showHeading ? 2 : 0,
          borderRadius: showHeading ? 1 : 0,
        }}
      >
        {showHeading ? (
          <Typography component="h2" variant="h4" sx={{ fontWeight: 600, mb: 1.5 }}>
            Popular Questions
          </Typography>
        ) : null}

        <Box
          component="ol"
          sx={{
            listStyleType: 'decimal',
            listStylePosition: 'outside',
            pl: showHeading ? 3 : 2,
            m: 0,
            '& > li:not(:last-of-type)': {
              mb: {
                xs: spacing?.mobile ?? 2,
                sm: spacing?.desktop ?? 1.5,
              },
            },
          }}
        >
          {items.map((item) => (
            <Box key={item.keyword} component="li">
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                <Typography variant="body1" color="text.primary" sx={{ fontWeight: 600 }}>
                  {item.keyword}
                </Typography>
                {item.hasAnswer && (
                  <Typography variant="body1" color="text.secondary" component="p">
                    {item.answer}
                  </Typography>
                )}
              </Box>
            </Box>
          ))}
        </Box>
      </Box>

      {showAttribution ? (
        <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.875rem' }}>
          Top questions that users ask about this topic based on <AhrefsAttributionTooltip /> data
        </Typography>
      ) : null}
    </Box>
  );
}
