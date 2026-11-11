const count = (n) => n.toLocaleString('en-US');

function againstPar(tokens, par) {
  if (tokens === par) return 'on par';
  return tokens < par ? `${count(par - tokens)} under par` : `${count(tokens - par)} over par`;
}

// "claude-opus-5-5" -> "Claude Code + Opus 5.5". A dated or tagged id loses its suffix.
export function setupName(model) {
  const match = /^claude-([a-z]+)-(\d+)(?:-(\d{1,2}))?(?:-\d{8})?(?:\[.*\])?$/.exec(model);
  if (!match) return `Claude Code + ${model}`;
  const [, family, major, minor] = match;
  const name = family[0].toUpperCase() + family.slice(1);
  return `Claude Code + ${name} ${minor ? `${major}.${minor}` : major}`;
}

export function buildCard({ hole, tokens, solved, model }) {
  const you = solved
    ? `${count(tokens)} tokens  (${againstPar(tokens, hole.par)})`
    : `not solved  (${count(tokens)} tokens used)`;
  return [
    `Prompt Rizz #${hole.number}: ${hole.title}`,
    `Par:    ${count(hole.par)} tokens`,
    `You:    ${you}`,
    `Setup:  ${setupName(model)}`,
  ].join('\n');
}
