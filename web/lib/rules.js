// What the leaderboard accepts. Everything a stranger's machine sends is checked here
// before it gets near the database or the public page.

// The holes the board knows. A real solved round of hole 1 has never been seen under
// about 20,000 tokens, so anything under minTokens is not a real round.
export const HOLES = {
  1: { title: 'fix the search crash', par: 35000, minTokens: 10000 },
};
export const MAX_TOKENS = 5_000_000;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const NAME = /^[A-Za-z0-9][A-Za-z0-9 _.-]*$/;
const MODEL = /^[A-Za-z0-9._\-[\]]{1,60}$/;
const POSING = new Set([
  'admin', 'administrator', 'moderator', 'mod', 'official', 'support', 'staff',
  'promptrizz', 'prompt rizz', 'anthropic', 'claude', 'claude code',
]);

export function isProfileId(value) {
  return typeof value === 'string' && UUID.test(value);
}

// Returns { ok: true, name } with the tidied name, or { ok: false, why }.
export function cleanName(raw) {
  if (typeof raw !== 'string') return { ok: false, why: 'A name is 2 to 20 characters long.' };
  const name = raw.trim().replace(/ +/g, ' ');
  if (name.length < 2 || name.length > 20) {
    return { ok: false, why: 'A name is 2 to 20 characters long.' };
  }
  if (!NAME.test(name)) {
    return {
      ok: false,
      why: 'A name uses letters, digits, spaces, dots, dashes and underscores, and starts with a letter or digit.',
    };
  }
  if (POSING.has(name.toLowerCase())) return { ok: false, why: 'That name is taken.' };
  return { ok: true, name };
}

// Returns { ok: true, round } holding only the fields the board keeps, or { ok: false, why }.
export function checkRound(body) {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, why: 'A round is sent as an object.' };
  }
  const { profile, hole, tokens, solved, model } = body;
  if (!isProfileId(profile)) return { ok: false, why: 'Unknown profile.' };
  if (!Number.isInteger(hole) || !HOLES[hole]) return { ok: false, why: 'Unknown hole.' };
  if (!Number.isInteger(tokens) || tokens < HOLES[hole].minTokens || tokens > MAX_TOKENS) {
    return { ok: false, why: 'That token count is not one a real round can have.' };
  }
  if (typeof solved !== 'boolean') return { ok: false, why: 'Solved must be true or false.' };
  if (typeof model !== 'string' || !MODEL.test(model)) return { ok: false, why: 'Unknown model.' };
  return { ok: true, round: { profile, hole, tokens, solved, model } };
}
