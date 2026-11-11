import { spawnSync } from 'node:child_process';

const TOOLS = {
  darwin: [['pbcopy']],
  win32: [['clip']],
  linux: [['wl-copy'], ['xclip', '-selection', 'clipboard'], ['xsel', '--clipboard', '--input']],
};

// Copies `text` with the system's clipboard tool. Returns whether it worked.
export function copyToClipboard(text, env = process.env) {
  for (const [tool, ...args] of TOOLS[process.platform] ?? TOOLS.linux) {
    const run = spawnSync(tool, args, { input: text, env, stdio: ['pipe', 'ignore', 'ignore'] });
    if (!run.error && run.status === 0) return true;
  }
  return false;
}
