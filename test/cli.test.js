import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { claudeResult, fakeClaude, pathWithOnly, tokens } from './helpers/fake-claude.js';

const game = fileURLToPath(new URL('../bin/promptrizz.js', import.meta.url));
const fix = fileURLToPath(new URL('./fixtures/001-fix/', import.meta.url));

// Runs the real command the way a player would, typing `typed` at the prompt.
function play({ path, typed }) {
  return spawnSync(process.execPath, [game], {
    input: typed,
    env: { ...process.env, PATH: path },
    encoding: 'utf8',
  });
}

test('one command plays a whole round and ends with the score card', { skip: process.platform === 'win32' }, () => {
  const claude = fakeClaude({
    result: claudeResult({ 'claude-opus-5-5': tokens(10, 200, 30000, 990) }),
    copyInto: fix,
  });

  const round = play({ path: pathWithOnly(claude.dir), typed: 'fix the empty search\n' });

  assert.equal(round.status, 0, round.stderr);
  assert.match(round.stdout, /^Prompt Rizz #1: fix the search crash$/m);
  assert.match(round.stdout, /^You: {4}31,200 tokens {2}\(/m);
  assert.equal(claude.call().instruction, 'fix the empty search');
});

test('without Claude Code installed, it explains and stops', () => {
  const round = play({ path: pathWithOnly(), typed: 'fix it\n' });

  assert.equal(round.status, 1);
  assert.match(round.stderr, /Claude Code was not found/);
  assert.doesNotMatch(round.stdout, /Your one instruction/);
});

test('the command says the agent is working while the player waits', { skip: process.platform === 'win32' }, () => {
  const round = play({ path: pathWithOnly(fakeClaude().dir), typed: 'fix it\n' });

  assert.match(round.stdout, /^Your agent is working\. You do nothing else\.$/m);
});

test('when nothing is typed, it stops instead of starting the agent', { skip: process.platform === 'win32' }, () => {
  const claude = fakeClaude();

  const round = play({ path: pathWithOnly(claude.dir), typed: '' });

  assert.equal(round.status, 1);
  assert.match(round.stderr, /No instruction was typed/);
  assert.throws(() => claude.call(), 'the agent was never started');
});
