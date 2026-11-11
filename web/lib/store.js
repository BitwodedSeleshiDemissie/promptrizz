// Everything the leaderboard reads from or writes to Postgres.
// `query(text, params)` runs one SQL statement and returns its rows. Every operation
// here is a single statement, so each one is all-or-nothing without a transaction.

const NAME_TAKEN = '23505'; // Postgres: unique violation

const ON_BOARD = `r.hole = $1 and r.best_tokens is not null and not p.hidden`;

export function createStore(query) {
  return {
    // Gives the player this name. Returns 'created', 'renamed' or 'taken'.
    async saveProfile({ id, name }) {
      try {
        const [row] = await query(
          `insert into profiles (id, name, name_key) values ($1::uuid, $2::text, lower($2::text))
           on conflict (id) do update set name = excluded.name, name_key = excluded.name_key
           returning (xmax = 0) as created`,
          [id, name],
        );
        return row.created ? 'created' : 'renamed';
      } catch (error) {
        if (error.code === NAME_TAKEN) return 'taken';
        throw error;
      }
    },

    async findProfile(id) {
      const [row] = await query('select id, name, hidden from profiles where id = $1::uuid', [id]);
      return row ?? null;
    },

    // Removes the player and, with them, their scores. Returns whether there was one.
    async removeProfile(id) {
      const rows = await query('delete from profiles where id = $1::uuid returning id', [id]);
      return rows.length > 0;
    },

    // Moderation: takes a player off the board (or puts them back). The name stays theirs.
    async setHidden(name, hidden) {
      const rows = await query(
        'update profiles set hidden = $2::boolean where name_key = lower($1::text) returning id',
        [name, hidden],
      );
      return rows.length > 0;
    },

    // Records one round. The first round of a hole is kept as the first try for good;
    // the best is the cheapest solved round so far.
    async saveRound({ profile, hole, tokens, solved, model }) {
      const [row] = await query(
        `with before as (
           select best_tokens from results where profile_id = $1::uuid and hole = $2::int
         ), saved as (
           insert into results as r
             (profile_id, hole, first_tokens, first_solved, best_tokens, best_model, best_at)
           values
             ($1::uuid, $2::int, $3::int, $4::boolean,
              case when $4::boolean then $3::int end,
              case when $4::boolean then $5::text end,
              case when $4::boolean then now() end)
           on conflict (profile_id, hole) do update set
             rounds = r.rounds + 1,
             updated_at = now(),
             best_tokens = case when $4::boolean and (r.best_tokens is null or $3::int < r.best_tokens)
                                then $3::int else r.best_tokens end,
             best_model  = case when $4::boolean and (r.best_tokens is null or $3::int < r.best_tokens)
                                then $5::text else r.best_model end,
             best_at     = case when $4::boolean and (r.best_tokens is null or $3::int < r.best_tokens)
                                then now() else r.best_at end
           returning first_tokens, first_solved, best_tokens, rounds
         )
         select saved.*,
                $4::boolean and coalesce($3::int < (select best_tokens from before), true) as improved
         from saved`,
        [profile, hole, tokens, solved, model],
      );
      return {
        firstTry: row.first_tokens,
        firstSolved: row.first_solved,
        best: row.best_tokens,
        rounds: row.rounds,
        improved: row.improved,
      };
    },

    // The public ranking of one hole: fewest tokens first, earlier first on a tie.
    // `players` counts everyone on the board, not only the rows returned.
    async board(hole, limit = 100) {
      const rows = await query(
        `select p.name, r.best_tokens, r.best_model, r.best_at, r.first_tokens, r.first_solved, r.rounds,
                (count(*) over ())::int as players
         from results r join profiles p on p.id = r.profile_id
         where ${ON_BOARD}
         order by r.best_tokens asc, r.best_at asc
         limit $2::int`,
        [hole, limit],
      );
      return {
        players: rows[0]?.players ?? 0,
        entries: rows.map((row, index) => ({
          rank: index + 1,
          name: row.name,
          best: row.best_tokens,
          model: row.best_model,
          firstTry: row.first_tokens,
          firstSolved: row.first_solved,
          rounds: row.rounds,
          at: new Date(row.best_at).toISOString(),
        })),
      };
    },

    // Where one player stands on a hole. No solved round, or hidden: no rank.
    async standing(profileId, hole) {
      const [row] = await query(
        `select
           (select count(*) from results r join profiles p on p.id = r.profile_id where ${ON_BOARD})::int
             as players,
           (select case when me.best_tokens is null or mine.hidden then null else 1 + (
                select count(*) from results r join profiles p on p.id = r.profile_id
                where ${ON_BOARD}
                  and (r.best_tokens < me.best_tokens
                       or (r.best_tokens = me.best_tokens and r.best_at < me.best_at)))::int end
            from results me join profiles mine on mine.id = me.profile_id
            where me.hole = $1 and me.profile_id = $2::uuid) as rank`,
        [hole, profileId],
      );
      return { rank: row.rank, players: row.players };
    },

    // Rate limit. Counts this sender's accepted posts inside the window; under the limit
    // the post is noted and let through. Also throws away records older than a day.
    async allow(who, limit, windowSeconds) {
      const [row] = await query(
        `with purge as (delete from posts where at < now() - interval '1 day'),
              seen as (select count(*)::int as n from posts
                       where who = $1::text and at > now() - make_interval(secs => $3::double precision)),
              note as (insert into posts (who) select $1::text where (select n from seen) < $2::int)
         select (select n from seen) < $2::int as allowed`,
        [who, limit, windowSeconds],
      );
      return row.allowed;
    },
  };
}
