import { boardUrl } from './board.js';
import { leaveCommand, nameCommand, usage } from './commands.js';
import { playRound } from './round.js';

// What `npx promptrizz [word]` does. Returns the exit code.
export async function main({ args, ask, print, copy, progress, home, board = boardUrl() }) {
  const [word] = args;
  if (!word) {
    await playRound({ ask, print, copy, progress, home, board });
    return 0;
  }
  if (word === 'name') return nameCommand({ ask, print, home, board });
  if (word === 'leave') return leaveCommand({ print, home, board });
  print(usage(board));
  return ['help', '--help', '-h'].includes(word) ? 0 : 1;
}
