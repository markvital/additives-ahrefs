export interface QuestionFilterOptions {
  keywords?: readonly string[];
}

export function shouldExcludeQuestion(question: string, options?: QuestionFilterOptions): boolean;
