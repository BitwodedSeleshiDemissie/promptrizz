import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { createStore } from '../lib/store.js';

const schema = readFileSync(new URL('../schema.sql', import.meta.url), 'utf8');

// A real Postgres, running inside the test process, with the real schema.
// Nothing here can reach the live database.
export async function testDatabase() {
  const db = new PGlite();
  await db.exec(schema);
  const query = async (text, params) => (await db.query(text, params)).rows;
  return {
    query,
    store: createStore(query),
    empty: () => db.exec('truncate profiles cascade; truncate posts;'),
    close: () => db.close(),
  };
}

export const ID = {
  ada: '11111111-1111-4111-8111-111111111111',
  bo: '22222222-2222-4222-8222-222222222222',
  cy: '33333333-3333-4333-8333-333333333333',
};
