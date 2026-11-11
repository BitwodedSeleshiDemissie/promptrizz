// Decides whether hole 1 is solved. Starts the app found in PROMPTRIZZ_APP the way a
// person would (node server.js) and searches it over HTTP, so any working fix passes
// no matter how the code inside was changed.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { setTimeout as sleep } from 'node:timers/promises';

const appFolder = process.env.PROMPTRIZZ_APP;
const EVERY_BOOK = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

async function freePort() {
  const probe = createServer().listen(0, '127.0.0.1');
  await once(probe, 'listening');
  const { port } = probe.address();
  probe.close();
  return port;
}

async function startApp(t) {
  const port = await freePort();
  const app = spawn(process.execPath, ['server.js'], {
    cwd: appFolder,
    env: { ...process.env, PORT: String(port) },
    stdio: 'ignore',
  });
  t.after(() => app.kill());
  const address = `http://127.0.0.1:${port}`;

  for (let attempt = 0; attempt < 30; attempt += 1) {
    assert.equal(app.exitCode, null, 'the app stopped before it could be searched');
    try {
      await fetch(address, { signal: AbortSignal.timeout(1000) });
      return address;
    } catch {
      await sleep(100);
    }
  }
  assert.fail('the app did not start');
}

async function search(address, words) {
  const response = await fetch(`${address}/api/search?q=${encodeURIComponent(words)}`, {
    signal: AbortSignal.timeout(3000),
  });
  assert.equal(response.status, 200);
  const books = await response.json();
  return books.map((book) => book.id).sort((a, b) => a - b);
}

test('an empty search lists every book', async (t) => {
  const app = await startApp(t);

  assert.deepEqual(await search(app, ''), EVERY_BOOK);
});

test('the app keeps working after an empty search', async (t) => {
  const app = await startApp(t);
  await search(app, '').catch(() => {});

  assert.deepEqual(await search(app, 'lantern'), [1]);
});

test('a word from a title still finds that book', async (t) => {
  const app = await startApp(t);

  assert.deepEqual(await search(app, 'orchard'), [3, 8]);
});

test('an author still finds their books, in any letter case', async (t) => {
  const app = await startApp(t);

  assert.deepEqual(await search(app, 'MIRA okafor'), [1, 3]);
});

test('words that match nothing still find nothing', async (t) => {
  const app = await startApp(t);

  assert.deepEqual(await search(app, 'zebra'), []);
});
