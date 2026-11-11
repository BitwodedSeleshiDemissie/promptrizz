import { randomUUID } from 'node:crypto';
import { leaveBoard } from './board.js';
import { chooseName, explainBoard } from './player.js';
import { readProfile, saveProfile } from './profile.js';

// `npx promptrizz name`: pick a leaderboard name, or change the one you have.
// A changed name keeps the same scores. Returns the exit code.
export async function nameCommand({ ask, print, home, board }) {
  const profile = readProfile(home);
  if (profile.id) {
    print(`You are on the leaderboard as ${profile.name}.`);
  } else {
    explainBoard({ print, board });
  }
  const player = await chooseName({
    ask,
    print,
    home,
    board,
    id: profile.id ?? randomUUID(),
    question: profile.id ? 'New name: ' : 'Name: ',
  });
  if (!player) print('Nothing was changed.');
  return player ? 0 : 1;
}

// `npx promptrizz leave`: delete your name and scores from the board, and stop posting.
export async function leaveCommand({ print, home, board }) {
  const profile = readProfile(home);
  if (!profile.id) {
    print('You are not on the leaderboard.');
    return 0;
  }
  if (!(await leaveBoard({ board, id: profile.id }))) {
    print('Could not reach the leaderboard, so nothing was removed. Try again in a while.');
    return 1;
  }
  saveProfile({ declined: true }, home);
  print('You are off the leaderboard, and your scores there are deleted.');
  print('To join again: npx promptrizz name');
  return 0;
}

export function usage(board) {
  return [
    'Prompt Rizz: same bug, one instruction, fewest tokens wins.',
    '',
    '  npx promptrizz          play a round',
    '  npx promptrizz name     pick or change your leaderboard name',
    '  npx promptrizz leave    leave the leaderboard and delete your scores there',
    '  npx promptrizz help     show this',
    '',
    `Leaderboard: ${board}`,
  ].join('\n');
}
