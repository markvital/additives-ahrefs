import { Box, Typography } from '@mui/material';

import type { QuestionAnswerItem } from '../lib/questions-answers';
import type { SearchQuestionItem } from '../lib/search-questions';

interface SearchQuestionsProps {
  questions: SearchQuestionItem[];
  answers?: QuestionAnswerItem[];
}

export function SearchQuestions({ questions, answers }: SearchQuestionsProps) {
  const formatQuestion = (raw: string) => {
    const trimmed = raw.trim();

    if (!trimmed) {
      return '';
    }

    const capitalized = `${trimmed.charAt(0).toUpperCase()}${trimmed.slice(1)}`;
    const hasQuestionMark = /[?？]\s*$/.test(capitalized);

    return hasQuestionMark ? capitalized : `${capitalized}?`;
  };

  const fallbackItems = questions
    .map((question) => question.keyword.trim())
    .filter((keyword, index, list) => keyword.length > 0 && list.indexOf(keyword) === index)
    .map(formatQuestion)
    .filter((keyword): keyword is string => keyword.length > 0)
    .slice(0, 5);

  const answerItems = Array.isArray(answers)
    ? answers
        .map((entry) => ({
          question: formatQuestion(entry.question),
          answer: entry.answer.trim(),
        }))
        .filter((entry) => entry.question.length > 0 && entry.answer.length > 0)
        .slice(0, 5)
    : [];

  if (answerItems.length === 0 && fallbackItems.length === 0) {
    return null;
  }

  if (answerItems.length > 0) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        <Typography component="h2" variant="h4" sx={{ fontWeight: 600 }}>
          Popular Questions
        </Typography>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {answerItems.map((item) => (
            <Box
              key={item.question}
              component="details"
              sx={{
                borderRadius: 1,
                border: '1px solid',
                borderColor: 'divider',
                p: 1.5,
                backgroundColor: 'transparent',
              }}
            >
              <Typography
                component="summary"
                variant="body1"
                sx={{ fontWeight: 600, cursor: 'pointer', outline: 'none' }}
              >
                {item.question}
              </Typography>

              <Typography variant="body1" color="text.secondary" sx={{ mt: 1 }}>
                {item.answer}
              </Typography>
            </Box>
          ))}
        </Box>
      </Box>
    );
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
        {fallbackItems.map((keyword) => (
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
