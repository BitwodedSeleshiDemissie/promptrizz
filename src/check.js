import { spawnSync } from 'node:child_process';

// Runs the hole's own tests against the folder the agent worked in.
export function runCheck(hole, folder) {
  const run = spawnSync(process.execPath, [hole.checkFile], {
    env: { ...process.env, PROMPTRIZZ_APP: folder },
    stdio: 'ignore',
  });
  return { solved: run.status === 0 };
}
