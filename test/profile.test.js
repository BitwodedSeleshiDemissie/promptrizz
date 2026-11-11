import { test } from 'node:test';
import assert from 'node:assert/strict';
import { statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { forgetProfile, readProfile, saveProfile } from '../src/profile.js';
import { ADA, tempHome } from './helpers/fake-board.js';

test('on a machine that never played there is no profile', () => {
  assert.deepEqual(readProfile(tempHome()), {});
});

test('a saved profile is there the next time', () => {
  const home = tempHome();

  saveProfile(ADA, home);

  assert.deepEqual(readProfile(home), ADA);
});

test('the profile is readable only by its owner, since its id is what lets a machine post', { skip: process.platform === 'win32' }, () => {
  const home = tempHome();

  saveProfile(ADA, home);

  assert.equal(statSync(join(home, '.promptrizz', 'profile.json')).mode & 0o777, 0o600);
});

test('a damaged profile file counts as no profile instead of crashing the game', () => {
  const home = tempHome(ADA);
  writeFileSync(join(home, '.promptrizz', 'profile.json'), '{ not json');

  assert.deepEqual(readProfile(home), {});
});

test('a forgotten profile is gone', () => {
  const home = tempHome(ADA);

  forgetProfile(home);

  assert.deepEqual(readProfile(home), {});
});
