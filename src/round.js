import { checkAgent, runAgent } from './agent.js';
import { buildCard } from './card.js';
import { runCheck } from './check.js';
import { loadHole, setUpFolder } from './hole.js';

// One round: show the task, take one instruction, let the agent work, check, score.
// The player sees the task but not the code. Where the agent worked is only told
// afterwards, so the score comes from the instruction and not from reading ahead.
export async function playRound({ ask, print, copy, progress, command }) {
  await checkAgent(command);
  const hole = loadHole();
  const folder = setUpFolder(hole);

  print(`Prompt Rizz #${hole.number}: ${hole.title}`);
  print('');
  print(hole.task);
  print('');
  print(`A round usually costs about ${hole.par.toLocaleString('en-US')} tokens. Fewest tokens wins.`);
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
  print(`What your agent did is in: ${folder}`);
  print('Play again: npx promptrizz');
}
