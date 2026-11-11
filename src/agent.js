import { spawn } from 'node:child_process';

// Every player gets the same clean, confined Claude Code session:
// no shell, file tools that cannot leave the folder, and none of the player's own
// settings, skills, plugins, hooks or MCP servers. Nothing can ask for more.
const SESSION = [
  '--print',
  '--output-format', 'json',
  '--restricted',
  '--safe-mode',
  '--strict-mcp-config',
  '--disable-slash-commands',
  '--tools', 'Read,Edit,Write,Glob,Grep',
  '--permission-mode', 'acceptEdits',
  '--permission-prompts', 'none',
  '--no-session-persistence',
];

const NOT_FOUND = 'Claude Code was not found. Install it, then run Prompt Rizz again.';
const TOO_OLD =
  'Prompt Rizz needs a newer Claude Code than the one installed. ' +
  'Update it with `claude update`, then run this again.';

function readResult(stdout, stderr) {
  let result;
  try {
    result = JSON.parse(stdout);
  } catch {
    const said = (stderr || stdout).trim();
    if (/unknown option/i.test(said)) throw new Error(TOO_OLD);
    throw new Error(`Claude Code did not finish the round: ${said}`);
  }
  if (result.is_error) throw new Error(`Claude Code did not finish the round: ${result.result}`);

  const perModel = Object.entries(result.modelUsage).map(([model, used]) => ({
    model,
    tokens:
      used.inputTokens + used.outputTokens + used.cacheReadInputTokens + used.cacheCreationInputTokens,
  }));
  const busiest = perModel.reduce((a, b) => (b.tokens > a.tokens ? b : a));
  return { tokens: perModel.reduce((sum, m) => sum + m.tokens, 0), model: busiest.model };
}

// Runs one hands-off Claude Code session in `folder` with the player's one instruction.
// The instruction goes in through standard input, so it can never be read as a flag.
export function runAgent({ instruction, folder, command = 'claude' }) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, SESSION, { cwd: folder });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => (stdout += chunk));
    child.stderr.on('data', (chunk) => (stderr += chunk));
    child.on('error', (error) => reject(error.code === 'ENOENT' ? new Error(NOT_FOUND) : error));
    child.on('close', () => {
      try {
        resolve(readResult(stdout, stderr));
      } catch (error) {
        reject(error);
      }
    });
    child.stdin.on('error', () => {});
    child.stdin.end(instruction);
  });
}

// Fails early, before the player has typed anything, if Claude Code is not installed.
// Asking for the version starts no session and spends no tokens.
export function checkAgent(command = 'claude') {
  return new Promise((resolve, reject) => {
    const child = spawn(command, ['--version'], { stdio: 'ignore' });
    child.on('error', (error) => reject(error.code === 'ENOENT' ? new Error(NOT_FOUND) : error));
    child.on('close', () => resolve());
  });
}
