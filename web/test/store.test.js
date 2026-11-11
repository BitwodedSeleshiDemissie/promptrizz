import { after, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { ID, testDatabase } from './helpers.js';

const db = await testDatabase();
const { store } = db;
beforeEach(() => db.empty());
after(() => db.close());

const solved = (profile, tokens, model = 'claude-fable-5-2') => ({ profile, hole: 1, tokens, solved: true, model });
const failed = (profile, tokens) => ({ profile, hole: 1, tokens, solved: false, model: 'claude-fable-5-2' });

// --- names ---------------------------------------------------------------

test('a new player gets the name they asked for', async () => {
  assert.equal(await store.saveProfile({ id: ID.ada, name: 'Ada' }), 'created');
  assert.equal((await store.findProfile(ID.ada)).name, 'Ada');
});

test('a name belongs to the first player who took it, whatever the capitals', async () => {
  await store.saveProfile({ id: ID.ada, name: 'Ada' });

  assert.equal(await store.saveProfile({ id: ID.bo, name: 'ADA' }), 'taken');
  assert.equal(await store.findProfile(ID.bo), null);
});

test('a player can change their own name, and the old one becomes free', async () => {
  await store.saveProfile({ id: ID.ada, name: 'Ada' });

  assert.equal(await store.saveProfile({ id: ID.ada, name: 'Countess' }), 'renamed');
  assert.equal((await store.findProfile(ID.ada)).name, 'Countess');
  assert.equal(await store.saveProfile({ id: ID.bo, name: 'Ada' }), 'created');
});

test('someone nobody has heard of is simply not found', async () => {
  assert.equal(await store.findProfile(ID.cy), null);
});

test('a player who leaves takes their scores with them', async () => {
  await store.saveProfile({ id: ID.ada, name: 'Ada' });
  await store.saveRound(solved(ID.ada, 30000));

  assert.equal(await store.removeProfile(ID.ada), true);

  assert.equal(await store.findProfile(ID.ada), null);
  assert.deepEqual((await store.board(1)).entries, []);
  assert.equal(await store.removeProfile(ID.ada), false);
});

// --- rounds --------------------------------------------------------------

test('the first round is both the first try and the best', async () => {
  await store.saveProfile({ id: ID.ada, name: 'Ada' });

  const result = await store.saveRound(solved(ID.ada, 33784));

  assert.deepEqual(result, { firstTry: 33784, firstSolved: true, best: 33784, rounds: 1, improved: true });
});

test('a later, cheaper solved round becomes the best while the first try stays', async () => {
  await store.saveProfile({ id: ID.ada, name: 'Ada' });
  await store.saveRound(solved(ID.ada, 33784));

  const result = await store.saveRound(solved(ID.ada, 20948));

  assert.deepEqual(result, { firstTry: 33784, firstSolved: true, best: 20948, rounds: 2, improved: true });
});

test('a later round that costs more changes nothing but the count', async () => {
  await store.saveProfile({ id: ID.ada, name: 'Ada' });
  await store.saveRound(solved(ID.ada, 20948));

  const result = await store.saveRound(solved(ID.ada, 40000));

  assert.deepEqual(result, { firstTry: 20948, firstSolved: true, best: 20948, rounds: 2, improved: false });
});

test('an unsolved round never counts as a best, however few tokens it used', async () => {
  await store.saveProfile({ id: ID.ada, name: 'Ada' });
  await store.saveRound(solved(ID.ada, 30000));

  const result = await store.saveRound(failed(ID.ada, 12000));

  assert.equal(result.best, 30000);
  assert.equal(result.improved, false);
});

test('a player whose first try failed has no best until they solve one', async () => {
  await store.saveProfile({ id: ID.ada, name: 'Ada' });

  const first = await store.saveRound(failed(ID.ada, 31000));
  const second = await store.saveRound(solved(ID.ada, 28000));

  assert.deepEqual(first, { firstTry: 31000, firstSolved: false, best: null, rounds: 1, improved: false });
  assert.deepEqual(second, { firstTry: 31000, firstSolved: false, best: 28000, rounds: 2, improved: true });
});

// --- the board -----------------------------------------------------------

test('the board lists players by best score, fewest tokens first', async () => {
  await store.saveProfile({ id: ID.ada, name: 'Ada' });
  await store.saveProfile({ id: ID.bo, name: 'Bo' });
  await store.saveProfile({ id: ID.cy, name: 'Cy' });
  await store.saveRound(solved(ID.ada, 30000));
  await store.saveRound(solved(ID.bo, 21000, 'claude-opus-5-5'));
  await store.saveRound(solved(ID.cy, 26000));

  const { entries, players } = await store.board(1);

  assert.deepEqual(entries.map((e) => [e.rank, e.name, e.best]), [
    [1, 'Bo', 21000],
    [2, 'Cy', 26000],
    [3, 'Ada', 30000],
  ]);
  assert.equal(players, 3);
  assert.equal(entries[0].model, 'claude-opus-5-5');
});

test('each entry shows the first try next to the best, and how many rounds were played', async () => {
  await store.saveProfile({ id: ID.ada, name: 'Ada' });
  await store.saveRound(solved(ID.ada, 33784));
  await store.saveRound(solved(ID.ada, 20948));

  const [entry] = (await store.board(1)).entries;

  assert.equal(entry.firstTry, 33784);
  assert.equal(entry.firstSolved, true);
  assert.equal(entry.rounds, 2);
});

test('the model shown is the one that made the best score', async () => {
  await store.saveProfile({ id: ID.ada, name: 'Ada' });
  await store.saveRound(solved(ID.ada, 33784, 'claude-fable-5-2'));
  await store.saveRound(solved(ID.ada, 20948, 'claude-haiku-5-5'));
  await store.saveRound(solved(ID.ada, 50000, 'claude-opus-5-5'));

  assert.equal((await store.board(1)).entries[0].model, 'claude-haiku-5-5');
});

test('players who never solved the hole are not on the board', async () => {
  await store.saveProfile({ id: ID.ada, name: 'Ada' });
  await store.saveRound(failed(ID.ada, 31000));

  const { entries, players } = await store.board(1);

  assert.deepEqual(entries, []);
  assert.equal(players, 0);
});

test('with equal scores, whoever got there first ranks higher', async () => {
  await store.saveProfile({ id: ID.ada, name: 'Ada' });
  await store.saveProfile({ id: ID.bo, name: 'Bo' });
  await store.saveRound(solved(ID.bo, 25000));
  await store.saveRound(solved(ID.ada, 25000));

  assert.deepEqual((await store.board(1)).entries.map((e) => e.name), ['Bo', 'Ada']);
});

test('the board can be cut to a top few while still counting everyone', async () => {
  await store.saveProfile({ id: ID.ada, name: 'Ada' });
  await store.saveProfile({ id: ID.bo, name: 'Bo' });
  await store.saveRound(solved(ID.ada, 30000));
  await store.saveRound(solved(ID.bo, 21000));

  const { entries, players } = await store.board(1, 1);

  assert.deepEqual(entries.map((e) => e.name), ['Bo']);
  assert.equal(players, 2);
});

test('a hidden player is off the board and out of the count, but keeps the name', async () => {
  await store.saveProfile({ id: ID.ada, name: 'Ada' });
  await store.saveProfile({ id: ID.bo, name: 'Bo' });
  await store.saveRound(solved(ID.ada, 30000));
  await store.saveRound(solved(ID.bo, 21000));

  assert.equal(await store.setHidden('bo', true), true);

  const { entries, players } = await store.board(1);
  assert.deepEqual(entries.map((e) => [e.rank, e.name]), [[1, 'Ada']]);
  assert.equal(players, 1);
  assert.equal(await store.saveProfile({ id: ID.cy, name: 'Bo' }), 'taken');
});

test('a hidden player can be shown again', async () => {
  await store.saveProfile({ id: ID.bo, name: 'Bo' });
  await store.saveRound(solved(ID.bo, 21000));
  await store.setHidden('Bo', true);

  await store.setHidden('Bo', false);

  assert.equal((await store.board(1)).entries.length, 1);
});

test('hiding a name nobody has reports that nothing happened', async () => {
  assert.equal(await store.setHidden('nobody', true), false);
});

// --- where one player stands ----------------------------------------------

test('a player can be told their rank and how many players there are', async () => {
  await store.saveProfile({ id: ID.ada, name: 'Ada' });
  await store.saveProfile({ id: ID.bo, name: 'Bo' });
  await store.saveRound(solved(ID.ada, 30000));
  await store.saveRound(solved(ID.bo, 21000));

  assert.deepEqual(await store.standing(ID.ada, 1), { rank: 2, players: 2 });
  assert.deepEqual(await store.standing(ID.bo, 1), { rank: 1, players: 2 });
});

test('a player with no solved round has no rank yet', async () => {
  await store.saveProfile({ id: ID.ada, name: 'Ada' });
  await store.saveProfile({ id: ID.bo, name: 'Bo' });
  await store.saveRound(failed(ID.ada, 30000));
  await store.saveRound(solved(ID.bo, 21000));

  assert.deepEqual(await store.standing(ID.ada, 1), { rank: null, players: 1 });
});

// --- limits ---------------------------------------------------------------

test('a sender is let through up to the limit and stopped after it', async () => {
  const answers = [];
  for (let i = 0; i < 4; i += 1) answers.push(await store.allow('sender-a', 3, 3600));

  assert.deepEqual(answers, [true, true, true, false]);
});

test('one sender hitting the limit does not stop another', async () => {
  for (let i = 0; i < 3; i += 1) await store.allow('sender-a', 2, 3600);

  assert.equal(await store.allow('sender-b', 2, 3600), true);
});

test('posts older than the window no longer count against a sender', async () => {
  await db.query("insert into posts (who, at) values ('sender-a', now() - interval '2 hours')");
  await db.query("insert into posts (who, at) values ('sender-a', now() - interval '2 hours')");

  assert.equal(await store.allow('sender-a', 2, 3600), true);
});

test('records of posts older than a day are thrown away', async () => {
  await db.query("insert into posts (who, at) values ('old-sender', now() - interval '2 days')");

  await store.allow('sender-a', 5, 3600);

  assert.deepEqual(await db.query("select 1 from posts where who = 'old-sender'"), []);
});
