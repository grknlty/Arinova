'use client';
import { useEffect, useState } from 'react';
import {
  BookOpen,
  Sprout,
  ArrowRight,
  ArrowLeft,
  Check,
  CircleHelp,
  Compass,
  BarChart3,
  Plus,
  LogOut,
  Upload,
  Sun,
  Sparkles,
  Printer,
  Eye,
  EyeOff,
} from 'lucide-react';
import { words, type Language } from '@/lib/i18n';
import { sample } from '@/lib/sample';
import type { StudySet, PublicSet, Answer, Attempt } from '@/lib/model';
type View = 'library' | 'progress' | 'manage' | 'study' | 'quiz' | 'result';
const feelings = ['sure', 'unsure', 'best_guess', 'not_understood'] as const;
class ApiError extends Error {
  constructor(
    public code: string,
    public diagnostic?: string,
  ) {
    super(code);
  }
}
async function api(url: string, data?: unknown) {
  const r = await fetch(
    url,
    data === undefined
      ? {}
      : {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        },
  );
  if (!r.ok) {
    const payload = await r.json().catch(() => null);
    throw new ApiError(
      typeof payload?.code === 'string' ? payload.code : 'REQUEST_FAILED',
      typeof payload?.diagnostic === 'string' ? payload.diagnostic : undefined,
    );
  }
  return r.json();
}
export default function Home() {
  const [lang, setLang] = useState<Language>('nl');
  const t = words[lang];
  const [session, setSession] = useState<{
    role: 'parent' | 'learner' | null;
    demo: boolean;
  } | null>(null);
  const [view, setView] = useState<View>('library');
  const [sets, setSets] = useState<(StudySet | PublicSet)[]>([]);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [selected, setSelected] = useState<StudySet | PublicSet | null>(null);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [index, setIndex] = useState(0);
  const [result, setResult] = useState<Attempt | null>(null);
  const [subject, setSubject] = useState('all');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loginRole, setLoginRole] = useState('learner');
  const [json, setJson] = useState('');
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const l = localStorage.getItem('arinova-language');
    if (l === 'nl' || l === 'en' || l === 'tr') setLang(l);
    api('/api/session')
      .then(setSession)
      .catch(() => setError(words.nl.error));
  }, []);
  useEffect(() => {
    document.documentElement.lang = lang;
    localStorage.setItem('arinova-language', lang);
  }, [lang]);
  async function load() {
    setLoading(true);
    try {
      setSets(await api('/api/sets'));
      if (session?.role === 'parent') setAttempts(await api('/api/progress'));
    } catch {
      setError(t.error);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    if (session?.role) void load();
  }, [session]); // eslint-disable-line react-hooks/exhaustive-deps
  function navigate(v: View) {
    setView(v);
    setError('');
    setSaved(false);
    window.scrollTo(0, 0);
  }
  function start(s: StudySet | PublicSet) {
    setSelected(s);
    setAnswers(s.questions.map(() => ({ option: null, confidence: 'sure' })));
    setMarked({});
    setIndex(0);
    navigate('quiz');
  }
  const [marked, setMarked] = useState<Record<number, boolean>>({});
  function updateAnswer(patch: Partial<Answer>) {
    setAnswers((a) => a.map((v, i) => (i === index ? { ...v, ...patch } : v)));
  }
  async function finish() {
    setBusy(true);
    setError('');
    try {
      const r = await api('/api/attempts', { setId: selected!.id, answers });
      setResult(r);
      navigate('result');
      await load();
    } catch {
      setError(t.notSaved);
    } finally {
      setBusy(false);
    }
  }
  async function login(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api('/api/auth', { role: loginRole, password });
      setPassword('');
      setShowPassword(false);
      setSession(await api('/api/session'));
    } catch (error) {
      const code = error instanceof ApiError ? error.code : 'REQUEST_FAILED';
      const messages: Record<string, string> = {
        AUTH_INVALID_CREDENTIALS: t.loginError,
        AUTH_PASSWORD_NOT_CONFIGURED: t.loginPasswordSetupError,
        AUTH_SESSION_NOT_CONFIGURED: t.loginSessionSetupError,
        AUTH_DATABASE_UNAVAILABLE: t.loginDatabaseError,
        AUTH_RATE_LIMITED: t.loginRateError,
        AUTH_ORIGIN_REJECTED: t.loginRefreshError,
      };
      const diagnostics = [
        'database_credentials',
        'database_permissions',
        'database_name',
        'database_network',
        'database_certificate',
        'database_connection',
      ];
      const detail =
        error instanceof ApiError &&
        error.diagnostic &&
        diagnostics.includes(error.diagnostic)
          ? ` (${error.diagnostic})`
          : '';
      setError((messages[code] ?? t.loginUnavailableError) + detail);
    } finally {
      setBusy(false);
    }
  }
  const languagePicker = (
    <label className="language">
      <span className="sr-only">{t.language}</span>
      <select
        aria-label={t.language}
        value={lang}
        onChange={(e) => setLang(e.target.value as Language)}
      >
        <option value="nl">NL · Nederlands</option>
        <option value="tr">TR · Türkçe</option>
        <option value="en">EN · English</option>
      </select>
    </label>
  );
  if (!session?.role)
    return (
      <main className="login-page">
        <div className="login-language">{languagePicker}</div>
        <form className="login-card" onSubmit={login}>
          <div className="brand">
            <span className="brand-icon">
              <Sprout />
            </span>
            arinova<span className="brand-dot">.</span>
          </div>
          <h1>{t.login}</h1>
          <p>{t.loginText}</p>
          {session ? (
            <>
              <div className="role-switch">
                {(['learner', 'parent'] as const).map((r) => (
                  <button
                    type="button"
                    className={loginRole === r ? 'active' : ''}
                    key={r}
                    onClick={() => setLoginRole(r)}
                  >
                    {t[r]}
                  </button>
                ))}
              </div>
              <label htmlFor="login-password" className="password-label">
                {t.password}
              </label>
              <div className="password-field">
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  className="password-toggle"
                  aria-label={showPassword ? t.hidePassword : t.showPassword}
                  aria-pressed={showPassword}
                  aria-controls="login-password"
                  title={showPassword ? t.hidePassword : t.showPassword}
                  onClick={() => setShowPassword((shown) => !shown)}
                >
                  {showPassword ? (
                    <EyeOff size={20} aria-hidden="true" />
                  ) : (
                    <Eye size={20} aria-hidden="true" />
                  )}
                </button>
              </div>
              <button className="button primary" disabled={busy}>
                {t.signin}
                <ArrowRight size={18} />
              </button>
            </>
          ) : (
            <div className="loading">
              <Sprout />
            </div>
          )}
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
        </form>
      </main>
    );
  const back = (
    <button className="back" onClick={() => navigate('library')}>
      <ArrowLeft size={16} />
      {t.back}
    </button>
  );
  const allAnswers = attempts.flatMap((a) => a.answers);
  const total = allAnswers.length;
  const correct = allAnswers.filter((a) => a.correct).length;
  const wrong = allAnswers.filter(
    (a) => !a.correct && a.option !== null,
  ).length;
  const uncertain = allAnswers.filter(
    (a) => a.confidence !== 'sure' || !a.correct,
  ).length;
  return (
    <div className="app">
      <header className="header">
        <button
          className="brand"
          onClick={() => navigate('library')}
          aria-label="Arinova"
        >
          <span className="brand-icon">
            <Sprout />
          </span>
          arinova<span className="brand-dot">.</span>
        </button>
        <nav aria-label={t.library}>
          <button
            className={
              ['library', 'study', 'quiz', 'result'].includes(view)
                ? 'active'
                : ''
            }
            onClick={() => navigate('library')}
          >
            <BookOpen size={18} />
            {t.library}
          </button>
          {session.role === 'parent' && (
            <>
              <button
                className={view === 'progress' ? 'active' : ''}
                onClick={() => navigate('progress')}
              >
                <BarChart3 size={18} />
                {t.progress}
              </button>
              <button
                className={view === 'manage' ? 'active' : ''}
                onClick={() => navigate('manage')}
              >
                <Plus size={18} />
                {t.manage}
              </button>
            </>
          )}
        </nav>
        <div className="header-right">
          {languagePicker}
          <span className="avatar">A</span>
          {!session.demo && (
            <button
              className="icon-button"
              aria-label={t.logout}
              onClick={async () => {
                await fetch('/api/auth', { method: 'DELETE' });
                setSession({ role: null, demo: false });
                setLoginRole('learner');
                setShowPassword(false);
                setAttempts([]);
                setSets([]);
                navigate('library');
              }}
            >
              <LogOut size={18} />
            </button>
          )}
        </div>
      </header>
      {session.demo && <div className="demo-banner">{t.demo}</div>}
      <main className="main">
        {error && (
          <div className="error" role="alert">
            {error}
            <button
              onClick={() => {
                setError('');
                void load();
              }}
            >
              ↻
            </button>
          </div>
        )}
        {view === 'library' && (
          <>
            <section className="hero">
              <div className="hero-copy">
                <span className="eyebrow">
                  <span className="tiny-dot" />
                  {t.eyebrow}
                </span>
                <h1>{t.welcome}</h1>
                <p>{t.intro}</p>
                <div className="hero-foot">
                  <span className="sun-badge">
                    <Sun size={18} />
                  </span>
                  {t.tip}
                </div>
              </div>
              <div className="hero-art" aria-hidden="true">
                <div className="orbit orbit-one" />
                <div className="orbit orbit-two" />
                <span className="star star-one">✦</span>
                <span className="star star-two">✦</span>
                <div className="art-book">
                  <BookOpen strokeWidth={1.2} />
                  <span>abc</span>
                </div>
                <div className="art-sprout">
                  <Sprout />
                </div>
                <span className="art-label">{t.tagline}</span>
              </div>
            </section>
            <div className="section-heading">
              <div>
                <span className="eyebrow muted">{t.learning}</span>
                <h2>
                  {t.library}
                  <span className="count">{sets.length}</span>
                </h2>
              </div>
              <span className="small-note">{t.tagline}</span>
            </div>
            <div className="filters">
              {['all', ...new Set(sets.map((s) => s.subject))].map((s) => (
                <button
                  key={s}
                  className={subject === s ? 'selected' : ''}
                  onClick={() => setSubject(s)}
                >
                  {s === 'all' ? t.all : s}
                </button>
              ))}
            </div>
            <div className="cards">
              {sets
                .filter((s) => subject === 'all' || s.subject === subject)
                .map((s, i) => (
                  <article className="study-card" key={s.id}>
                    <div className={`card-art art-${i % 3}`}>
                      <span className="subject-label">{s.subject}</span>
                      <BookOpen size={72} strokeWidth={1} />
                      <span className="card-art-letter">
                        {s.language === 'nl'
                          ? 'Aa'
                          : s.language === 'tr'
                            ? 'Çç'
                            : 'Ab'}
                      </span>
                      <span className="art-spark">✦</span>
                    </div>
                    <div className="card-body">
                      <div className="card-meta">
                        <span>{t[s.language]}</span>
                        <span>·</span>
                        <span>
                          {s.questions.length} {t.questions}
                        </span>
                      </div>
                      <h3>{s.title}</h3>
                      <p>{s.description}</p>
                      {s.sample && (
                        <span className="sample-label">{t.sample}</span>
                      )}
                      <div className="card-actions">
                        <button
                          className="button secondary"
                          onClick={() => {
                            setSelected(s);
                            navigate('study');
                          }}
                        >
                          {t.study}
                        </button>
                        <button
                          className="button primary"
                          onClick={() => start(s)}
                        >
                          {t.practice}
                          <ArrowRight size={16} />
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              {!loading && !sets.length && <p>{t.empty}</p>}
            </div>
            <p className="content-note">{t.contentNote}</p>
            <aside className="encouragement">
              <span className="encouragement-icon">
                <Sparkles />
              </span>
              <div>
                <h3>{t.ready}</h3>
                <p>{t.readyText}</p>
              </div>
              <span aria-hidden="true">✦</span>
            </aside>
          </>
        )}
        {view === 'study' && selected && (
          <>
            {back}
            <section className="paper">
              <span className="eyebrow">
                {selected.subject} · {t[selected.language]}
              </span>
              <h1>{selected.title}</h1>
              <span className="pill">
                <BookOpen size={16} />
                {t.material}
              </span>
              <div className="material">
                {selected.material || t.noMaterial}
              </div>
              <div className="paper-actions">
                <button
                  className="button secondary"
                  onClick={() => window.print()}
                >
                  <Printer size={16} />
                  {t.print}
                </button>
                <button
                  className="button primary"
                  onClick={() => start(selected)}
                >
                  {t.practice}
                  <ArrowRight size={18} />
                </button>
              </div>
            </section>
          </>
        )}
        {view === 'quiz' && selected && (
          <>
            {back}
            <div className="quiz-top">
              <span>{selected.title}</span>
              <strong>
                {t.question} {index + 1} {t.of} {selected.questions.length}
              </strong>
            </div>
            <div className="progress-track">
              <span
                style={{
                  width: `${((index + 1) / selected.questions.length) * 100}%`,
                }}
              />
            </div>
            <section className="paper quiz" key={index}>
              <span className="eyebrow">{selected.subject}</span>
              <h1>{selected.questions[index].prompt}</h1>
              <div className="options">
                {selected.questions[index].options.map((o, i) => (
                  <button
                    aria-pressed={answers[index].option === i}
                    className={answers[index].option === i ? 'chosen' : ''}
                    key={i}
                    onClick={() => updateAnswer({ option: i })}
                  >
                    <span className="option-letter">{'ABCDEF'[i]}</span>
                    {o}
                    {answers[index].option === i && <Check size={20} />}
                  </button>
                ))}
              </div>
              <fieldset className="feelings">
                <legend>{t.how}</legend>
                {feelings.map((f, i) => (
                  <button
                    type="button"
                    key={f}
                    aria-pressed={
                      (marked[index] && answers[index].confidence === f) ||
                      false
                    }
                    className={
                      marked[index] && answers[index].confidence === f
                        ? 'selected'
                        : ''
                    }
                    onClick={() => {
                      setMarked((m) => ({ ...m, [index]: true }));
                      updateAnswer({ confidence: f });
                    }}
                  >
                    <span>{['☀', '◒', '◇', '?'][i]}</span>
                    {t[f]}
                  </button>
                ))}
              </fieldset>
              <div className="quiz-bottom">
                <button
                  className="button secondary"
                  disabled={!index || busy}
                  onClick={() => setIndex((i) => i - 1)}
                >
                  {t.previous}
                </button>
                <button
                  className="button primary"
                  disabled={
                    busy ||
                    !marked[index] ||
                    (answers[index].option === null &&
                      answers[index].confidence !== 'not_understood')
                  }
                  onClick={() =>
                    index < selected.questions.length - 1
                      ? setIndex((i) => i + 1)
                      : void finish()
                  }
                >
                  {busy
                    ? t.submitting
                    : index === selected.questions.length - 1
                      ? t.finish
                      : t.next}
                  <ArrowRight size={18} />
                </button>
              </div>
            </section>
          </>
        )}
        {view === 'result' && result && (
          <>
            {back}
            <section className="result-hero">
              <span className="result-icon">
                <Sprout size={42} />
              </span>
              <h1>{t.result}</h1>
              <p>{t.resultText}</p>
              <div className="score">
                {result.correct}
                <span> / {result.total}</span>
              </div>
              <p>{t.correct}</p>
              <button
                className="button primary"
                onClick={() => selected && start(selected)}
              >
                {t.retry}
                <ArrowRight size={18} />
              </button>
            </section>
            <Review attempt={result} lang={lang} />
          </>
        )}
        {view === 'progress' && (
          <>
            <span className="eyebrow muted">{t.overview}</span>
            <h1>{t.dashboard}</h1>
            <p className="page-intro">{t.dashboardText}</p>
            <div className="stat-grid">
              <div>
                <span>{t.attempts}</span>
                <strong>{attempts.length}</strong>
                <BookOpen />
              </div>
              <div>
                <span>{t.accuracy}</span>
                <strong>
                  {total ? Math.round((correct / total) * 100) : 0}
                  <small>%</small>
                </strong>
                <Check />
              </div>
              <div>
                <span>{t.help}</span>
                <strong>{uncertain}</strong>
                <CircleHelp />
              </div>
            </div>
            <div className="breakdown">
              <span className="good">
                {correct} {t.correct}
              </span>
              <span className="bad">
                {wrong} {t.wrong}
              </span>
              <span>
                {total - correct - wrong} {t.unanswered}
              </span>
            </div>
            <p className="content-note">{t.progressNote}</p>
            <h2>{t.confidence}</h2>
            <div className="confidence-grid">
              {feelings.map((feeling, i) => {
                const group = allAnswers.filter(
                  (a) => a.confidence === feeling,
                );
                return (
                  <div key={feeling}>
                    <span className="feeling-symbol">
                      {['☀', '◒', '◇', '?'][i]}
                    </span>
                    <span>{t[feeling]}</span>
                    <strong>{group.length}</strong>
                    <small>
                      {group.filter((a) => a.correct).length}{' '}
                      {t.correct.toLowerCase()}
                    </small>
                  </div>
                );
              })}
            </div>
            <h2>{t.recent}</h2>
            {attempts.length ? (
              attempts.map((a) => (
                <details className="attempt" key={a.id}>
                  <summary>
                    <span className="attempt-icon">
                      <BookOpen size={20} />
                    </span>
                    <span>
                      <strong>{a.title}</strong>
                      <small>
                        {new Date(a.createdAt).toLocaleString(lang, {
                          timeZone: 'Europe/Amsterdam',
                          dateStyle: 'medium',
                          timeStyle: 'short',
                        })}
                      </small>
                    </span>
                    <span className="attempt-score">
                      {a.correct}/{a.total}
                    </span>
                  </summary>
                  <Review attempt={a} lang={lang} />
                </details>
              ))
            ) : (
              <div className="empty">
                <Compass size={40} />
                <h3>{t.noAttempts}</h3>
                <p>{t.noAttemptsText}</p>
              </div>
            )}
          </>
        )}
        {view === 'manage' && (
          <>
            <span className="eyebrow muted">{t.manage}</span>
            <h1>{t.importTitle}</h1>
            <p className="page-intro">{t.importText}</p>
            <section className="paper import">
              <div className="import-actions">
                <label className="button secondary">
                  <Upload size={18} />
                  {t.upload}
                  <input
                    type="file"
                    accept="application/json,.json"
                    className="sr-only"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      if (file.size > 500000) {
                        setError(t.importError);
                        return;
                      }
                      setJson(await file.text());
                      setSaved(false);
                    }}
                  />
                </label>
                <button
                  className="text-button"
                  onClick={() => {
                    const { id, createdAt, sample: example, ...s } = sample;
                    void id;
                    void createdAt;
                    void example;
                    const url = URL.createObjectURL(
                      new Blob([JSON.stringify(s, null, 2)], {
                        type: 'application/json',
                      }),
                    );
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = 'arinova-example.json';
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                >
                  {t.format} ↓
                </button>
              </div>
              <label className="json-label">
                JSON
                <textarea
                  spellCheck={false}
                  value={json}
                  onChange={(e) => {
                    setJson(e.target.value);
                    setSaved(false);
                  }}
                  placeholder={
                    '{\n  "title": "…",\n  "subject": "Taal",\n  "language": "nl",\n  "material": "…",\n  "questions": […]\n}'
                  }
                />
              </label>
              <button
                disabled={busy || !json.trim()}
                className="button primary"
                onClick={async () => {
                  setBusy(true);
                  setError('');
                  setSaved(false);
                  try {
                    await api('/api/sets', JSON.parse(json));
                    setJson('');
                    await load();
                    setSaved(true);
                  } catch {
                    setError(t.importError);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <Plus size={18} />
                {busy ? t.submitting : t.save}
              </button>
              {saved && (
                <p role="status" className="success">
                  <Check size={18} />
                  {t.saved}
                </p>
              )}
            </section>
          </>
        )}
      </main>
      <footer>
        <div className="brand small">
          <Sprout size={20} /> arinova.
        </div>
        <span>{t.tagline}</span>
        <span>NL · TR · EN</span>
      </footer>
    </div>
  );
}
function Review({ attempt, lang }: { attempt: Attempt; lang: Language }) {
  const t = words[lang];
  return (
    <div className="review">
      {attempt.answers.map((a, i) => (
        <article className="review-card" key={i}>
          <div className="review-heading">
            <span
              className={`pill ${a.correct ? 'good' : a.option === null ? '' : 'bad'}`}
            >
              {a.correct
                ? t.correct
                : a.option === null
                  ? t.unanswered
                  : t.wrong}
            </span>
            <span className="confidence-label">{t[a.confidence]}</span>
          </div>
          <h3>
            {i + 1}. {a.prompt}
          </h3>
          <p>
            {t.yourAnswer}: <strong>{a.selected ?? t.skipped}</strong>
          </p>
          {!a.correct && (
            <p>
              {t.rightAnswer}: <strong>{a.correctAnswer}</strong>
            </p>
          )}
          {a.explanation && <p className="explanation">{a.explanation}</p>}
          {a.correct && a.confidence !== 'sure' && (
            <span className="review-note">{t.guessedCorrect}</span>
          )}
        </article>
      ))}
    </div>
  );
}
