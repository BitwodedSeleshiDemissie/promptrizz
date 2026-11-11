import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkRound, cleanName, isProfileId } from '../lib/rules.js';

const id = '11111111-1111-4111-8111-111111111111';
const round = (changes = {}) => ({
  profile: id,
  hole: 1,
  tokens: 29583,
  solved: true,
  model: 'claude-fable-5-2',
  ...changes,
});

test('an ordinary name is accepted as typed', () => {
  assert.deepEqual(cleanName('Ada Lovelace'), { ok: true, name: 'Ada Lovelace' });
  assert.deepEqual(cleanName('dev_42.x-y'), { ok: true, name: 'dev_42.x-y' });
});

test('spaces around a name go, and runs of spaces inside it become one', () => {
  assert.deepEqual(cleanName('   Ada    Lovelace  '), { ok: true, name: 'Ada Lovelace' });
});

test('a name must be 2 to 20 characters', () => {
  assert.equal(cleanName('A').ok, false);
  assert.equal(cleanName('A'.repeat(21)).ok, false);
  assert.equal(cleanName('A'.repeat(20)).ok, true);
});

test('a name is letters, digits, spaces, dots, dashes and underscores, starting with a letter or digit', () => {
  for (const bad of ['<script>', 'a/b', 'na\nme', '-dash', ' ', 'emoji😀', 'a"b', "a'b", 'a&b']) {
    assert.equal(cleanName(bad).ok, false, JSON.stringify(bad));
  }
});

test('names that pose as the game or its staff are refused', () => {
  for (const posing of ['admin', 'Prompt Rizz', 'PROMPTRIZZ', 'Anthropic', 'claude', 'Moderator']) {
    assert.equal(cleanName(posing).ok, false, posing);
  }
});

test('anything that is not text is not a name', () => {
  for (const bad of [undefined, null, 42, {}, ['Ada']]) assert.equal(cleanName(bad).ok, false);
});

test('a refused name comes with a reason a person can act on', () => {
  assert.match(cleanName('A').why, /2 to 20/);
  assert.match(cleanName('a/b').why, /letters/);
  assert.match(cleanName('admin').why, /taken/);
});

test('a profile id is a random UUID and nothing else', () => {
  assert.equal(isProfileId(id), true);
  for (const bad of ['', 'ada', id.toUpperCase() + 'x', `${id}'; drop table profiles`, 42, null]) {
    assert.equal(isProfileId(bad), false, String(bad));
  }
});

test('a normal round passes and comes back with only the fields the board keeps', () => {
  const checked = checkRound({ ...round(), extra: 'ignored', version: '0.2.0' });

  assert.deepEqual(checked, { ok: true, round: round() });
});

test('a round needs a known hole', () => {
  assert.equal(checkRound(round({ hole: 2 })).ok, false);
  assert.equal(checkRound(round({ hole: '1' })).ok, false);
});

test('a token count no real round could have is refused', () => {
  for (const tokens of [0, -5, 9999, 5_000_001, 29583.5, '29583', NaN, null]) {
    assert.equal(checkRound(round({ tokens })).ok, false, String(tokens));
  }
  assert.equal(checkRound(round({ tokens: 10000 })).ok, true);
});

test('solved must be plainly yes or no', () => {
  assert.equal(checkRound(round({ solved: 'true' })).ok, false);
  assert.equal(checkRound(round({ solved: false })).ok, true);
});

test('the model must look like a model id, since it is shown on a public page', () => {
  assert.equal(checkRound(round({ model: 'claude-sonnet-5-5[1m]' })).ok, true);
  for (const model of ['<img src=x>', '', 'x'.repeat(61), 42, 'has space']) {
    assert.equal(checkRound(round({ model })).ok, false, String(model));
  }
});

test('a round without a proper profile id is refused', () => {
  assert.equal(checkRound(round({ profile: 'ada' })).ok, false);
});

test('a round that is not an object at all is refused', () => {
  for (const bad of [null, 'round', 7, []]) assert.equal(checkRound(bad).ok, false);
});
