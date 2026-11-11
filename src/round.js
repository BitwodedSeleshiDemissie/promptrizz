import { runAgent } from './agent.js';
import { buildCard } from './card.js';
import { runCheck } from './check.js';
import { loadHole, setUpFolder } from './hole.js';

// One round: show the task, take one instruction, let the agent work, check, score.
export async function playRound({ ask, print, copy, command }) {
  const hole = loadHole();
  const folder = setUpFolder(hole);

  print(`Prompt Rizz #${hole.number}: ${hole.title}`);
  print('');
  print(hole.task);
  print('');
  print(`A round usually costs about ${hole.par.toLocaleString('en-US')} tokens. Fewest tokens wins.`);
  print(`Your agent (Claude Code) works in a throwaway copy of the app: ${folder}`);
  print('');

  let instruction = '';
  while (!instruction) instruction = (await ask('Your one instruction: ')).trim();

  print('');
  print('Your agent is working. You do nothing else.');
  const { tokens, model } = await runAgent({ instruction, folder, command });

  print('Checking the fix.');
  const { solved } = runCheck(hole, folder);

  const card = buildCard({ hole, tokens, solved, model });
  print('');
  print(card);
  if (copy(card)) {
    print('');
    print('Card copied. Paste it anywhere.');
  }
}
