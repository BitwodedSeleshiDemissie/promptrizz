// Take a player off the public board, or put them back. Their name stays taken.
// Usage: node --env-file=.env.local scripts/moderate.js hide "Some Name"
//        node --env-file=.env.local scripts/moderate.js show "Some Name"
//        node --env-file=.env.local scripts/moderate.js list
import { neon } from '@neondatabase/serverless';
import { createStore } from '../lib/store.js';

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set. Run: vercel env pull .env.local');
  process.exit(1);
}
const sql = neon(process.env.DATABASE_URL);
const store = createStore((text, params) => sql.query(text, params));
const [action, name] = process.argv.slice(2);

if (action === 'list') {
  const rows = await sql.query(
    `select p.name, p.hidden, r.best_tokens, r.first_tokens, r.rounds
     from profiles p left join results r on r.profile_id = p.id and r.hole = 1
     order by p.hidden desc, r.best_tokens asc nulls last, p.name`,
  );
  for (const row of rows) {
    console.log(
      `${row.hidden ? 'HIDDEN ' : '       '}${row.name.padEnd(22)} best ${row.best_tokens ?? '-'}  first ${row.first_tokens ?? '-'}  rounds ${row.rounds ?? 0}`,
    );
  }
  console.log(`${rows.length} players`);
} else if ((action === 'hide' || action === 'show') && name) {
  const found = await store.setHidden(name, action === 'hide');
  console.log(found ? `${name}: ${action === 'hide' ? 'hidden from' : 'shown on'} the board` : `No player is called ${name}.`);
  process.exitCode = found ? 0 : 1;
} else {
  console.error('Usage: moderate.js hide|show "<name>"   or   moderate.js list');
  process.exitCode = 1;
}
