// Talks to the public leaderboard. Nothing here ever throws: a board that is down or
// slow must never break a round, so every call reports what happened instead.

// Where the board lives. PROMPTRIZZ_BOARD points the game at another one (used by the tests).
export const boardUrl = () => process.env.PROMPTRIZZ_BOARD ?? 'https://promptrizz.vercel.app';

const UNREACHABLE = 'Could not reach the leaderboard';

// Returns { status, data }, or null when the board could not be reached at all.
async function call(board, method, path, body) {
  try {
    const response = await fetch(board + path, {
      method,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(8000),
    });
    const data = await response.json().catch(() => ({}));
    return { status: response.status, data };
  } catch {
    return null;
  }
}

// Asks for a name on the board (or a new name for an id that is already there).
// -> { joined: true, name } | { joined: false, why } | { joined: false, unreachable: true, why }
export async function joinBoard({ board = boardUrl(), id, name }) {
  const answer = await call(board, 'POST', '/api/profiles', { id, name });
  if (!answer || answer.status >= 500) return { joined: false, unreachable: true, why: `${UNREACHABLE}.` };
  if (answer.status === 200 || answer.status === 201) return { joined: true, name: answer.data.name };
  return { joined: false, why: answer.data.error ?? 'The leaderboard refused that name.' };
}

// Sends one finished round.
// -> { posted: true, standing } | { posted: false, why }
export async function postRound({ board = boardUrl(), round }) {
  const answer = await call(board, 'POST', '/api/scores', round);
  if (!answer || answer.status >= 500) {
    return { posted: false, why: `${UNREACHABLE}, so this round was not posted.` };
  }
  if (answer.status === 200) return { posted: true, standing: answer.data };
  if (answer.status === 404) {
    return {
      posted: false,
      why: 'The leaderboard does not know this profile any more. Join again with: npx promptrizz name',
    };
  }
  return { posted: false, why: `The leaderboard did not take this round: ${answer.data.error ?? answer.status}` };
}

// Removes the player and their scores from the board. -> whether they are now gone
// from it (a board that never knew them counts: there is nothing left to remove).
export async function leaveBoard({ board = boardUrl(), id }) {
  const answer = await call(board, 'DELETE', '/api/profiles', { id });
  return Boolean(answer) && (answer.status === 200 || answer.status === 404);
}
