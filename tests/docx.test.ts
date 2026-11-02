import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deflateRawSync } from 'node:zlib';
import { docxLines, parseDocx, parseTests } from '../lib/docx';
import { setSchema } from '../lib/model';

// A minimal .docx: a zip holding only word/document.xml.
function docx(paragraphs: string[]) {
  const xml = Buffer.from(
    `<?xml version="1.0"?><w:document><w:body>${paragraphs.join('')}</w:body></w:document>`,
  );
  const name = Buffer.from('word/document.xml');
  const data = deflateRawSync(xml);
  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(8, 8);
  local.writeUInt32LE(data.length, 18);
  local.writeUInt32LE(xml.length, 22);
  local.writeUInt16LE(name.length, 26);
  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0);
  central.writeUInt16LE(8, 10);
  central.writeUInt32LE(data.length, 20);
  central.writeUInt32LE(xml.length, 24);
  central.writeUInt16LE(name.length, 28);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(1, 8);
  end.writeUInt16LE(1, 10);
  end.writeUInt32LE(46 + name.length, 12);
  end.writeUInt32LE(30 + name.length + data.length, 16);
  return Buffer.concat([local, name, data, central, name, end]);
}
const p = (text: string, style = '') =>
  `<w:p>${style ? `<w:pPr><w:pStyle w:val="${style}"/></w:pPr>` : ''}<w:r>${text
    .split('<w:br/>')
    .map((t) => `<w:t xml:space="preserve">${t}</w:t>`)
    .join('<w:br/>')}</w:r></w:p>`;

test('reads two tests with answer keys from a Word file', () => {
  const file = docx([
    p('Verkeer toets 1  Kennis', 'Title'),
    p('Les 3 • Groep 7–8    Naam: ______    Datum: ____'),
    p('Omcirkel één antwoord per vraag.'),
    p('1. Wat betekent een rood &amp; rond bord?'),
    p('A. Verplicht'),
    p('B. Verboden'),
    p('2. Waar loop je?'),
    p('A. Op de rijbaan'),
    p('B. Op de stoep'),
    p('C. Op het fietspad'),
    p('Antwoorden toets 1'),
    p('1. B  Een rode rand betekent een verbod.'),
    p('2. B'),
    p('Verkeer toets 2', 'Title'),
    p('1. Wie gaat voor?<w:br/>A. De tram<w:br/>B. Jij'),
    p('Antwoord: A'),
  ]);
  const sets = parseDocx(file);
  assert.equal(sets.length, 2);
  for (const set of sets) setSchema.parse(set);
  assert.deepEqual(sets[0], {
    title: 'Verkeer toets 1 Kennis',
    subject: 'Verkeer',
    language: 'nl',
    description: 'Les 3 • Groep 7–8',
    material: '',
    questions: [
      {
        prompt: 'Wat betekent een rood & rond bord?',
        options: ['Verplicht', 'Verboden'],
        correctIndex: 1,
        explanation: 'Een rode rand betekent een verbod.',
      },
      {
        prompt: 'Waar loop je?',
        options: ['Op de rijbaan', 'Op de stoep', 'Op het fietspad'],
        correctIndex: 1,
        explanation: '',
      },
    ],
  });
  assert.equal(sets[1].title, 'Verkeer toets 2');
  assert.deepEqual(sets[1].questions[0].options, ['De tram', 'Jij']);
  assert.equal(sets[1].questions[0].correctIndex, 0);
});

test('reports questions without an answer', () => {
  const lines = ['1. Vraag?', 'A. Ja', 'B. Nee'].map((text) => ({
    text,
    heading: false,
  }));
  assert.throws(() => parseTests(lines), /1: no answer/);
});

test('rejects files that are not Word documents', () => {
  assert.throws(() => docxLines(Buffer.from('not a zip')), /Word/);
});
