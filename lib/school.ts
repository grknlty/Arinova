// Finds the school lesson and group in free text such as a test's header
// "Les 3 tot en met 5 • Groep 7–8" or title "Familie (les 1 en 5)".
const lessonPattern =
  /\b(?:lessen|les|lessons?|dersler|ders)\s*\d{1,3}(?:\s*(?:,|[–-]|en|and|ve|tot en met|t\/m|to)\s*\d{1,3})*/i;
const groupPattern =
  /\b(?:groep|group|grade|sınıf)\s*\d{1,2}(?:\s*(?:[–-]|\/|en|and|ve)\s*\d{1,2})?/i;

const tidy = (match: RegExpMatchArray | null) => {
  const text = match?.[0].replace(/\s+/g, ' ').trim();
  return text ? text[0].toUpperCase() + text.slice(1) : undefined;
};

export const lessonIn = (text: string) => tidy(text.match(lessonPattern));
export const groupIn = (text: string) => tidy(text.match(groupPattern));

// Text with the lesson and group taken out, and leftover separators removed.
export function withoutLessonAndGroup(text: string) {
  return text
    .replace(lessonPattern, '')
    .replace(groupPattern, '')
    .replace(/^[\s•|·,;:–-]+|[\s•|·,;:–-]+$/g, '')
    .replace(/\s*[•|·]\s*[•|·]\s*/g, ' • ')
    .trim();
}
