import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { basename, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadHole } from '../src/hole.js';
import { playRound } from '../src/round.js';
import { joinBoard } from '../src/board.js';
import { ADA, fakeBoard, NO_BOARD, NOT_PLAYING, savedProfile, tempHome } from './helpers/fake-board.js';
import { claudeResult, fakeClaude, tokens } from './helpers/fake-claude.js';

const fix = fileURLToPath(new URL('./fixtures/001-fix/', import.meta.url));
const used31200 = claudeResult({ 'claude-opus-5-5': tokens(10, 200, 30000, 990) });

// The person at the keyboard: types the given answers, sees what is printed,
// and has a clipboard (unless told otherwise). Unless a test says so, they have chosen
// to play without the leaderboard, and no leaderboard can be reached.
function player(answers, { clipboard = true, home = tempHome(NOT_PLAYING), board = NO_BOARD } = {}) {
  const seen = [];
  const questions = [];
  const clipboardHolds = [];
  return {
    seen,
    questions,
    clipboardHolds,
    ask: async (question) => {
      questions.push({ question, seenSoFar: seen.join('\n') });
      return answers.shift();
    },
    print: (line) => seen.push(line),
    copy: (text) => {
      if (clipboard) clipboardHolds.push(text);
      return clipboard;
    },
    progress: () => () => {},
    home,
    board,
  };
}

test('without Claude Code the player is told before being shown or asked anything', async () => {
  const me = player(['fix it']);

  await assert.rejects(playRound({ ...me, command: 'no-such-claude-command' }), /Claude Code was not found/);

  assert.equal(me.questions.length, 0);
  assert.deepEqual(me.seen, []);
});

test('the player is not shown where the code is until the round is over', async () => {
  const claude = fakeClaude();
  const me = player(['fix it']);

  await playRound({ ...me, command: claude.command });

  const folderName = basename(claude.call().cwd);
  assert.ok(!me.questions[0].seenSoFar.includes(folderName), 'not before the instruction');
  assert.ok(me.seen.at(-2).includes(folderName), 'but after the card');
});

test('the round ends by saying how to play again', async () => {
  const me = player(['fix it']);

  await playRound({ ...me, command: fakeClaude().command });

  assert.match(me.seen.at(-1), /npx promptrizz/);
});

test('the player sees a working sign for exactly as long as the agent works', async () => {
  const claude = fakeClaude();
  const me = player(['fix it']);
  const moments = [];
  const progress = (text) => {
    moments.push([`up: ${text}`, claude.wasRun()]);
    return () => moments.push(['down', claude.wasRun()]);
  };

  await playRound({ ...me, progress, command: claude.command });

  assert.deepEqual(moments, [
    ['up: Your agent is working. You do nothing else.', false],
    ['down', true],
  ]);
});

test('the working sign comes down even when the agent fails', async () => {
  const claude = fakeClaude({ result: { type: 'result', is_error: true, result: 'Credit balance is too low' }, exitCode: 1 });
  const me = player(['fix it']);
  const moments = [];
  const progress = () => {
    moments.push('up');
    return () => moments.push('down');
  };

  await assert.rejects(playRound({ ...me, progress, command: claude.command }), /Credit balance/);

  assert.deepEqual(moments, ['up', 'down']);
});

test('the task and the usual cost are shown before the instruction is asked for', async () => {
  const hole = loadHole();
  const me = player(['fix the empty search']);

  await playRound({ ...me, command: fakeClaude().command });

  const { seenSoFar } = me.questions[0];
  assert.ok(seenSoFar.includes(hole.task));
  assert.ok(seenSoFar.includes(`${hole.par.toLocaleString('en-US')} tokens`));
});

test('the agent gets the typed instruction and works on a throwaway copy of the app', async () => {
  const claude = fakeClaude();
  const me = player(['fix the empty search']);

  await playRound({ ...me, command: claude.command });

  const { instruction, cwd } = claude.call();
  assert.equal(instruction, 'fix the empty search');
  assert.ok(existsSync(join(cwd, 'server.js')), 'the agent ran where the app is');
  assert.notEqual(cwd, loadHole().appDir);
});

test('when the agent fixes the app, the round ends with a solved card on the clipboard', async () => {
  const claude = fakeClaude({ result: used31200, copyInto: fix });
  const me = player(['fix the empty search']);

  await playRound({ ...me, command: claude.command });

  const [card] = me.clipboardHolds;
  assert.match(card, /^Prompt Rizz #1: fix the search crash$/m);
  assert.match(card, /^You: {4}31,200 tokens {2}\(/m);
  assert.match(card, /^Setup: {2}Claude Code \+ Opus 5\.5$/m);
  assert.ok(me.seen.includes(card), 'the card is also shown');
});

test('when the agent changes nothing, the round ends with a not-solved card', async () => {
  const claude = fakeClaude({ result: used31200 });
  const me = player(['please make it better']);

  await playRound({ ...me, command: claude.command });

  assert.match(me.clipboardHolds[0], /^You: {4}not solved {2}\(31,200 tokens used\)$/m);
});

test('an empty line is not an instruction, so the player is asked again', async () => {
  const claude = fakeClaude();
  const me = player(['', '   ', 'fix it']);

  await playRound({ ...me, command: claude.command });

  assert.equal(me.questions.length, 3);
  assert.equal(claude.call().instruction, 'fix it');
});

test('without a clipboard the card is shown but never called copied', async () => {
  const me = player(['fix it'], { clipboard: false });

  await playRound({ ...me, command: fakeClaude().command });

  assert.ok(me.seen.some((line) => /^Prompt Rizz #1/.test(line)), 'the card is shown');
  assert.ok(!me.seen.some((line) => /copied/i.test(line)));
});

// --- the leaderboard ---------------------------------------------------------

const said = (me, pattern) => me.seen.some((line) => pattern.test(line));

test('the first time, the player is told what the leaderboard gets before being asked for a name', async () => {
  const board = await fakeBoard();
  const me = player(['Ada', 'fix it'], { home: tempHome(), board: board.url });

  await playRound({ ...me, command: fakeClaude().command });
  await board.close();

  const { question, seenSoFar } = me.questions[0];
  assert.match(question, /Name/);
  assert.match(seenSoFar, /public leaderboard/);
  assert.match(seenSoFar, /your name/);
  assert.match(seenSoFar, /token count/);
  assert.match(seenSoFar, /never your instruction/);
});

test('the chosen name is kept on this machine and the round is posted under it', async () => {
  const board = await fakeBoard();
  const home = tempHome();
  const me = player(['Ada', 'fix the empty search'], { home, board: board.url });

  await playRound({ ...me, command: fakeClaude({ result: used31200, copyInto: fix }).command });
  await board.close();

  const profile = savedProfile(home);
  assert.equal(profile.name, 'Ada');
  assert.match(profile.id, /^[0-9a-f-]{36}$/);
  assert.deepEqual(board.joins(), [{ id: profile.id, name: 'Ada' }]);
  assert.deepEqual(board.rounds(), [
    { profile: profile.id, hole: 1, tokens: 31200, solved: true, model: 'claude-opus-5-5' },
  ]);
});

test('the instruction the player typed is never sent to the leaderboard', async () => {
  const board = await fakeBoard();
  const me = player(['Ada', 'my secret instruction'], { home: tempHome(), board: board.url });

  await playRound({ ...me, command: fakeClaude().command });
  await board.close();

  assert.ok(!JSON.stringify(board.sent).includes('my secret instruction'));
});

test('after a solved round the player sees their rank and the link to their row', async () => {
  const board = await fakeBoard();
  const me = player(['Ada', 'fix it'], { home: tempHome(), board: board.url });

  await playRound({ ...me, command: fakeClaude({ result: used31200, copyInto: fix }).command });
  await board.close();

  assert.ok(said(me, /^Leaderboard: #3 of 12\. Your best: 31,200 tokens\.$/));
  assert.ok(me.seen.includes(`Your row: ${board.url}/?me=Ada#me`));
});

test('an unsolved round is posted too, and claims no rank', async () => {
  const board = await fakeBoard();
  const me = player(['Ada', 'do nothing'], { home: tempHome(), board: board.url });

  await playRound({ ...me, command: fakeClaude({ result: used31200 }).command });
  await board.close();

  assert.equal(board.rounds()[0].solved, false);
  assert.ok(said(me, /no rank yet/));
  assert.ok(!said(me, /^Your row:/));
});

test('just pressing Enter at the name question plays without the leaderboard, and is remembered', async () => {
  const board = await fakeBoard();
  const home = tempHome();
  const first = player(['', 'fix it'], { home, board: board.url });
  const second = player(['fix it again'], { home, board: board.url });

  await playRound({ ...first, command: fakeClaude().command });
  await playRound({ ...second, command: fakeClaude().command });
  await board.close();

  assert.deepEqual(board.sent, []);
  assert.deepEqual(savedProfile(home), { declined: true });
  assert.ok(said(first, /npx promptrizz name/), 'told how to join later');
  assert.equal(second.questions.length, 1, 'not asked for a name again');
});

test('a name that is taken is asked for again, with the reason', async () => {
  const board = await fakeBoard({ taken: ['Grace'] });
  const home = tempHome();
  const me = player(['Grace', 'Ada', 'fix it'], { home, board: board.url });

  await playRound({ ...me, command: fakeClaude().command });
  await board.close();

  assert.ok(said(me, /That name is taken\./));
  assert.equal(savedProfile(home).name, 'Ada');
});

test('a player who already has a name is not asked again, and their rounds are posted', async () => {
  const board = await fakeBoard();
  await joinBoard({ board: board.url, ...ADA });
  const me = player(['fix it'], { home: tempHome(ADA), board: board.url });

  await playRound({ ...me, command: fakeClaude().command });
  await board.close();

  assert.equal(me.questions.length, 1);
  assert.equal(board.rounds()[0].profile, ADA.id);
});

test('with the leaderboard unreachable on the first run, the round is played and nothing is saved', async () => {
  const home = tempHome();
  const me = player(['Ada', 'fix it'], { home, board: NO_BOARD });

  await playRound({ ...me, command: fakeClaude().command });

  assert.ok(said(me, /Could not reach the leaderboard/));
  assert.ok(said(me, /^Prompt Rizz #1/), 'the card is still shown');
  assert.equal(savedProfile(home), null, 'so the name is asked again next time');
});

test('when posting fails the card still stands and the player is told', async () => {
  const me = player(['fix it'], { home: tempHome(ADA), board: NO_BOARD });

  await playRound({ ...me, command: fakeClaude().command });

  assert.ok(said(me, /^Prompt Rizz #1/));
  assert.ok(said(me, /this round was not posted/));
});

test('a player who chose to stay off the leaderboard sends nothing at all', async () => {
  const board = await fakeBoard();
  const me = player(['fix it'], { home: tempHome(NOT_PLAYING), board: board.url });

  await playRound({ ...me, command: fakeClaude().command });
  await board.close();

  assert.deepEqual(board.sent, []);
});
