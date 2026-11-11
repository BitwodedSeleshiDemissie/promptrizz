import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadHole } from '../src/hole.js';
import { playRound } from '../src/round.js';
import { claudeResult, fakeClaude, tokens } from './helpers/fake-claude.js';

const fix = fileURLToPath(new URL('./fixtures/001-fix/', import.meta.url));
const used31200 = claudeResult({ 'claude-opus-5-5': tokens(10, 200, 30000, 990) });

// The person at the keyboard: types the given answers, sees what is printed,
// and has a clipboard (unless told otherwise).
function player(answers, { clipboard = true } = {}) {
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
  };
}

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
