import { existsSync, mkdtempSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';

// A stand-in `claude` program, so tests never spend real tokens.
// Asked for its version, it answers like Claude Code does. Asked to work, it notes how
// it was called, optionally copies files into the folder it runs in (to play an agent
// that edits the app), then prints what Claude Code would print.
export function fakeClaude({ result = claudeResult(), raw = null, exitCode = 0, copyInto = null } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'fake-claude-'));
  const record = join(dir, 'call.json');
  const output = raw ?? JSON.stringify(result);
  const script = `#!/usr/bin/env node
const fs = require('node:fs');
if (process.argv.includes('--version')) {
  process.stdout.write('2.1.322 (Claude Code)\\n');
} else {
  const instruction = fs.readFileSync(0, 'utf8');
  fs.writeFileSync(${JSON.stringify(record)}, JSON.stringify({ cwd: process.cwd(), argv: process.argv.slice(2), instruction }));
  ${copyInto ? `fs.cpSync(${JSON.stringify(copyInto)}, process.cwd(), { recursive: true });` : ''}
  process.stdout.write(${JSON.stringify(output)});
  process.exitCode = ${exitCode};
}
`;
  const command = join(dir, 'claude');
  writeFileSync(command, script, { mode: 0o755 });
  return {
    dir,
    command,
    // Whether it was ever asked to work (a version check does not count).
    wasRun: () => existsSync(record),
    call: () => JSON.parse(readFileSync(record, 'utf8')),
  };
}

export function tokens(input, output, cacheRead, cacheWrite) {
  return {
    inputTokens: input,
    outputTokens: output,
    cacheReadInputTokens: cacheRead,
    cacheCreationInputTokens: cacheWrite,
  };
}

export function claudeResult(modelUsage = { 'claude-opus-5-5': tokens(10, 200, 30000, 990) }) {
  return { type: 'result', subtype: 'success', is_error: false, result: 'Done.', modelUsage };
}

// A PATH that holds only the given folders plus node itself, so a test can never reach
// the real `claude` or the real clipboard by accident.
export function pathWithOnly(...dirs) {
  const nodeDir = mkdtempSync(join(tmpdir(), 'only-node-'));
  symlinkSync(process.execPath, join(nodeDir, 'node'));
  return [...dirs, nodeDir].join(delimiter);
}
