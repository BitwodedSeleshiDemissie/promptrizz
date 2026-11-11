-- Prompt Rizz leaderboard. Safe to run again: every statement is "if not exists".

-- One row per player. The id is made on the player's machine and never shown;
-- it is what lets only that machine post under the name.
create table if not exists profiles (
  id          uuid primary key,
  name        text not null,
  name_key    text not null unique,          -- the name in lower case: names are unique whatever the capitals
  hidden      boolean not null default false, -- moderation: hidden players stay off the board, their name stays taken
  created_at  timestamptz not null default now()
);

-- One row per player per hole: their first try, and their best solved round.
create table if not exists results (
  profile_id    uuid not null references profiles(id) on delete cascade,
  hole          integer not null,
  first_tokens  integer not null,
  first_solved  boolean not null,
  best_tokens   integer,                      -- null until a round is solved
  best_model    text,
  best_at       timestamptz,
  rounds        integer not null default 1,
  updated_at    timestamptz not null default now(),
  primary key (profile_id, hole)
);
create index if not exists results_board on results (hole, best_tokens, best_at);

-- Only for limiting how often one sender can post. "who" is a scrambled address or a
-- profile id, never a readable address. Rows older than a day are thrown away.
create table if not exists posts (
  who  text not null,
  at   timestamptz not null default now()
);
create index if not exists posts_who_at on posts (who, at);
create index if not exists posts_at on posts (at);
