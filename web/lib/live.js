// The real thing: the leaderboard wired to the Neon database Vercel provides.
// Built on first use, so nothing touches the database until a request arrives.
import { neon } from '@neondatabase/serverless';
import { createApi } from './api.js';
import { createStore } from './store.js';

let api;

export function liveApi() {
  if (!api) {
    const sql = neon(process.env.DATABASE_URL);
    api = createApi({
      store: createStore((text, params) => sql.query(text, params)),
      salt: process.env.ADDRESS_SALT,
    });
  }
  return api;
}
