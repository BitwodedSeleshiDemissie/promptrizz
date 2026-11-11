import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { joinBoard, leaveBoard, postRound } from '../src/board.js';
import { ADA, fakeBoard, NO_BOARD } from './helpers/fake-board.js';

const board = await fakeBoard({ taken: ['Grace'] });
after(() => board.close());

const round = { profile: ADA.id, hole: 1, tokens: 29583, solved: true, model: 'claude-fable-5-2' };

test('joining sends the id and the name, and reports the name the board kept', async () => {
  const outcome = await joinBoard({ board: board.url, id: ADA.id, name: '  Ada ' });

  assert.deepEqual(outcome, { joined: true, name: 'Ada' });
  assert.deepEqual(board.joins().at(-1), { id: ADA.id, name: '  Ada ' });
});

test('a refused name comes back with the reason the board gave', async () => {
  const outcome = await joinBoard({ board: board.url, id: ADA.id, name: 'Grace' });

  assert.deepEqual(outcome, { joined: false, why: 'That name is taken.' });
});

test('joining a board that cannot be reached says so instead of blowing up', async () => {
  const outcome = await joinBoard({ board: NO_BOARD, id: ADA.id, name: 'Ada' });

  assert.equal(outcome.joined, false);
  assert.equal(outcome.unreachable, true);
});

test('a posted round comes back with where the player stands', async () => {
  await joinBoard({ board: board.url, id: ADA.id, name: 'Ada' });

  const outcome = await postRound({ board: board.url, round });

  assert.equal(outcome.posted, true);
  assert.equal(outcome.standing.rank, 3);
  assert.equal(outcome.standing.players, 12);
  assert.equal(outcome.standing.best, 29583);
  assert.match(outcome.standing.url, /\?me=Ada#me$/);
  assert.deepEqual(board.rounds().at(-1), round);
});

test('a round for a profile the board does not know says how to fix that', async () => {
  const outcome = await postRound({ board: board.url, round: { ...round, profile: '99999999-9999-4999-8999-999999999999' } });

  assert.equal(outcome.posted, false);
  assert.match(outcome.why, /npx promptrizz name/);
});

test('a round that cannot be delivered is reported, never thrown', async () => {
  const outcome = await postRound({ board: NO_BOARD, round });

  assert.equal(outcome.posted, false);
  assert.match(outcome.why, /Could not reach the leaderboard/);
});

test('leaving removes the player from the board', async () => {
  await joinBoard({ board: board.url, id: ADA.id, name: 'Ada' });

  assert.equal(await leaveBoard({ board: board.url, id: ADA.id }), true);
  assert.equal(board.knows(ADA.id), false);
});

test('leaving a board that cannot be reached reports failure', async () => {
  assert.equal(await leaveBoard({ board: NO_BOARD, id: ADA.id }), false);
});
