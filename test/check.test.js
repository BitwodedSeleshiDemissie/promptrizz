import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runCheck } from '../src/check.js';
import { loadHole, setUpFolder } from '../src/hole.js';

const fix = fileURLToPath(new URL('./fixtures/001-fix/', import.meta.url));

test('the app as shipped, bug included, does not pass', () => {
  const hole = loadHole();
  const folder = setUpFolder(hole);

  assert.equal(runCheck(hole, folder).solved, false);
});

test('the app with the bug fixed passes', () => {
  const hole = loadHole();
  const folder = setUpFolder(hole);
  cpSync(fix, folder, { recursive: true });

  assert.equal(runCheck(hole, folder).solved, true);
});

test('an app that hides the crash by never finding anything does not pass', () => {
  const hole = loadHole();
  const folder = setUpFolder(hole);
  writeFileSync(join(folder, 'src', 'search.js'), 'export function search() {\n  return [];\n}\n');

  assert.equal(runCheck(hole, folder).solved, false);
});

test('an app that no longer starts does not pass', () => {
  const hole = loadHole();
  const folder = setUpFolder(hole);
  writeFileSync(join(folder, 'server.js'), 'this is not javascript\n');

  assert.equal(runCheck(hole, folder).solved, false);
});
