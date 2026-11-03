import { test } from 'node:test';
import assert from 'node:assert/strict';
import { groupIn, lessonIn, withoutLessonAndGroup } from '../lib/school';

test('finds lesson and group in headers and titles', () => {
  const header = 'Les 3 tot en met 5 • Groep 7–8';
  assert.equal(lessonIn(header), 'Les 3 tot en met 5');
  assert.equal(groupIn(header), 'Groep 7–8');
  assert.equal(withoutLessonAndGroup(header), '');
  assert.equal(
    lessonIn('Familie – Kennistoets woordenschat (les 1 en 5)'),
    'Les 1 en 5',
  );
  assert.equal(groupIn('Groep 7. Veertig kennisvragen'), 'Groep 7');
  assert.equal(lessonIn('Les 3-4-5 set1'), 'Les 3-4-5');
  assert.equal(groupIn('Rekenen hoofdstuk 2'), undefined);
  assert.equal(
    withoutLessonAndGroup('Les 2 • Herhaling • Groep 6'),
    'Herhaling',
  );
});
