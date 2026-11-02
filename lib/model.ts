import { z } from 'zod';
import { canonicalSubject } from './subjects';
export const confidence = z.enum([
  'sure',
  'unsure',
  'best_guess',
  'not_understood',
]);
export const setSchema = z.object({
  title: z.string().trim().min(1).max(150),
  subject: z.string().trim().min(1).max(80).transform(canonicalSubject),
  language: z.enum(['nl', 'tr', 'en']),
  description: z.string().max(1000).default(''),
  material: z.string().max(50000).default(''),
  questions: z
    .array(
      z
        .object({
          prompt: z.string().trim().min(1).max(3000),
          options: z.array(z.string().trim().min(1).max(1000)).min(2).max(6),
          correctIndex: z.number().int().min(0),
          explanation: z.string().max(5000).default(''),
        })
        .refine(
          (q) => q.correctIndex < q.options.length,
          'correctIndex must refer to an option',
        ),
    )
    .min(1)
    .max(100),
});
export type StudySet = z.infer<typeof setSchema> & {
  id: string;
  createdAt: string;
  sample?: boolean;
};
export type PublicSet = Omit<StudySet, 'questions'> & {
  questions: { prompt: string; options: string[] }[];
};
export const answerSchema = z.object({
  option: z.number().int().min(0).nullable(),
  confidence,
});
export const attemptSchema = z.object({
  setId: z.string().uuid(),
  answers: z.array(answerSchema).min(1).max(100),
});
export type Answer = z.infer<typeof answerSchema>;
export type Attempt = {
  id: string;
  setId: string;
  title: string;
  subject: string;
  createdAt: string;
  answers: (Answer & {
    prompt: string;
    selected: string | null;
    correctAnswer: string;
    correct: boolean;
    explanation: string;
  })[];
  correct: number;
  total: number;
};
export function grade(set: StudySet, answers: Answer[]): Attempt {
  if (answers.length !== set.questions.length)
    throw new Error('Answer every question');
  const scored = answers.map((a, i) => {
    const q = set.questions[i];
    if (
      a.option !== null &&
      (a.option < 0 ||
        a.option >= q.options.length ||
        !Number.isInteger(a.option))
    )
      throw new Error('Invalid option');
    if (a.option === null && a.confidence !== 'not_understood')
      throw new Error('Choose an answer or mark not understood');
    return {
      ...a,
      prompt: q.prompt,
      selected: a.option === null ? null : q.options[a.option],
      correctAnswer: q.options[q.correctIndex],
      correct: a.option === q.correctIndex,
      explanation: q.explanation,
    };
  });
  return {
    id: crypto.randomUUID(),
    setId: set.id,
    title: set.title,
    subject: set.subject,
    createdAt: new Date().toISOString(),
    answers: scored,
    correct: scored.filter((a) => a.correct).length,
    total: scored.length,
  };
}
export function publicSet(set: StudySet): PublicSet {
  return {
    ...set,
    questions: set.questions.map((q) => ({
      prompt: q.prompt,
      options: q.options,
    })),
  };
}
