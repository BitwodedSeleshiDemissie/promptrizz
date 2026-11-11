import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Tests must never reach the real leaderboard. Anything that forgets to say which
// board to use ends up at this address, where nothing listens.
export const NO_BOARD = 'http://127.0.0.1:9';
process.env.PROMPTRIZZ_BOARD = NO_BOARD;

// A stand-in for the leaderboard service, on this machine, remembering what it was sent.
// It answers the way the real one does for the cases the game has to handle.
export async function fakeBoard({ taken = [] } = {}) {
  const players = new Map(); // profile id -> name
  const sent = [];
  const nameTaken = (name, id) =>
    taken.some((t) => t.toLowerCase() === name.toLowerCase()) ||
    [...players].some(([other, n]) => other !== id && n.toLowerCase() === name.toLowerCase());

  const server = createServer(async (request, response) => {
    let text = '';
    for await (const chunk of request) text += chunk;
    const body = text ? JSON.parse(text) : undefined;
    sent.push({ method: request.method, path: request.url, body });
    const answer = (status, data) => {
      response.writeHead(status, { 'content-type': 'application/json' });
      response.end(JSON.stringify(data));
    };

    if (request.url === '/api/profiles' && request.method === 'POST') {
      const name = String(body.name).trim();
      if (name.length < 2) return answer(400, { error: 'A name is 2 to 20 characters long.' });
      if (nameTaken(name, body.id)) return answer(409, { error: 'That name is taken.' });
      const known = players.has(body.id);
      players.set(body.id, name);
      return answer(known ? 200 : 201, { name });
    }
    if (request.url === '/api/profiles' && request.method === 'DELETE') {
      return players.delete(body.id) ? answer(200, { removed: true }) : answer(404, { error: 'Unknown profile.' });
    }
    if (request.url === '/api/scores' && request.method === 'POST') {
      const name = players.get(body.profile);
      if (!name) return answer(404, { error: 'Unknown profile.' });
      return answer(200, {
        name,
        best: body.solved ? body.tokens : null,
        firstTry: body.tokens,
        firstSolved: body.solved,
        rounds: sent.filter((s) => s.path === '/api/scores').length,
        improved: body.solved,
        rank: body.solved ? 3 : null,
        players: 12,
        url: `${url}/?me=${encodeURIComponent(name)}#me`,
      });
    }
    return answer(404, { error: 'Not found.' });
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${server.address().port}`;
  return {
    url,
    sent,
    joins: () => sent.filter((s) => s.path === '/api/profiles' && s.method === 'POST').map((s) => s.body),
    rounds: () => sent.filter((s) => s.path === '/api/scores').map((s) => s.body),
    leaves: () => sent.filter((s) => s.method === 'DELETE').map((s) => s.body),
    knows: (id) => players.has(id),
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

// A throwaway home folder, optionally with a saved profile, so tests never touch the
// real one in the developer's home.
export function tempHome(profile) {
  const home = mkdtempSync(join(tmpdir(), 'promptrizz-home-'));
  if (profile) {
    mkdirSync(join(home, '.promptrizz'));
    writeFileSync(join(home, '.promptrizz', 'profile.json'), JSON.stringify(profile));
  }
  return home;
}

export function savedProfile(home) {
  try {
    return JSON.parse(readFileSync(join(home, '.promptrizz', 'profile.json'), 'utf8'));
  } catch {
    return null;
  }
}

export const ADA = { id: '11111111-1111-4111-8111-111111111111', name: 'Ada' };
export const NOT_PLAYING = { declined: true };
