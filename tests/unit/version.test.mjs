import test from 'node:test'; import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs'; import { createHash } from 'node:crypto';
import { P1812_IMPL, P1812_REFERENCE, ALGO_VERSION } from '../../js/core/version.js';
const h = f => createHash('sha256').update(readFileSync(new URL('../../' + f, import.meta.url))).digest('hex').slice(0, 16);
test('przypięta implementacja P.1812 i dane referencyjne', () => {
  assert.equal(h(P1812_IMPL.file), P1812_IMPL.sha256_16);
  assert.equal(h(P1812_REFERENCE.file), P1812_REFERENCE.sha256_16);
  assert.match(ALGO_VERSION, /^geo-rf-5\./);
});
