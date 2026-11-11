import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { loadHole, setUpFolder } from '../src/hole.js';

test('the hole says what to fix and what a round usually costs', () => {
  const hole = loadHole();

  assert.equal(hole.number, 1);
  assert.equal(hole.title, 'fix the search crash');
  assert.match(hole.task, /crashes when the search box is empty/);
  assert.ok(Number.isInteger(hole.par) && hole.par > 0, 'par is a whole number of tokens');
});

test('setting up a round gives a folder that holds the app', () => {
  const folder = setUpFolder(loadHole());

  assert.ok(existsSync(join(folder, 'server.js')));
  assert.ok(existsSync(join(folder, 'src', 'search.js')));
  assert.ok(existsSync(join(folder, 'public', 'index.html')));
});

test('the check that decides the round is not in the folder the agent works in', () => {
  const folder = setUpFolder(loadHole());

  const files = readdirSync(folder, { recursive: true });
  assert.ok(!files.some((file) => /check|hole\.json/.test(file)), `found: ${files.join(', ')}`);
});

test('every round gets its own folder', () => {
  const hole = loadHole();

  assert.notEqual(setUpFolder(hole), setUpFolder(hole));
});
