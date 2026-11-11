import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderBoard, renderPage, rizz, toPar } from '../lib/page.js';

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
const page = (entries, me) => renderPage({ hole, players: entries.length, played: 0, entries, me });
const rows = (html) => html.match(/<li class="row[\s\S]*?<\/li>/g) ?? [];

// --- the numbers ---------------------------------------------------------------

test('a score is shown against par the way golf does it', () => {
  assert.deepEqual(toPar(21394, 35000), { text: '−13,606', side: 'under' });
  assert.deepEqual(toPar(37100, 35000), { text: '+2,100', side: 'over' });
  assert.deepEqual(toPar(35000, 35000), { text: 'E', side: 'even' });
});

test('how much rizz a score has depends on how far under par it is', () => {
  const level = (tokens) => rizz(tokens, 35000).name;

  assert.equal(level(20948), 'Unspoken rizz');
  assert.equal(level(25000), 'Unspoken rizz');
  assert.equal(level(25001), 'W rizz');
  assert.equal(level(30000), 'W rizz');
  assert.equal(level(30001), 'Rizz');
  assert.equal(level(34999), 'Rizz');
  assert.equal(level(35000), 'Mid');
  assert.equal(level(40000), 'Mid');
  assert.equal(level(40001), 'Yapper');
});

// --- one player's row ----------------------------------------------------------

test('a row carries rank, name, rizz level, score to par, tokens, first try, rounds and setup', () => {
  const [row] = rows(page([entry()]));

  for (const shown of ['>1<', 'Ada', 'W rizz', '−5,417', '29,583', '33,784', '2 rounds', 'Fable 5.2']) {
    assert.ok(row.includes(shown), `row shows ${shown}`);
  }
});

test('a first try that was not solved says so instead of showing a number', () => {
  const html = page([entry({ firstSolved: false, firstTry: 31000 })]);

  assert.match(html, /not solved/);
  assert.doesNotMatch(html, /31,000/);
});

test('the fewer tokens a player used, the shorter their bar', () => {
  const html = page([entry({ rank: 1, name: 'Bo', best: 21000 }), entry({ rank: 2, name: 'Ada', best: 33000 })]);

  const widths = rows(html).map((row) => Number(row.match(/class="fill[^"]*" style="width:([\d.]+)%/)[1]));
  assert.ok(widths[0] < widths[1], `${widths[0]} < ${widths[1]}`);
  assert.ok(widths.every((width) => width > 0 && width <= 100));
});

test('whatever is in a name or a model reaches the page as text, never as markup', () => {
  const html = page([entry({ name: '<img src=x onerror=alert(1)>', model: '"><script>alert(2)</script>' })]);

  assert.ok(!html.includes('<img src=x'));
  assert.ok(!html.includes('<script>alert(2)'));
  assert.ok(html.includes('&lt;img src=x onerror=alert(1)&gt;'));
});

// --- the visitor's own row -------------------------------------------------------

test('the visitor named in the link gets the only marked row, whatever the capitals', () => {
  const html = page([entry({ rank: 1, name: 'Bo' }), entry({ rank: 2, name: 'Ada' })], 'ADA');

  assert.equal(html.match(/id="me"/g).length, 1);
  assert.match(html.match(/<li[^>]*id="me"[\s\S]*?<\/li>/)[0], />Ada</);
});

test('a name in the link that is not on the board marks nothing and is not echoed into the page', () => {
  const html = page([entry()], '<b>nobody</b>');

  assert.doesNotMatch(html, /id="me"/);
  assert.ok(!html.includes('<b>nobody</b>'));
});

// --- the par line ----------------------------------------------------------------

const order = (html) =>
  [...html.matchAll(/<li class="(row|parline)[\s\S]*?<\/li>/g)].map((m) =>
    m[1] === 'parline' ? 'PAR' : m[0].match(/class="who">([^<]*)</)[1],
  );

test('the par line sits between the players under par and the players at or over it', () => {
  const html = page([
    entry({ rank: 1, name: 'Bo', best: 21000 }),
    entry({ rank: 2, name: 'Cy', best: 35000 }),
    entry({ rank: 3, name: 'Dee', best: 39000 }),
  ]);

  assert.deepEqual(order(html), ['Bo', 'PAR', 'Cy', 'Dee']);
});

test('with everyone under par, the par line closes the board', () => {
  const html = page([entry({ rank: 1, name: 'Bo', best: 21000 }), entry({ rank: 2, name: 'Ada', best: 30000 })]);

  assert.deepEqual(order(html), ['Bo', 'Ada', 'PAR']);
});

test('with everyone over par, the par line opens the board', () => {
  const html = page([entry({ rank: 1, name: 'Dee', best: 39000 })]);

  assert.deepEqual(order(html), ['PAR', 'Dee']);
});

// --- the whole page ----------------------------------------------------------------

test('the page says how to play and that scores are not checked', () => {
  const html = page([entry()]);

  assert.match(html, /npx promptrizz/);
  assert.match(html, /not checked|unverified/i);
});

test('an empty board invites the first player and shows no rows', () => {
  const html = page([]);

  assert.match(html, /Nobody has solved/);
  assert.deepEqual(rows(html), []);
});

test('the page states how many players are on the board, the best score and the rounds played', () => {
  const html = renderPage({
    hole,
    players: 42,
    played: 120,
    entries: [entry({ best: 20948 })],
    me: undefined,
  });

  assert.match(html, /42 players/);
  assert.match(html, /20,948/);
  assert.match(html, /120 rounds/);
});

test('the board alone can be rendered, for refreshing it without reloading the page', () => {
  const html = renderBoard({ hole, players: 1, played: 2, entries: [entry()], me: 'ada' });

  assert.doesNotMatch(html, /<html|<head|<script/);
  assert.equal(rows(html).length, 1);
  assert.match(html, /id="me"/);
});
