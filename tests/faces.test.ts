import { test } from 'node:test';
import assert from 'node:assert/strict';
import { faceSchema } from '../lib/faces';

test('faces accept only small image data for the four space friends', () => {
  const image = 'data:image/jpeg;base64,/9j/4AAQSkZJRg==';
  assert.equal(faceSchema.safeParse({ name: 'arin', image }).success, true);
  assert.equal(
    faceSchema.safeParse({ name: 'piso', image: null }).success,
    true,
  );
  assert.equal(faceSchema.safeParse({ name: 'someone', image }).success, false);
  for (const bad of [
    'javascript:alert(1)',
    'data:text/html;base64,PHNjcmlwdD4=',
    'https://example.com/face.jpg',
    'data:image/svg+xml;base64,PHN2Zz4=',
    `data:image/png;base64,${'A'.repeat(400000)}`,
  ])
    assert.equal(
      faceSchema.safeParse({ name: 'mia', image: bad }).success,
      false,
      bad,
    );
});
