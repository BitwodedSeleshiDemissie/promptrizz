import { after, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { createApi, LIMITS } from '../lib/api.js';
import { ID, testDatabase } from './helpers.js';

const db = await testDatabase();
const api = createApi({ store: db.store, salt: 'a-test-salt' });
beforeEach(() => db.empty());
after(() => db.close());

const SITE = 'https://board.test';
const HOME_IP = '203.0.113.7';

// A request the way a player's machine (or a browser) would send it.
function send(method, path, body, { ip = HOME_IP } = {}) {
  return new Request(SITE + path, {
    method,
    headers: { 'content-type': 'application/json', 'x-forwarded-for': `${ip}, 10.0.0.1` },
    body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
  });
}
const round = (profile, tokens, solved = true) => ({ profile, hole: 1, tokens, solved, model: 'claude-fable-5-2' });
const join = (id, name, options) => api.profiles(send('POST', '/api/profiles', { id, name }, options));
const play = (profile, tokens, solved, options) =>
  api.scores(send('POST', '/api/scores', round(profile, tokens, solved), options));

// --- joining -----------------------------------------------------------------

test('a new player joins with a name and is told it was created', async () => {
  const response = await join(ID.ada, '  Ada  ');

  assert.equal(response.status, 201);
  assert.deepEqual(await response.json(), { name: 'Ada' });
});

test('joining again with a new name renames the player', async () => {
  await join(ID.ada, 'Ada');

  const response = await join(ID.ada, 'Countess');

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { name: 'Countess' });
});

test('a name someone else holds is refused with a clear reason', async () => {
  await join(ID.ada, 'Ada');

  const response = await join(ID.bo, 'ada');

  assert.equal(response.status, 409);
  assert.deepEqual(await response.json(), { error: 'That name is taken.' });
});

test('a name that breaks the rules is refused with the rule', async () => {
  const response = await join(ID.ada, '<script>');

  assert.equal(response.status, 400);
  assert.match((await response.json()).error, /letters, digits/);
});

test('joining needs a proper profile id', async () => {
  const response = await join('ada', 'Ada');

  assert.equal(response.status, 400);
});

test('a body that is not JSON is refused, not crashed on', async () => {
  const response = await api.profiles(send('POST', '/api/profiles', 'name=Ada'));

  assert.equal(response.status, 400);
});

test('a body far bigger than any real request is refused', async () => {
  const response = await api.profiles(send('POST', '/api/profiles', { id: ID.ada, name: 'Ada', junk: 'x'.repeat(5000) }));

  assert.equal(response.status, 413);
});

test('one address can only create so many players in an hour', async () => {
  const statuses = [];
  for (let i = 0; i <= LIMITS.joinsPerHour; i += 1) {
    const id = `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`;
    statuses.push((await join(id, `Player ${i}`)).status);
  }

  assert.equal(statuses.at(-1), 429);
  assert.ok(statuses.slice(0, -1).every((status) => status === 201));
  assert.equal((await join(ID.cy, 'Cy', { ip: '198.51.100.9' })).status, 201, 'another address is unaffected');
});

test('the address of a sender is never stored in a readable form', async () => {
  await join(ID.ada, 'Ada');

  const kept = JSON.stringify(await db.query('select who from posts'));
  assert.ok(kept.length > 10, 'something was noted');
  assert.ok(!kept.includes(HOME_IP));
});

test('a player can leave, and then they are gone', async () => {
  await join(ID.ada, 'Ada');
  await play(ID.ada, 30000);

  const left = await api.profiles(send('DELETE', '/api/profiles', { id: ID.ada }));
  const again = await api.profiles(send('DELETE', '/api/profiles', { id: ID.ada }));

  assert.equal(left.status, 200);
  assert.deepEqual(await left.json(), { removed: true });
  assert.equal(again.status, 404);
  assert.deepEqual((await db.store.board(1)).entries, []);
});

test('only joining and leaving are possible on the players address', async () => {
  assert.equal((await api.profiles(send('GET', '/api/profiles'))).status, 405);
});

// --- posting rounds ------------------------------------------------------------

test('a round from a player comes back with their best, first try, rank and a link to their row', async () => {
  await join(ID.ada, 'Ada L');
  await join(ID.bo, 'Bo');
  await play(ID.bo, 21000);

  const response = await play(ID.ada, 29583);

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    name: 'Ada L',
    best: 29583,
    firstTry: 29583,
    firstSolved: true,
    rounds: 1,
    improved: true,
    rank: 2,
    players: 2,
    url: `${SITE}/?me=Ada%20L#me`,
  });
});

test('a round from someone who never joined is refused', async () => {
  const response = await play(ID.cy, 29583);

  assert.equal(response.status, 404);
});

test('a round with an impossible token count is refused', async () => {
  await join(ID.ada, 'Ada');

  const response = await play(ID.ada, 42);

  assert.equal(response.status, 400);
  assert.match((await response.json()).error, /real round/);
});

test('an unsolved round is recorded but earns no rank', async () => {
  await join(ID.ada, 'Ada');

  const body = await (await play(ID.ada, 31000, false)).json();

  assert.equal(body.best, null);
  assert.equal(body.rank, null);
  assert.equal(body.rounds, 1);
});

test('one player can only post so many rounds in an hour', async () => {
  await join(ID.ada, 'Ada');
  let last;
  for (let i = 0; i <= LIMITS.roundsPerPlayerPerHour; i += 1) {
    last = await play(ID.ada, 30000 + i, true, { ip: `198.51.100.${i}` });
  }

  assert.equal(last.status, 429);
});

test('only posting is possible on the scores address', async () => {
  assert.equal((await api.scores(send('GET', '/api/scores'))).status, 405);
});

// --- reading the board -----------------------------------------------------------

test('the board is readable as data, with the hole, its par and the ranked players', async () => {
  await join(ID.ada, 'Ada');
  await join(ID.bo, 'Bo');
  await play(ID.ada, 33784);
  await play(ID.ada, 29583);
  await play(ID.bo, 21000);

  const response = await api.leaderboard(send('GET', '/api/leaderboard'));
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.hole, 1);
  assert.equal(body.title, 'fix the search crash');
  assert.equal(body.par, 35000);
  assert.equal(body.players, 2);
  assert.deepEqual(
    body.entries.map((e) => [e.rank, e.name, e.best, e.firstTry, e.rounds, e.setup]),
    [
      [1, 'Bo', 21000, 21000, 1, 'Claude Code + Fable 5.2'],
      [2, 'Ada', 29583, 33784, 2, 'Claude Code + Fable 5.2'],
    ],
  );
});

test('the board never gives away the ids that let a machine post as a player', async () => {
  await join(ID.ada, 'Ada');
  await play(ID.ada, 29583);

  const text = await (await api.leaderboard(send('GET', '/api/leaderboard'))).text();

  assert.ok(!text.includes(ID.ada));
});

test('asking for a hole that does not exist is a plain not-found', async () => {
  const response = await api.leaderboard(send('GET', '/api/leaderboard?hole=9'));

  assert.equal(response.status, 404);
});

test('the board may be cached for a moment, so a busy day does not hammer the database', async () => {
  const response = await api.leaderboard(send('GET', '/api/leaderboard'));

  assert.match(response.headers.get('cache-control'), /s-maxage=\d+/);
});

// --- the page --------------------------------------------------------------------

test('the page is HTML that shows the ranked players', async () => {
  await join(ID.ada, 'Ada');
  await play(ID.ada, 29583);

  const response = await api.page(send('GET', '/'));
  const html = await response.text();

  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /text\/html/);
  assert.match(html, /Ada/);
  assert.match(html, /29,583/);
});

test('following the link from the game marks that player on the page', async () => {
  await join(ID.ada, 'Ada');
  await join(ID.bo, 'Bo');
  await play(ID.ada, 29583);
  await play(ID.bo, 21000);

  const html = await (await api.page(send('GET', '/?me=ada'))).text();

  const marked = html.match(/<tr[^>]*id="me"[^>]*>[\s\S]*?<\/tr>/);
  assert.ok(marked, 'one row is marked');
  assert.match(marked[0], />Ada</);
  assert.doesNotMatch(marked[0], />Bo</);
});
