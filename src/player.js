import { randomUUID } from 'node:crypto';
import { joinBoard } from './board.js';
import { readProfile, saveProfile } from './profile.js';

// Asks for a leaderboard name until the board accepts one. With `mayDecline`, an empty
// answer means "play without the leaderboard", and that choice is remembered.
// Returns the saved profile, or null when the player ends up without one.
export async function chooseName({ ask, print, home, board, id, question, mayDecline = false }) {
  for (;;) {
    const typed = (await ask(question)).trim();
    if (!typed) {
      if (!mayDecline) continue;
      saveProfile({ declined: true }, home);
      print('Playing without the leaderboard. To join later: npx promptrizz name');
      return null;
    }

    const outcome = await joinBoard({ board, id, name: typed });
    if (outcome.joined) {
      const profile = { id, name: outcome.name };
      saveProfile(profile, home);
      print(`You are on the leaderboard as ${outcome.name}.`);
      return profile;
    }
    if (outcome.unreachable) {
      print(outcome.why);
      return null;
    }
    print(outcome.why);
    question = 'Name: ';
  }
}

// Says, before any name is asked for, exactly what being on the leaderboard sends.
export function explainBoard({ print, board }) {
  print(`Prompt Rizz has a public leaderboard: ${board}`);
  print('Pick a name to be on it. After every round the game then sends your name, your');
  print('token count, whether the round was solved, and the model. Nothing else, and');
  print('never your instruction.');
  print('');
}

// Who is playing, as far as the leaderboard goes. The first run on a machine explains
// what the leaderboard gets and asks once; after that the saved answer is used.
// Returns { id, name }, or null for someone playing without the leaderboard.
export async function findPlayer({ ask, print, home, board }) {
  const profile = readProfile(home);
  if (profile.id) return profile;
  if (profile.declined) return null;

  explainBoard({ print, board });
  const player = await chooseName({
    ask,
    print,
    home,
    board,
    id: randomUUID(),
    question: 'Name (or just Enter to play without the leaderboard): ',
    mayDecline: true,
  });
  if (!player && !readProfile(home).declined) print('Playing without it this time.');
  print('');
  return player;
}
