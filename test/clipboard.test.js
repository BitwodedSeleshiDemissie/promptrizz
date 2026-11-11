import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { copyToClipboard } from '../src/clipboard.js';
import { pathWithOnly } from './helpers/fake-claude.js';

// Stand-ins for each system's clipboard tool: whatever they are handed lands in a file.
function fakeClipboardTools() {
  const dir = mkdtempSync(join(tmpdir(), 'fake-clipboard-'));
  const pasted = join(dir, 'pasted.txt');
  const script = `#!/usr/bin/env node
const fs = require('node:fs');
fs.writeFileSync(${JSON.stringify(pasted)}, fs.readFileSync(0));
`;
  for (const tool of ['pbcopy', 'wl-copy', 'xclip', 'xsel']) {
    writeFileSync(join(dir, tool), script, { mode: 0o755 });
  }
  return { dir, pasted: () => readFileSync(pasted, 'utf8') };
}

test('the text lands on the clipboard', { skip: process.platform === 'win32' }, () => {
  const tools = fakeClipboardTools();

  const copied = copyToClipboard('Prompt Rizz #1\nYou:    31,200 tokens', {
    PATH: pathWithOnly(tools.dir),
  });

  assert.equal(copied, true);
  assert.equal(tools.pasted(), 'Prompt Rizz #1\nYou:    31,200 tokens');
});

test('with no clipboard tool around, it reports that nothing was copied', () => {
  assert.equal(copyToClipboard('anything', { PATH: pathWithOnly() }), false);
});
