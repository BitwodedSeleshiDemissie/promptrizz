// Creates the leaderboard's tables in the database named by DATABASE_URL.
// Safe to run again. Usage: node --env-file=.env.local scripts/migrate.js
import { readFileSync } from 'node:fs';
import { neon } from '@neondatabase/serverless';

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set. Run: vercel env pull .env.local');
  process.exit(1);
}
const sql = neon(process.env.DATABASE_URL);
const schema = readFileSync(new URL('../schema.sql', import.meta.url), 'utf8');
const statements = schema
  .split('\n')
  .filter((line) => !line.trim().startsWith('--'))
  .join('\n')
  .replace(/--.*$/gm, '')
  .split(';')
  .map((statement) => statement.trim())
  .filter(Boolean);

for (const statement of statements) {
  await sql.query(statement);
  console.log(`ok: ${statement.split('\n')[0].slice(0, 60)}`);
}
const tables = await sql.query(
  "select table_name from information_schema.tables where table_schema = 'public' order by 1",
);
console.log(`tables now: ${tables.map((t) => t.table_name).join(', ')}`);
