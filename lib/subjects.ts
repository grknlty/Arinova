import type { Language } from './i18n';

// Fixed school subjects. The Dutch name is what gets stored; other names and
// common shorthands are accepted on import and mapped to it.
export const subjects = [
  {
    id: 'taal',
    name: 'Taal',
    aliases: ['taal', 'nederlands', 'language', 'dil'],
    labels: { nl: 'Taal', en: 'Language', tr: 'Dil' },
  },
  {
    id: 'rekenen',
    name: 'Rekenen',
    aliases: ['rekenen', 'reken', 'wiskunde', 'maths', 'math', 'matematik'],
    labels: { nl: 'Rekenen', en: 'Maths', tr: 'Matematik' },
  },
  {
    id: 'huiswerk',
    name: 'Huiswerk',
    aliases: ['huiswerk', 'housewerk', 'homework', 'ödev', 'odev'],
    labels: { nl: 'Huiswerk', en: 'Homework', tr: 'Ödev' },
  },
  {
    id: 'topografie',
    name: 'Topografie',
    aliases: ['topografie', 'topo', 'topography', 'topografya'],
    labels: { nl: 'Topografie', en: 'Topography', tr: 'Topografya' },
  },
  {
    id: 'aardrijkskunde',
    name: 'Aardrijkskunde',
    aliases: [
      'aardrijkskunde',
      'ardkunde',
      'geography',
      'coğrafya',
      'cografya',
    ],
    labels: { nl: 'Aardrijkskunde', en: 'Geography', tr: 'Coğrafya' },
  },
  {
    id: 'verkeer',
    name: 'Verkeer',
    aliases: ['verkeer', 'traffic', 'trafik'],
    labels: { nl: 'Verkeer', en: 'Traffic', tr: 'Trafik' },
  },
] as const;

export type Subject = (typeof subjects)[number];

export function findSubject(value: string): Subject | undefined {
  const key = value.trim().toLocaleLowerCase('nl');
  return subjects.find((s) => (s.aliases as readonly string[]).includes(key));
}

export function canonicalSubject(value: string) {
  return findSubject(value)?.name ?? value.trim();
}

export function subjectLabel(value: string, lang: Language) {
  return findSubject(value)?.labels[lang] ?? value;
}
