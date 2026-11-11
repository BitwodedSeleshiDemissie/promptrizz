import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { checkAgent, runAgent } from '../src/agent.js';
import { claudeResult, fakeClaude, tokens } from './helpers/fake-claude.js';

const newFolder = () => mkdtempSync(join(tmpdir(), 'agent-test-'));

test('the instruction reaches Claude Code, which runs inside the throwaway folder', async () => {
  const claude = fakeClaude();
  const folder = newFolder();

  await runAgent({ instruction: 'fix the empty search', folder, command: claude.command });

  assert.equal(claude.call().instruction, 'fix the empty search');
  assert.equal(claude.call().cwd, realpathSync(folder));
});

test('an instruction that looks like a flag is still only an instruction', async () => {
  const claude = fakeClaude();

  await runAgent({ instruction: '--help', folder: newFolder(), command: claude.command });

  assert.equal(claude.call().instruction, '--help');
  assert.ok(!claude.call().argv.includes('--help'));
});

test('the agent gets file tools only and cannot be asked for more', async () => {
  const claude = fakeClaude();

  await runAgent({ instruction: 'fix it', folder: newFolder(), command: claude.command });

  const { argv } = claude.call();
  assert.ok(argv.includes('--restricted'), 'runs in restricted mode');
  assert.equal(argv[argv.indexOf('--tools') + 1], 'Read,Edit,Write,Glob,Grep');
  assert.equal(argv[argv.indexOf('--permission-prompts') + 1], 'none');
});

test('the score is every kind of token added up', async () => {
  const claude = fakeClaude({ result: claudeResult({ 'claude-opus-5-5': tokens(2, 4, 3807, 2843) }) });

  const round = await runAgent({ instruction: 'fix it', folder: newFolder(), command: claude.command });

  assert.equal(round.tokens, 6656);
  assert.equal(round.model, 'claude-opus-5-5');
});

test('tokens from every model count, and the busiest model names the setup', async () => {
  const claude = fakeClaude({
    result: claudeResult({
      'claude-haiku-5-5': tokens(100, 50, 0, 0),
      'claude-opus-5-5': tokens(10, 200, 30000, 990),
    }),
  });

  const round = await runAgent({ instruction: 'fix it', folder: newFolder(), command: claude.command });

  assert.equal(round.tokens, 31350);
  assert.equal(round.model, 'claude-opus-5-5');
});

test('a missing Claude Code is explained in plain words', async () => {
  await assert.rejects(
    runAgent({ instruction: 'fix it', folder: newFolder(), command: 'no-such-claude-command' }),
    /Claude Code was not found/,
  );
});

test("a failed run passes on Claude Code's own message", async () => {
  const claude = fakeClaude({
    result: { type: 'result', is_error: true, result: 'Credit balance is too low' },
    exitCode: 1,
  });

  await assert.rejects(
    runAgent({ instruction: 'fix it', folder: newFolder(), command: claude.command }),
    /Credit balance is too low/,
  );
});

test('a Claude Code too old to know the options is told to update, in plain words', async () => {
  const claude = fakeClaude({ raw: "error: unknown option '--restricted'", exitCode: 1 });

  await assert.rejects(
    runAgent({ instruction: 'fix it', folder: newFolder(), command: claude.command }),
    /needs a newer Claude Code.*claude update/s,
  );
});

test('checking for Claude Code passes when it is installed, without starting any work', async () => {
  const claude = fakeClaude();

  await checkAgent(claude.command);

  assert.equal(claude.wasRun(), false);
});

test('checking for Claude Code explains when it is missing', async () => {
  await assert.rejects(checkAgent('no-such-claude-command'), /Claude Code was not found/);
});

test('output that is not a result is reported, not scored', async () => {
  const claude = fakeClaude({ raw: 'something went sideways', exitCode: 1 });

  await assert.rejects(
    runAgent({ instruction: 'fix it', folder: newFolder(), command: claude.command }),
    /something went sideways/,
  );
});
