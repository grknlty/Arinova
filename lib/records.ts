import type { Pool, PoolClient } from 'pg';
import type { Attempt, StudySet } from './model';
import type { Role } from './auth';

type Client = Pool | PoolClient;

// Relational tables for study content and answers. A test (one toets) groups
// its questions; every answer row points at the question and the chosen option,
// so mistakes can be queried per question.
export const schema = `
  CREATE TABLE IF NOT EXISTS public.arinova_groups (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL UNIQUE,
    created_at timestamptz NOT NULL DEFAULT now()
  );
  CREATE TABLE IF NOT EXISTS public.arinova_subjects (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    subject_name text NOT NULL UNIQUE,
    group_id uuid REFERENCES public.arinova_groups(id),
    created_at timestamptz NOT NULL DEFAULT now()
  );
  CREATE TABLE IF NOT EXISTS public.arinova_users (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    user_name text NOT NULL UNIQUE,
    role text NOT NULL UNIQUE CHECK (role IN ('parent', 'learner')),
    group_id uuid REFERENCES public.arinova_groups(id),
    created_at timestamptz NOT NULL DEFAULT now()
  );
  CREATE TABLE IF NOT EXISTS public.arinova_tests (
    id uuid PRIMARY KEY,
    subject_id uuid NOT NULL REFERENCES public.arinova_subjects(id),
    title text NOT NULL,
    description text NOT NULL DEFAULT '',
    material text NOT NULL DEFAULT '',
    language text NOT NULL CHECK (language IN ('nl', 'tr', 'en')),
    is_sample boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now()
  );
  CREATE TABLE IF NOT EXISTS public.arinova_questions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    subject_id uuid NOT NULL REFERENCES public.arinova_subjects(id),
    test_id uuid NOT NULL REFERENCES public.arinova_tests(id) ON DELETE CASCADE,
    position integer NOT NULL,
    question_text text NOT NULL,
    explanation text NOT NULL DEFAULT '',
    answer_count integer NOT NULL DEFAULT 1,
    UNIQUE (test_id, position)
  );
  CREATE TABLE IF NOT EXISTS public.arinova_options (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    question_id uuid NOT NULL REFERENCES public.arinova_questions(id) ON DELETE CASCADE,
    position integer NOT NULL,
    option_text text NOT NULL,
    is_answer boolean NOT NULL DEFAULT false,
    UNIQUE (question_id, position)
  );
  CREATE TABLE IF NOT EXISTS public.arinova_attempts (
    id uuid PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES public.arinova_users(id),
    test_id uuid NOT NULL REFERENCES public.arinova_tests(id) ON DELETE CASCADE,
    correct integer NOT NULL,
    total integer NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
  );
  CREATE TABLE IF NOT EXISTS public.arinova_user_question_answers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    attempt_id uuid NOT NULL REFERENCES public.arinova_attempts(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES public.arinova_users(id),
    question_id uuid NOT NULL REFERENCES public.arinova_questions(id) ON DELETE CASCADE,
    options_id uuid REFERENCES public.arinova_options(id),
    is_correct boolean NOT NULL,
    confidence text NOT NULL,
    answered_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (attempt_id, question_id)
  );
  CREATE INDEX IF NOT EXISTS arinova_answers_question
    ON public.arinova_user_question_answers (question_id, is_correct);
  CREATE INDEX IF NOT EXISTS arinova_attempts_user
    ON public.arinova_attempts (user_id, created_at DESC);
`;

export const tables = [
  'arinova_groups',
  'arinova_subjects',
  'arinova_users',
  'arinova_tests',
  'arinova_questions',
  'arinova_options',
  'arinova_attempts',
  'arinova_user_question_answers',
];

// One family with one learner: both sign-in roles get a user row.
export async function seedUsers(client: Client) {
  const group = await client.query(
    `INSERT INTO public.arinova_groups (name) VALUES ($1)
     ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id`,
    [process.env.LEARNER_GROUP || 'Groep 7–8'],
  );
  await client.query(
    `INSERT INTO public.arinova_users (name, user_name, role, group_id)
     VALUES ('Ouder', 'parent', 'parent', NULL), ($1, 'learner', 'learner', $2)
     ON CONFLICT (role) DO NOTHING`,
    [process.env.LEARNER_NAME || 'Arin', group.rows[0].id],
  );
}

export async function insertSet(client: Client, set: StudySet) {
  const subject = await client.query(
    `INSERT INTO public.arinova_subjects (subject_name, group_id)
     VALUES ($1, (SELECT group_id FROM public.arinova_users WHERE role = 'learner'))
     ON CONFLICT (subject_name) DO UPDATE SET subject_name = EXCLUDED.subject_name
     RETURNING id`,
    [set.subject],
  );
  const subjectId = subject.rows[0].id;
  const test = await client.query(
    `INSERT INTO public.arinova_tests
       (id, subject_id, title, description, material, language, is_sample, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (id) DO NOTHING`,
    [
      set.id,
      subjectId,
      set.title,
      set.description,
      set.material,
      set.language,
      !!set.sample,
      set.createdAt,
    ],
  );
  if (!test.rowCount) return;
  const questions = await client.query(
    `INSERT INTO public.arinova_questions
       (subject_id, test_id, position, question_text, explanation, answer_count)
     SELECT $1, $2, q.position, q.text, q.explanation, 1
     FROM jsonb_to_recordset($3) AS q(position integer, text text, explanation text)
     RETURNING id, position`,
    [
      subjectId,
      set.id,
      JSON.stringify(
        set.questions.map((q, position) => ({
          position,
          text: q.prompt,
          explanation: q.explanation,
        })),
      ),
    ],
  );
  const ids = new Map(questions.rows.map((r) => [r.position, r.id]));
  await client.query(
    `INSERT INTO public.arinova_options (question_id, position, option_text, is_answer)
     SELECT o.question_id, o.position, o.text, o.is_answer
     FROM jsonb_to_recordset($1) AS o(question_id uuid, position integer, text text, is_answer boolean)`,
    [
      JSON.stringify(
        set.questions.flatMap((q, i) =>
          q.options.map((text, position) => ({
            question_id: ids.get(i),
            position,
            text,
            is_answer: position === q.correctIndex,
          })),
        ),
      ),
    ],
  );
}

export async function insertAttempt(
  client: Client,
  attempt: Attempt,
  role: Role,
) {
  const user = await client.query(
    'SELECT id FROM public.arinova_users WHERE role = $1',
    [role],
  );
  const userId = user.rows[0].id;
  const created = await client.query(
    `INSERT INTO public.arinova_attempts (id, user_id, test_id, correct, total, created_at)
     VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (id) DO NOTHING`,
    [
      attempt.id,
      userId,
      attempt.setId,
      attempt.correct,
      attempt.total,
      attempt.createdAt,
    ],
  );
  if (!created.rowCount) return;
  await client.query(
    `INSERT INTO public.arinova_user_question_answers
       (attempt_id, user_id, question_id, options_id, is_correct, confidence, answered_at)
     SELECT $1, $2, q.id, o.id, a.correct, a.confidence, $4
     FROM jsonb_to_recordset($3) AS a(position integer, option integer, correct boolean, confidence text)
     JOIN public.arinova_questions q ON q.test_id = $5 AND q.position = a.position
     LEFT JOIN public.arinova_options o ON o.question_id = q.id AND o.position = a.option`,
    [
      attempt.id,
      userId,
      JSON.stringify(
        attempt.answers.map((a, position) => ({
          position,
          option: a.option,
          correct: a.correct,
          confidence: a.confidence,
        })),
      ),
      attempt.createdAt,
      attempt.setId,
    ],
  );
}

export async function readSets(client: Client): Promise<StudySet[]> {
  const result = await client.query(`
    SELECT t.id, t.title, s.subject_name AS subject, t.language, t.description,
      t.material, t.is_sample, t.created_at,
      COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'prompt', q.question_text,
          'explanation', q.explanation,
          'options', (SELECT jsonb_agg(o.option_text ORDER BY o.position)
                      FROM public.arinova_options o WHERE o.question_id = q.id),
          'correctIndex', (SELECT min(o.position)
                           FROM public.arinova_options o
                           WHERE o.question_id = q.id AND o.is_answer)
        ) ORDER BY q.position)
        FROM public.arinova_questions q WHERE q.test_id = t.id
      ), '[]') AS questions
    FROM public.arinova_tests t
    JOIN public.arinova_subjects s ON s.id = t.subject_id
    ORDER BY t.created_at DESC
  `);
  return result.rows.map((r) => ({
    id: r.id,
    title: r.title,
    subject: r.subject,
    language: r.language,
    description: r.description,
    material: r.material,
    questions: r.questions,
    createdAt: r.created_at.toISOString(),
    ...(r.is_sample ? { sample: true } : {}),
  }));
}

export async function readAttempts(client: Client): Promise<Attempt[]> {
  const result = await client.query(`
    SELECT a.id, a.test_id, t.title, s.subject_name AS subject, a.created_at,
      a.correct, a.total,
      COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'option', o.position,
          'confidence', x.confidence,
          'prompt', q.question_text,
          'selected', o.option_text,
          'correctAnswer', (SELECT c.option_text FROM public.arinova_options c
                            WHERE c.question_id = q.id AND c.is_answer
                            ORDER BY c.position LIMIT 1),
          'correct', x.is_correct,
          'explanation', q.explanation
        ) ORDER BY q.position)
        FROM public.arinova_user_question_answers x
        JOIN public.arinova_questions q ON q.id = x.question_id
        LEFT JOIN public.arinova_options o ON o.id = x.options_id
        WHERE x.attempt_id = a.id
      ), '[]') AS answers
    FROM public.arinova_attempts a
    JOIN public.arinova_tests t ON t.id = a.test_id
    JOIN public.arinova_subjects s ON s.id = t.subject_id
    ORDER BY a.created_at DESC
  `);
  return result.rows.map((r) => ({
    id: r.id,
    setId: r.test_id,
    title: r.title,
    subject: r.subject,
    createdAt: r.created_at.toISOString(),
    answers: r.answers,
    correct: r.correct,
    total: r.total,
  }));
}
