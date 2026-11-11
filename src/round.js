import { checkAgent, runAgent } from './agent.js';
import { boardUrl, postRound } from './board.js';
import { buildCard } from './card.js';
import { runCheck } from './check.js';
import { loadHole, setUpFolder } from './hole.js';
import { findPlayer } from './player.js';

const count = (n) => n.toLocaleString('en-US');

// Sends the finished round to the leaderboard and says where the player stands.
// A board that is down only costs the player this one line.
async function postToBoard({ print, board, player, hole, round, solved }) {
  const outcome = await postRound({
    board,
    round: { profile: player.id, hole: hole.number, tokens: round.tokens, solved, model: round.model },
  });
  if (!outcome.posted) {
    print(outcome.why);
    return;
  }
  const { rank, players, best, url } = outcome.standing;
  if (!rank) {
    print('Leaderboard: no rank yet. A solved round puts you on the board.');
    return;
  }
  print(`Leaderboard: #${rank} of ${players}. Your best: ${count(best)} tokens.`);
  print(`Your row: ${url}`);
}

// One round: show the task, take one instruction, let the agent work, check, score.
// The player sees the task but not the code. Where the agent worked is only told
// afterwards, so the score comes from the instruction and not from reading ahead.
export async function playRound({ ask, print, copy, progress, command, home, board = boardUrl() }) {
  await checkAgent(command);
  const player = await findPlayer({ ask, print, home, board });
  const hole = loadHole();
  const folder = setUpFolder(hole);

  print(`Prompt Rizz #${hole.number}: ${hole.title}`);
  print('');
  print(hole.task);
  print('');
  print(`A round usually costs about ${count(hole.par)} tokens. Fewest tokens wins.`);
  print('Your agent (Claude Code) gets a throwaway copy of the app. You get one instruction.');
  print('');

  let instruction = '';
  while (!instruction) instruction = (await ask('Your one instruction: ')).trim();

  print('');
  const stopProgress = progress('Your agent is working. You do nothing else.');
  let round;
  try {
    round = await runAgent({ instruction, folder, command });
  } finally {
    stopProgress();
  }

  print('Checking the fix.');
  const { solved } = runCheck(hole, folder);

  const card = buildCard({ hole, tokens: round.tokens, solved, model: round.model });
  print('');
  print(card);
  print('');
  if (copy(card)) print('Card copied. Paste it anywhere.');
  if (player) await postToBoard({ print, board, player, hole, round, solved });
  print(`What your agent did is in: ${folder}`);
  print('Play again: npx promptrizz');
}
