// The game and the service are two programs that have to agree. These tests run the
// game's own client (../../src/board.js) against the service's real code and a real
// Postgres, over real HTTP on this machine.
import { after, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { joinBoard, leaveBoard, postRound } from '../../src/board.js';
import { createApi } from '../lib/api.js';
import { ID, testDatabase } from './helpers.js';

const db = await testDatabase();
const api = createApi({ store: db.store, salt: 'a-test-salt' });
const routes = { '/api/profiles': api.profiles, '/api/scores': api.scores, '/api/leaderboard': api.leaderboard, '/': api.page };

const server = createServer(async (req, res) => {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const url = new URL(req.url, `http://${req.headers.host}`);
  const request = new Request(url, {
    method: req.method,
    headers: { 'content-type': req.headers['content-type'] ?? '', 'x-forwarded-for': '203.0.113.7' },
    body: ['GET', 'HEAD'].includes(req.method) ? undefined : Buffer.concat(chunks),
  });
  const response = await (routes[url.pathname] ?? (() => new Response('', { status: 404 })))(request);
  res.writeHead(response.status, Object.fromEntries(response.headers));
  res.end(Buffer.from(await response.arrayBuffer()));
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const board = `http://127.0.0.1:${server.address().port}`;

beforeEach(() => db.empty());
after(async () => {
  await new Promise((resolve) => server.close(resolve));
  await db.close();
});

const round = (profile, tokens, solved = true) => ({ profile, hole: 1, tokens, solved, model: 'claude-fable-5-2' });

test('the game can join, post a round, and learn its rank and the link to its row', async () => {
  const joined = await joinBoard({ board, id: ID.ada, name: 'Ada' });
  const outcome = await postRound({ board, round: round(ID.ada, 29583) });

  assert.deepEqual(joined, { joined: true, name: 'Ada' });
  assert.equal(outcome.posted, true);
  assert.equal(outcome.standing.rank, 1);
  assert.equal(outcome.standing.players, 1);
  assert.equal(outcome.standing.best, 29583);
  assert.equal(outcome.standing.url, `${board}/?me=Ada#me`);
});

test('the link the game prints opens a page with that player marked', async () => {
  await joinBoard({ board, id: ID.ada, name: 'Ada' });
  const { standing } = await postRound({ board, round: round(ID.ada, 29583) });

  const html = await (await fetch(standing.url)).text();

  assert.match(html, /<tr class="player me" id="me">/);
});

test('a name the service refuses reaches the game with the reason', async () => {
  const outcome = await joinBoard({ board, id: ID.ada, name: '<b>' });

  assert.equal(outcome.joined, false);
  assert.match(outcome.why, /letters, digits/);
});

test('a second machine cannot take a name that is in use', async () => {
  await joinBoard({ board, id: ID.ada, name: 'Ada' });

  const outcome = await joinBoard({ board, id: ID.bo, name: 'ada' });

  assert.deepEqual(outcome, { joined: false, why: 'That name is taken.' });
});

test('a round with a made-up token count is refused, and the game is told why', async () => {
  await joinBoard({ board, id: ID.ada, name: 'Ada' });

  const outcome = await postRound({ board, round: round(ID.ada, 42) });

  assert.equal(outcome.posted, false);
  assert.match(outcome.why, /not one a real round can have/);
});

test('a round from a machine that never joined tells the player how to join', async () => {
  const outcome = await postRound({ board, round: round(ID.cy, 29583) });

  assert.equal(outcome.posted, false);
  assert.match(outcome.why, /npx promptrizz name/);
});

test('leaving through the game removes the player and their scores from the service', async () => {
  await joinBoard({ board, id: ID.ada, name: 'Ada' });
  await postRound({ board, round: round(ID.ada, 29583) });

  assert.equal(await leaveBoard({ board, id: ID.ada }), true);

  assert.deepEqual((await db.store.board(1)).entries, []);
  assert.equal(await db.store.findProfile(ID.ada), null);
});
