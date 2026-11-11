import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

// The player's profile lives on their own machine: ~/.promptrizz/profile.json.
// It is one of:
//   {}                    never asked yet
//   { id, name }          on the leaderboard; the id is what lets this machine post
//   { declined: true }    asked, and chose to play without the leaderboard
const folder = (home) => join(home, '.promptrizz');
const file = (home) => join(folder(home), 'profile.json');

export function readProfile(home = homedir()) {
  try {
    const profile = JSON.parse(readFileSync(file(home), 'utf8'));
    return profile && typeof profile === 'object' ? profile : {};
  } catch {
    return {};
  }
}

export function saveProfile(profile, home = homedir()) {
  mkdirSync(folder(home), { recursive: true });
  writeFileSync(file(home), `${JSON.stringify(profile, null, 2)}\n`, { mode: 0o600 });
}

export function forgetProfile(home = homedir()) {
  rmSync(file(home), { force: true });
}
