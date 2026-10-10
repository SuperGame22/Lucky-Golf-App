/** Beta survey questions. The allowed keys and answers are enforced in the database (answer_beta_survey). */
export interface SurveyQuestion {
  key: string;
  text: string;
  options: { value: string; label: string }[];
}

export const SURVEY_QUESTIONS: SurveyQuestion[] = [
  {
    key: 'prize_style',
    text: 'Would you rather have bigger prizes every month, or weekly drawings with smaller prizes?',
    options: [
      { value: 'monthly_bigger', label: 'Bigger prizes monthly' },
      { value: 'weekly_smaller', label: 'Smaller prizes weekly' },
    ],
  },
];

/** The first question this player has not answered yet, or null when they are done. */
export function nextQuestion(answeredKeys: string[], questions: SurveyQuestion[] = SURVEY_QUESTIONS): SurveyQuestion | null {
  return questions.find((q) => !answeredKeys.includes(q.key)) ?? null;
}

export const SURVEY_LABELS: Record<string, string> = Object.fromEntries(
  SURVEY_QUESTIONS.flatMap((q) => q.options.map((o) => [`${q.key}:${o.value}`, o.label])),
);
