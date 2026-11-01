# Arinova

A private family learning space: study notes, tablet-friendly multiple-choice practices, and a parent dashboard that records correctness **and** confidence. Dutch is the default UI language, with Turkish and English throughout. Content retains its author’s language; changing the UI language does not translate school material.

## Run locally

Requires Node.js 22+ and npm.

```sh
npm ci
npm run dev
```

With no login or database configuration, this is an explicitly labelled **local demo**, with the parent interface enabled and data retained in ignored `.data/store.json`. It is a single-process development store, not shared/cloud storage. The included Dutch language practice is sample content, not imported schoolwork. No external AI API is called, and there are no analytics or trackers.

```sh
npm test
npm run typecheck
npm run build
npm run test:e2e # requires Chromium; set CHROMIUM_PATH if needed
```

For database integration tests, run a disposable local PostgreSQL instance and pass `TEST_DATABASE_URL` to `npm test`. The suite verifies saved sets/results, login throttling, and row-level security under anonymous-role grants. `TEST_DATABASE_URL` also enables PostgreSQL in `npm run test:e2e`; use a **separate empty local database** for that browser run. Both runners reject non-local test database URLs. Without `TEST_DATABASE_URL`, unit tests report the PostgreSQL integration test as skipped and browser tests use a temporary local file store.

For production-mode local testing, supply the same variables as Vercel and a PostgreSQL database, then `npm run build && npm start`. No production demo bypass exists.

## Deploy to Vercel

1. Import the GitHub repository into Vercel with framework **Next.js** and Node.js **24.x**. Repository root is the project root. The checked-in `vercel.json` explicitly selects the Next.js framework, `npm ci`, `npm run build`, and `.next` output, overriding an incorrect `public` output setting. Leave the root directory as `./`; do not configure a static export.
2. Add a managed PostgreSQL database (for example Supabase or Neon through Vercel Marketplace). The Supabase integration’s `POSTGRES_URL` works automatically, or set a pooled connection string as `DATABASE_URL` (which takes precedence). Both storage and login throttling use that connection; preserve the provider’s TLS verification settings. The app creates `arinova_records` and `arinova_login_limits` on first use. The database user must own the application tables and have table creation permission. Tables are created with row-level security enabled in the same transaction: the owner connection can use them, while Supabase’s anonymous/authenticated API roles have no access policies. Browser code does not use Supabase API keys.
3. Configure these **server-only** environment variables in Vercel:
   - `DATABASE_URL` or `POSTGRES_URL`: PostgreSQL connection URL (one is sufficient).
   - `PARENT_PASSWORD`: a strong unique parent password.
   - `LEARNER_PASSWORD`: a separate learner password.
   - `SESSION_SECRET`: at least 32 random characters (`openssl rand -hex 32`).
   - `IMPORT_API_TOKEN`: a different random token of at least 32 characters; needed only for API imports.
4. Deploy. Sign in as Arin to finish the sample practice, then as Parent to verify that the result and confidence appear. This verifies database persistence as well as deployment.

Passwords and keys go in Vercel settings, never Git, browser code, or chat. Parent login can import material and see all attempts; learner login can study and submit attempts. Signed, HttpOnly, SameSite cookies expire after one day. Answer keys are removed from learner set responses and grading happens on the server. This version supports **one family and one learner**. Login attempts are rate-limited in PostgreSQL. Rotate SESSION_SECRET to invalidate existing sessions. The import token authorizes creating sets only.

## Add study material

In the parent’s **Add material** tab, download the example JSON, or upload/paste a JSON study set. A set contains a study text and 1–100 questions. Every question has 2–6 options, a zero-based correctIndex, and an optional explanation. The interface accepts up to 500 KB per upload.

```json
{
  "title": "Zelfstandige naamwoorden",
  "subject": "Taal",
  "language": "nl",
  "description": "Oefenen met mensen, dieren en dingen.",
  "material": "Een zelfstandig naamwoord is een woord voor een mens, dier, ding of plaats.\n\nVoorbeeld: het boek.",
  "questions": [
    {
      "prompt": "Welk woord is een zelfstandig naamwoord?",
      "options": ["Boek", "Rennen", "Snel"],
      "correctIndex": 0,
      "explanation": "Een boek is een ding. Je kunt zeggen: het boek."
    }
  ]
}
```

Supported content languages: `nl`, `tr`, `en`. All content is rendered as plain text, never executed as HTML. Study notes can also be printed from the study view.

### API

The authenticated ingestion endpoint allows a future assistant integration to add prepared questions directly. Keep the bearer token server-side. It does not connect this chat automatically to your website: an authenticated integration/action must be configured separately once a deployed URL exists.

```sh
curl --fail-with-body "$ARINOVA_URL/api/sets" \
  -H "Authorization: Bearer $IMPORT_API_TOKEN" \
  -H 'Content-Type: application/json' \
  --data-binary @study-set.json
```

- `POST /api/sets`: parent cookie or import token; returns `{ "id": "…" }`, status 201.
- `GET /api/sets`: signed-in parent/learner; learner response omits answer keys.
- `POST /api/attempts`: signed-in parent/learner; body `{ "setId": "…", "answers": [{ "option": 0, "confidence": "sure" }] }`. Submit one entry per question, in order. Options are zero-based; `null` is allowed only with `not_understood`.
- Confidence values: `sure`, `unsure`, `best_guess`, `not_understood`.
- `GET /api/progress`: parent only; complete attempt history including per-question feedback.

Correctness and confidence are independent: a guessed correct answer remains a learning signal. Unanswered questions count separately from incorrect choices. The dashboard includes repeated attempts and records timestamps; it is not a claim of mastery.

## Current scope and next steps

This is a first working version. Screenshots/PDFs from school can be shared in chat to prepare reviewed study-set JSON, then imported. Existing ChatGPT projects cannot be read automatically from this repository. Direct photo/PDF storage, automatic OCR/question generation, free-text answers, multiple learner profiles, content editing/deletion, and spaced repetition are future work. Do not treat the sample as age- or curriculum-specific school material.

A database backup/export policy should be configured with the database provider before retaining important learning history. Production deployment and a real cross-device check require a Vercel project and database credentials; a local build does not establish those capabilities.
