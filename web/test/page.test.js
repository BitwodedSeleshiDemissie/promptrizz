import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderPage, toPar } from '../lib/page.js';

const hole = { number: 1, title: 'fix the search crash', par: 35000 };
const entry = (changes = {}) => ({
  rank: 1,
  name: 'Ada',
  best: 29583,
  model: 'claude-fable-5-2',
  firstTry: 33784,
  firstSolved: true,
  rounds: 2,
  at: '2026-11-11T12:00:00.000Z',
  ...changes,
});
const page = (entries, me) => renderPage({ hole, players: entries.length, entries, me });

test('a score is shown against par the way golf does it', () => {
  assert.deepEqual(toPar(21394, 35000), { text: '−13,606', side: 'under' });
  assert.deepEqual(toPar(37100, 35000), { text: '+2,100', side: 'over' });
  assert.deepEqual(toPar(35000, 35000), { text: 'E', side: 'even' });
});

test('each player row carries rank, name, score to par, tokens, first try, rounds and setup', () => {
  const html = page([entry()]);

  const row = html.match(/<tr class="player[^"]*"[\s\S]*?<\/tr>/)[0];
  for (const shown of ['>1<', 'Ada', '−5,417', '29,583', '33,784', '>2<', 'Fable 5.2']) {
    assert.ok(row.includes(shown), `row shows ${shown}`);
  }
});

test('a first try that was not solved says so instead of showing a number', () => {
  const html = page([entry({ firstSolved: false, firstTry: 31000 })]);

  assert.match(html, /not solved/);
  assert.doesNotMatch(html, /31,000/);
});

test('the page says how to play and that scores are not checked', () => {
  const html = page([entry()]);

  assert.match(html, /npx promptrizz/);
  assert.match(html, /not checked|unverified/i);
});

test('an empty board invites the first player instead of showing an empty table', () => {
  const html = page([]);

  assert.match(html, /Nobody has solved/);
  assert.doesNotMatch(html, /<table/);
});

test('whatever is in a name or a model reaches the page as text, never as markup', () => {
  const html = page([entry({ name: '<img src=x onerror=alert(1)>', model: '"><script>alert(2)</script>' })]);

  assert.ok(!html.includes('<img src=x'));
  assert.ok(!html.includes('<script>alert(2)'));
  assert.ok(html.includes('&lt;img src=x onerror=alert(1)&gt;'));
});

test('the visitor named in the link gets the only marked row, whatever the capitals', () => {
  const html = page([entry({ rank: 1, name: 'Bo' }), entry({ rank: 2, name: 'Ada' })], 'ADA');

  assert.equal(html.match(/id="me"/g).length, 1);
  assert.match(html.match(/<tr[^>]*id="me"[\s\S]*?<\/tr>/)[0], /Ada/);
});

test('a name in the link that is not on the board marks nothing and is not echoed into the page', () => {
  const html = page([entry()], '<b>nobody</b>');

  assert.doesNotMatch(html, /id="me"/);
  assert.ok(!html.includes('<b>nobody</b>'));
});

test('the page states how many players are on the board', () => {
  const html = renderPage({ hole, players: 42, entries: [entry()], me: undefined });

  assert.match(html, /42 players/);
});
