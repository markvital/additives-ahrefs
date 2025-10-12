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
          gap: 1.5,
          m: 0,
        }}
      >
        {items.map((item) => (
          <Box key={item.keyword} component="li" sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
            <Typography variant="body1" color="text.primary" sx={{ fontWeight: 600 }}>
              {item.keyword}
            </Typography>
            {item.hasAnswer && (
              <Typography variant="body1" color="text.secondary" component="p">
                {item.answer}
              </Typography>
            )}
          </Box>
        ))}
      </Box>
    </Box>
  );
}
