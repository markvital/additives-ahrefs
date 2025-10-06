import { Box, Typography } from '@mui/material';

import type { SearchQuestionItem } from '../lib/search-questions';

interface SearchQuestionsProps {
  questions: SearchQuestionItem[];
}

export function SearchQuestions({ questions }: SearchQuestionsProps) {
  const formatQuestion = (raw: string) => {
    const trimmed = raw.trim();

    if (!trimmed) {
      return '';
    }

    const capitalized = `${trimmed.charAt(0).toUpperCase()}${trimmed.slice(1)}`;
    const hasQuestionMark = /[?？]\s*$/.test(capitalized);

    return hasQuestionMark ? capitalized : `${capitalized}?`;
  };

  const items = questions
    .map((question) => question.keyword.trim())
    .filter((keyword, index, list) => keyword.length > 0 && list.indexOf(keyword) === index)
    .map(formatQuestion)
    .filter((keyword): keyword is string => keyword.length > 0)
    .slice(0, 5);

  if (items.length === 0) {
    return null;
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <Typography component="h2" variant="h4" sx={{ fontWeight: 600 }}>
        Popular Questions
      </Typography>

      <Box
        component="ol"
        sx={{
          listStyle: 'decimal',
          pl: 3,
          display: 'flex',
          flexDirection: 'column',
          gap: 0.75,
          m: 0,
        }}
      >
        {items.map((keyword) => (
          <Box key={keyword} component="li">
            <Typography variant="body1" color="text.primary">
              {keyword}
            </Typography>
          </Box>
        ))}
      </Box>
    </Box>
  );
}
