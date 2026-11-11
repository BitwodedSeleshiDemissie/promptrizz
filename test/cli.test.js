import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { joinBoard } from '../src/board.js';
import { ADA, fakeBoard, NO_BOARD, NOT_PLAYING, savedProfile, tempHome } from './helpers/fake-board.js';
import { claudeResult, fakeClaude, pathWithOnly, tokens } from './helpers/fake-claude.js';

const game = fileURLToPath(new URL('../bin/promptrizz.js', import.meta.url));
const fix = fileURLToPath(new URL('./fixtures/001-fix/', import.meta.url));
const posix = { skip: process.platform === 'win32' };

// Runs the real command the way a player would: `args` after its name, `typed` at the
// prompts. Unless a test says otherwise the player stays off the leaderboard, and the
// only board that exists is one that cannot be reached.
function run({ args = [], typed = '', claude = fakeClaude(), path, home = tempHome(NOT_PLAYING), board = NO_BOARD } = {}) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [game, ...args], {
      env: {
        ...process.env,
        PATH: path ?? pathWithOnly(claude.dir),
        HOME: home,
        USERPROFILE: home,
        PROMPTRIZZ_BOARD: board,
      },
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => (stdout += chunk));
    child.stderr.on('data', (chunk) => (stderr += chunk));
    child.on('close', (status) => resolve({ status, stdout, stderr }));
    child.stdin.end(typed);
  });
}

const solvedFor31200 = () =>
  fakeClaude({ result: claudeResult({ 'claude-opus-5-5': tokens(10, 200, 30000, 990) }), copyInto: fix });

// --- playing -------------------------------------------------------------------

test('one command plays a whole round and ends with the score card', posix, async () => {
  const claude = solvedFor31200();

  const round = await run({ claude, typed: 'fix the empty search\n' });

  assert.equal(round.status, 0, round.stderr);
  assert.match(round.stdout, /^Prompt Rizz #1: fix the search crash$/m);
  assert.match(round.stdout, /^You: {4}31,200 tokens {2}\(/m);
  assert.equal(claude.call().instruction, 'fix the empty search');
});

test('without Claude Code installed, it explains and stops', async () => {
  const round = await run({ path: pathWithOnly(), typed: 'fix it\n' });

  assert.equal(round.status, 1);
  assert.match(round.stderr, /Claude Code was not found/);
  assert.doesNotMatch(round.stdout, /Your one instruction/);
});

test('the command says the agent is working while the player waits', posix, async () => {
  const round = await run({ typed: 'fix it\n' });

  assert.match(round.stdout, /^Your agent is working\. You do nothing else\.$/m);
});

test('when nothing is typed, it stops instead of starting the agent', posix, async () => {
  const claude = fakeClaude();

  const round = await run({ claude, typed: '' });

  assert.equal(round.status, 1);
  assert.match(round.stderr, /Nothing was typed/);
  assert.equal(claude.wasRun(), false);
});

test('on a first run, a name and then an instruction are typed, and the round lands on the board', posix, async () => {
  const board = await fakeBoard();
  const home = tempHome();

  const round = await run({ claude: solvedFor31200(), home, board: board.url, typed: 'Ada\nfix the empty search\n' });
  await board.close();

  assert.equal(round.status, 0, round.stderr);
  assert.equal(savedProfile(home).name, 'Ada');
  assert.equal(board.rounds().length, 1);
  assert.equal(board.rounds()[0].tokens, 31200);
  assert.match(round.stdout, /^Leaderboard: #3 of 12\. Your best: 31,200 tokens\.$/m);
});

test('a round on a machine with a saved name asks only for the instruction and posts by itself', posix, async () => {
  const board = await fakeBoard();
  await joinBoard({ board: board.url, ...ADA });

  const round = await run({ home: tempHome(ADA), board: board.url, typed: 'fix it\n' });
  await board.close();

  assert.equal(round.status, 0, round.stderr);
  assert.doesNotMatch(round.stdout, /Name/);
  assert.equal(board.rounds()[0].profile, ADA.id);
});

// --- the name --------------------------------------------------------------------

test('"name" lets a player on the board change their name, keeping their scores', async () => {
  const board = await fakeBoard();
  await joinBoard({ board: board.url, ...ADA });
  const home = tempHome(ADA);

  const result = await run({ args: ['name'], home, board: board.url, typed: 'Countess\n' });
  await board.close();

  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(board.joins().at(-1), { id: ADA.id, name: 'Countess' });
  assert.deepEqual(savedProfile(home), { id: ADA.id, name: 'Countess' });
  assert.match(result.stdout, /You are on the leaderboard as Countess\./);
});

test('"name" lets someone who stayed off the board join later, after telling them what is sent', async () => {
  const board = await fakeBoard();
  const home = tempHome(NOT_PLAYING);

  const result = await run({ args: ['name'], home, board: board.url, typed: 'Ada\n' });
  await board.close();

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /token count/);
  assert.equal(savedProfile(home).name, 'Ada');
  assert.equal(board.joins().length, 1);
});

test('"name" with a taken name asks again and says why', async () => {
  const board = await fakeBoard({ taken: ['Grace'] });
  const home = tempHome();

  const result = await run({ args: ['name'], home, board: board.url, typed: 'Grace\nAda\n' });
  await board.close();

  assert.match(result.stdout, /That name is taken\./);
  assert.equal(savedProfile(home).name, 'Ada');
});

test('"name" changes nothing when the board cannot be reached', async () => {
  const home = tempHome(ADA);

  const result = await run({ args: ['name'], home, board: NO_BOARD, typed: 'Countess\n' });

  assert.equal(result.status, 1);
  assert.match(result.stdout, /Could not reach the leaderboard/);
  assert.deepEqual(savedProfile(home), ADA);
});

// --- leaving ---------------------------------------------------------------------

test('"leave" takes the player off the board and stops later rounds from posting', posix, async () => {
  const board = await fakeBoard();
  await joinBoard({ board: board.url, ...ADA });
  const home = tempHome(ADA);

  const left = await run({ args: ['leave'], home, board: board.url });
  const round = await run({ home, board: board.url, typed: 'fix it\n' });
  await board.close();

  assert.equal(left.status, 0, left.stderr);
  assert.deepEqual(board.leaves(), [{ id: ADA.id }]);
  assert.match(left.stdout, /off the leaderboard/);
  assert.deepEqual(savedProfile(home), { declined: true });
  assert.equal(round.status, 0, round.stderr);
  assert.equal(board.rounds().length, 0);
});

test('"leave" for someone who is not on the board just says so', async () => {
  const board = await fakeBoard();

  const result = await run({ args: ['leave'], home: tempHome(NOT_PLAYING), board: board.url });
  await board.close();

  assert.equal(result.status, 0);
  assert.match(result.stdout, /not on the leaderboard/);
  assert.deepEqual(board.sent, []);
});

test('"leave" keeps the profile when the board cannot be reached, so it can be tried again', async () => {
  const home = tempHome(ADA);

  const result = await run({ args: ['leave'], home, board: NO_BOARD });

  assert.equal(result.status, 1);
  assert.match(result.stdout, /Could not reach the leaderboard/);
  assert.deepEqual(savedProfile(home), ADA);
});

// --- help ------------------------------------------------------------------------

test('"help" lists what the command can do and where the board is', async () => {
  const result = await run({ args: ['help'], board: 'https://board.example' });

  assert.equal(result.status, 0);
  for (const line of [/npx promptrizz +play/, /npx promptrizz name/, /npx promptrizz leave/, /https:\/\/board\.example/]) {
    assert.match(result.stdout, line);
  }
});

test('a word the command does not know shows the help and fails', async () => {
  const result = await run({ args: ['dance'] });

  assert.equal(result.status, 1);
  assert.match(result.stdout, /npx promptrizz name/);
});
