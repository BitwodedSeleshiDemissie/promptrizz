// The leaderboard's four addresses, as plain functions from a web Request to a Response:
//   profiles     POST   join the board or change your name      { id, name }
//                DELETE leave the board                          { id }
//   scores       POST   one finished round                       { profile, hole, tokens, solved, model }
//   leaderboard  GET    the ranking as data                      ?hole=1
//   page         GET    the ranking as a web page                ?me=<name>
import { createHash } from 'node:crypto';
import { renderPage, setupName } from './page.js';
import { checkRound, cleanName, HOLES, isProfileId } from './rules.js';

export const LIMITS = {
  joinsPerHour: 10, // new names or renames from one address
  roundsPerAddressPerHour: 120,
  roundsPerPlayerPerHour: 30,
};
const HOUR = 3600;
const BIGGEST_BODY = 2000; // characters; a real request is under 300
const SHOWN = 100;
const BRIEFLY = 'public, s-maxage=10, stale-while-revalidate=30';

const json = (status, body, headers = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', ...headers },
  });
const refuse = (status, error) => json(status, { error });
const TOO_MANY = 'Too many requests from here. Try again in a while.';

async function readBody(request) {
  const text = await request.text();
  if (text.length > BIGGEST_BODY) return { refusal: refuse(413, 'That request is too big.') };
  try {
    return { body: JSON.parse(text) };
  } catch {
    return { refusal: refuse(400, 'The request was not valid JSON.') };
  }
}

export function createApi({ store, salt }) {
  if (!salt) throw new Error('The address salt is not set.');

  // The sender's address, scrambled so it can be counted but never read back.
  const sender = (request) => {
    const address = (request.headers.get('x-forwarded-for') ?? '').split(',')[0].trim();
    return createHash('sha256').update(`${salt}|${address}`).digest('hex').slice(0, 32);
  };

  // Anything unexpected becomes a plain 500 instead of a stack trace sent to a stranger.
  const guarded = (handler) => async (request) => {
    try {
      return await handler(request);
    } catch (error) {
      console.error(error);
      return refuse(500, 'The board had a problem. Your round still counts for you.');
    }
  };

  async function join(request) {
    const { body, refusal } = await readBody(request);
    if (refusal) return refusal;
    if (!isProfileId(body?.id)) return refuse(400, 'Unknown profile.');
    const checked = cleanName(body.name);
    if (!checked.ok) return refuse(400, checked.why);
    if (!(await store.allow(`join:${sender(request)}`, LIMITS.joinsPerHour, HOUR))) {
      return refuse(429, TOO_MANY);
    }
    const outcome = await store.saveProfile({ id: body.id, name: checked.name });
    if (outcome === 'taken') return refuse(409, 'That name is taken.');
    return json(outcome === 'created' ? 201 : 200, { name: checked.name });
  }

  async function leave(request) {
    const { body, refusal } = await readBody(request);
    if (refusal) return refusal;
    if (!isProfileId(body?.id)) return refuse(400, 'Unknown profile.');
    const removed = await store.removeProfile(body.id);
    return removed ? json(200, { removed: true }) : refuse(404, 'Unknown profile.');
  }

  return {
    profiles: guarded((request) => {
      if (request.method === 'POST') return join(request);
      if (request.method === 'DELETE') return leave(request);
      return refuse(405, 'Use POST to join or DELETE to leave.');
    }),

    scores: guarded(async (request) => {
      if (request.method !== 'POST') return refuse(405, 'Use POST to send a round.');
      const { body, refusal } = await readBody(request);
      if (refusal) return refusal;
      const checked = checkRound(body);
      if (!checked.ok) return refuse(400, checked.why);
      const { round } = checked;

      if (!(await store.allow(`round:${sender(request)}`, LIMITS.roundsPerAddressPerHour, HOUR))) {
        return refuse(429, TOO_MANY);
      }
      const player = await store.findProfile(round.profile);
      if (!player) return refuse(404, 'Unknown profile.');
      if (!(await store.allow(`player:${round.profile}`, LIMITS.roundsPerPlayerPerHour, HOUR))) {
        return refuse(429, TOO_MANY);
      }

      const saved = await store.saveRound(round);
      const { rank, players } = await store.standing(round.profile, round.hole);
      const site = new URL(request.url).origin;
      return json(200, {
        name: player.name,
        ...saved,
        rank,
        players,
        url: `${site}/?me=${encodeURIComponent(player.name)}#me`,
      });
    }),

    leaderboard: guarded(async (request) => {
      const hole = Number(new URL(request.url).searchParams.get('hole') ?? 1);
      if (!HOLES[hole]) return refuse(404, 'Unknown hole.');
      const { players, entries } = await store.board(hole, SHOWN);
      return json(
        200,
        {
          hole,
          title: HOLES[hole].title,
          par: HOLES[hole].par,
          players,
          entries: entries.map((entry) => ({
            rank: entry.rank,
            name: entry.name,
            best: entry.best,
            firstTry: entry.firstSolved ? entry.firstTry : null,
            rounds: entry.rounds,
            setup: setupName(entry.model),
            at: entry.at,
          })),
        },
        { 'cache-control': BRIEFLY },
      );
    }),

    page: guarded(async (request) => {
      const hole = 1;
      const { players, entries } = await store.board(hole, SHOWN);
      const html = renderPage({
        hole: { number: hole, ...HOLES[hole] },
        players,
        entries,
        me: new URL(request.url).searchParams.get('me') ?? undefined,
      });
      return new Response(html, {
        status: 200,
        headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': BRIEFLY },
      });
    }),
  };
}
