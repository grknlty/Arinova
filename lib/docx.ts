import { inflateRawSync } from 'node:zlib';
import { findSubject } from './subjects';

// Reads tests from a Word file laid out like a school toets:
//
//   Verkeer toets 1  Kennis           <- title (Title/Heading style)
//   1. Question text?
//   A. Option   B. Option ...
//   Antwoorden toets 1                <- answer key heading
//   1. B  Optional explanation
//
// A question can also give its answer directly with "Antwoord: B".
// The result is a draft for the parent to check before saving.

export type DraftSet = {
  title: string;
  subject: string;
  language: 'nl' | 'tr' | 'en';
  description: string;
  material: string;
  questions: {
    prompt: string;
    options: string[];
    correctIndex: number;
    explanation: string;
  }[];
};

const maxXml = 20_000_000;

function zipEntry(zip: Buffer, name: string) {
  // The central directory ends with a 22-byte record (plus an optional comment).
  let end = zip.length - 22;
  while (end >= 0 && zip.readUInt32LE(end) !== 0x06054b50) end--;
  if (end < 0) throw new Error('Not a Word (.docx) file');
  const count = zip.readUInt16LE(end + 10);
  let at = zip.readUInt32LE(end + 16);
  for (let i = 0; i < count; i++) {
    if (zip.readUInt32LE(at) !== 0x02014b50) break;
    const method = zip.readUInt16LE(at + 10);
    const size = zip.readUInt32LE(at + 20);
    const nameLength = zip.readUInt16LE(at + 28);
    const extra = zip.readUInt16LE(at + 30);
    const comment = zip.readUInt16LE(at + 32);
    const local = zip.readUInt32LE(at + 42);
    if (zip.toString('utf8', at + 46, at + 46 + nameLength) === name) {
      const start =
        local +
        30 +
        zip.readUInt16LE(local + 26) +
        zip.readUInt16LE(local + 28);
      const data = zip.subarray(start, start + size);
      if (method === 0) return data;
      if (method === 8)
        return inflateRawSync(data, { maxOutputLength: maxXml });
      throw new Error('Unsupported compression');
    }
    at += 46 + nameLength + extra + comment;
  }
  throw new Error('Not a Word (.docx) file');
}

function decode(text: string) {
  return text
    .replace(/&#x([0-9a-f]+);/gi, (_, h) =>
      String.fromCodePoint(parseInt(h, 16)),
    )
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

export type Line = { text: string; heading: boolean };

// Paragraphs in document order (table cells included), split on line breaks.
export function docxLines(file: Buffer): Line[] {
  const xml = zipEntry(file, 'word/document.xml').toString('utf8');
  const lines: Line[] = [];
  for (const [p] of xml.matchAll(/<w:p[ >][\s\S]*?<\/w:p>/g)) {
    const heading = /<w:pStyle w:val="(Title|Heading\d)"/.test(p);
    const runs =
      p.match(
        /<w:t(?: [^>]*)?>[^<]*<\/w:t>|<w:(?:br|cr)\b[^>]*\/>|<w:tab\/>/g,
      ) ?? [];
    const joined = runs
      .map((r) =>
        r.startsWith('<w:t')
          ? decode(r.replace(/<[^>]+>/g, ''))
          : r === '<w:tab/>'
            ? ' '
            : '\n',
      )
      .join('');
    for (const line of joined.split('\n')) {
      const clean = line.replace(/\s+/g, ' ').trim();
      if (clean) lines.push({ text: clean, heading });
    }
  }
  return lines;
}

const questionLine = /^(\d{1,3})[.)]\s+(.+)$/;
const optionLine = /^([A-Fa-f])[.)]\s+(.+)$/;
const answerKeyHeading =
  /^(antwoorden|antwoordblad|answers?( key)?|cevap(lar| anahtarı)?)\b/i;
const keyLine = /^(\d{1,3})[.)]?\s+([A-Fa-f])\b[.):]?\s*(.*)$/;
const inlineAnswer =
  /^(antwoord|answer|cevap)\s*:\s*([A-Fa-f])\b[.)]?\s*(.*)$/i;

type DraftQuestion = {
  prompt: string;
  options: string[];
  answer?: number;
  explanation: string;
};
type Draft = {
  title: string;
  header: string[];
  questions: Map<number, DraftQuestion>;
};

export function parseTests(lines: Line[]): DraftSet[] {
  const drafts: Draft[] = [];
  let draft: Draft | undefined;
  let current: DraftQuestion | undefined;
  let inKey = false;
  const begin = (title: string) => {
    draft = { title, header: [], questions: new Map() };
    drafts.push(draft);
    current = undefined;
    inKey = false;
  };
  for (const { text, heading } of lines) {
    if (answerKeyHeading.test(text) && !inlineAnswer.test(text)) {
      inKey = true;
      current = undefined;
      continue;
    }
    // A heading, or a numbered "1." after an answer key, starts the next test.
    if (heading && !questionLine.test(text)) {
      begin(text);
      continue;
    }
    if (inKey) {
      const key = text.match(keyLine);
      const q = key && draft?.questions.get(Number(key[1]));
      if (q) {
        q.answer = key[2].toUpperCase().charCodeAt(0) - 65;
        if (key[3]) q.explanation = key[3];
        continue;
      }
      if (!questionLine.test(text)) continue;
      begin('');
    }
    const option = text.match(optionLine);
    if (option && current) {
      current.options.push(option[2]);
      continue;
    }
    const answer = text.match(inlineAnswer);
    if (answer && current) {
      current.answer = answer[2].toUpperCase().charCodeAt(0) - 65;
      if (answer[3]) current.explanation = answer[3];
      continue;
    }
    const numbered = text.match(questionLine);
    if (numbered) {
      // Numbering that starts again at 1 means a new test without a title.
      if (!draft || draft.questions.has(Number(numbered[1]))) begin('');
      current = { prompt: numbered[2], options: [], explanation: '' };
      draft!.questions.set(Number(numbered[1]), current);
      continue;
    }
    if (current && !current.options.length) current.prompt += ` ${text}`;
    else if (draft && !draft.questions.size) draft.header.push(text);
    else if (!draft) begin(text);
  }
  return drafts
    .filter((d) => d.questions.size)
    .map((d, i) => {
      const problems: string[] = [];
      const questions = [...d.questions]
        .sort(([a], [b]) => a - b)
        .map(([n, q]) => {
          if (q.options.length < 2 || q.options.length > 6)
            problems.push(`${n}: needs 2–6 options (A–F)`);
          else if (q.answer === undefined || q.answer >= q.options.length)
            problems.push(`${n}: no answer in the answer key`);
          return {
            prompt: q.prompt,
            options: q.options,
            correctIndex: q.answer ?? -1,
            explanation: q.explanation,
          };
        });
      const title = d.title.replace(/\s+/g, ' ') || `Toets ${i + 1}`;
      if (problems.length)
        throw new Error(`${title} — question ${problems.join('; ')}`);
      return {
        title,
        subject: guessSubject(title),
        language: guessLanguage(lines),
        // Paper-only details such as name and date fields are left out.
        description: d.header
          .map((h) =>
            h
              .replace(/\S+:\s*_+/g, '')
              .replace(/_+/g, '')
              .trim(),
          )
          .filter((h) => h && !/omcirkel|circle|daire/i.test(h))
          .join(' '),
        material: '',
        questions,
      };
    });
}

function guessSubject(title: string) {
  for (const word of title.split(/[\s:–-]+/)) {
    const subject = findSubject(word);
    if (subject) return subject.name;
  }
  return '';
}

function guessLanguage(lines: Line[]): DraftSet['language'] {
  const text = lines
    .map((l) => l.text)
    .join(' ')
    .toLowerCase();
  const score = (words: string[]) =>
    words.reduce((n, w) => n + (text.split(` ${w} `).length - 1), 0);
  const scores = {
    nl: score(['de', 'het', 'een', 'je', 'wat', 'en']),
    en: score(['the', 'a', 'you', 'what', 'and', 'is']),
    tr: score(['ve', 'bir', 'bu', 'ne', 'için', 'mi']),
  };
  return (Object.keys(scores) as DraftSet['language'][]).reduce((a, b) =>
    scores[b] > scores[a] ? b : a,
  );
}

export function parseDocx(file: Buffer) {
  return parseTests(docxLines(file));
}
