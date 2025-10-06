import { Box, Typography } from '@mui/material';

import type { SearchQuestionItem } from '../lib/search-questions';

interface SearchQuestionsProps {
  questions: SearchQuestionItem[];
}

export function SearchQuestions({ questions }: SearchQuestionsProps) {
  const items = questions
    .map((question) => question.keyword.trim())
    .filter((keyword, index, list) => keyword.length > 0 && list.indexOf(keyword) === index)
    .slice(0, 5);

  if (items.length === 0) {
    return null;
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <Typography component="h2" variant="h3" sx={{ fontWeight: 600 }}>
        Popular Questions?
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
