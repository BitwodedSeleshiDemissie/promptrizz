import { cpSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HOLE = fileURLToPath(new URL('../holes/001-search-crash/', import.meta.url));

export function loadHole() {
  const { number, title, task, par } = JSON.parse(readFileSync(join(HOLE, 'hole.json'), 'utf8'));
  return {
    number,
    title,
    task,
    par,
    appDir: join(HOLE, 'app'),
    checkFile: join(HOLE, 'check', 'check.js'),
  };
}

// A fresh throwaway copy of the app. Only the app goes in: the check stays with the game.
export function setUpFolder(hole) {
  const folder = mkdtempSync(join(tmpdir(), 'promptrizz-'));
  cpSync(hole.appDir, folder, { recursive: true });
  return folder;
}
