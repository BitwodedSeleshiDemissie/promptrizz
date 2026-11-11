// The public leaderboard page, built on the server as one HTML string.
// It is drawn as a golf tournament scoreboard: a green band, pale slats, the score
// against par in golf's red for under par, and a yellow pin flag on the visitor's row.

const count = (n) => n.toLocaleString('en-US');

// Everything that came from a player goes through here before it touches the page.
const text = (value) =>
  String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

// "claude-opus-5-5" -> "Claude Code + Opus 5.5". Same wording as the score card.
export function setupName(model) {
  const match = /^claude-([a-z]+)-(\d+)(?:-(\d{1,2}))?(?:-\d{8})?(?:\[.*\])?$/.exec(model);
  if (!match) return `Claude Code + ${model}`;
  const [, family, major, minor] = match;
  return `Claude Code + ${family[0].toUpperCase()}${family.slice(1)} ${minor ? `${major}.${minor}` : major}`;
}

// A score against par, the way a golf board writes it: −5,417, +2,100, or E for even.
export function toPar(tokens, par) {
  if (tokens === par) return { text: 'E', side: 'even' };
  return tokens < par
    ? { text: `−${count(par - tokens)}`, side: 'under' }
    : { text: `+${count(tokens - par)}`, side: 'over' };
}

const FLAG =
  '<svg class="flag" viewBox="0 0 16 20" aria-hidden="true"><path d="M3 1v18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M4 2l10 3.5L4 9z" fill="var(--flag)"/></svg>';

function row(entry, par, isMe) {
  const against = toPar(entry.best, par);
  const first = entry.firstSolved ? count(entry.firstTry) : 'not solved';
  const setup = text(setupName(entry.model));
  const rounds = entry.rounds === 1 ? '1 round' : `${count(entry.rounds)} rounds`;
  return `<tr class="player${isMe ? ' me' : ''}"${isMe ? ' id="me"' : ''}>
        <td class="pos">${entry.rank}</td>
        <td class="name">${isMe ? FLAG : ''}<span class="who">${text(entry.name)}</span>${isMe ? ' <span class="you">you</span>' : ''}
          <span class="small">first try ${first}, ${rounds}</span>
          <span class="small">${setup}</span></td>
        <td class="par ${against.side}">${against.text}<span class="tok">${count(entry.best)} tokens</span></td>
        <td class="num wide">${count(entry.best)}</td>
        <td class="num wide">${first}</td>
        <td class="num wide">${count(entry.rounds)}</td>
        <td class="wide setup">${setup}</td>
      </tr>`;
}

function board({ hole, entries, me }) {
  if (entries.length === 0) {
    return `<p class="empty">Nobody has solved hole ${hole.number} yet. Be the first: run <code>npx promptrizz</code>.</p>`;
  }
  const mine = me?.toLowerCase();
  return `<table>
      <caption>Hole ${hole.number}, ranked by best score. Fewest tokens first.</caption>
      <thead>
        <tr>
          <th scope="col" class="pos">Pos</th>
          <th scope="col">Player</th>
          <th scope="col" class="num">To par</th>
          <th scope="col" class="num wide">Tokens</th>
          <th scope="col" class="num wide">First try</th>
          <th scope="col" class="num wide">Rounds</th>
          <th scope="col" class="wide">Setup</th>
        </tr>
      </thead>
      <tbody>
      ${entries.map((entry) => row(entry, hole.par, entry.name.toLowerCase() === mine)).join('\n      ')}
      </tbody>
    </table>`;
}

export function renderPage({ hole, players, entries, me }) {
  const playing = players === 1 ? '1 player' : `${count(players)} players`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Prompt Rizz leaderboard</title>
<meta name="description" content="Golf for people who code with AI agents. Same bug, one instruction, fewest tokens wins. See who is leading.">
<meta property="og:title" content="Prompt Rizz leaderboard">
<meta property="og:description" content="Same bug, one instruction, fewest tokens wins. ${playing} on the board.">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 20'%3E%3Cpath d='M3 1v18' stroke='%231d5a3a' stroke-width='2' stroke-linecap='round'/%3E%3Cpath d='M4 2l10 3.5L4 9z' fill='%23f4c430'/%3E%3C/svg%3E">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Barlow:wght@400;500;600&family=Barlow+Condensed:wght@500;600;700&display=swap">
<style>
  :root {
    --turf: #1d5a3a;
    --turf-deep: #154630;
    --on-turf: #f3faf5;
    --on-turf-soft: #bcd9c6;
    --ground: #e3ece5;
    --slat: #fbfdfb;
    --ink: #13211a;
    --soft: #51645a;
    --line: #c7d6cb;
    --under: #c4122f;
    --flag: #f4c430;
    --body: 'Barlow', system-ui, sans-serif;
    --board: 'Barlow Condensed', 'Barlow', system-ui, sans-serif;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --turf: #174a31;
      --turf-deep: #103623;
      --ground: #0d2017;
      --slat: #14301f;
      --ink: #e7f1ea;
      --soft: #9bb3a3;
      --line: #23493a;
      --under: #ff6f83;
    }
  }
  * { box-sizing: border-box; }
  html { -webkit-text-size-adjust: 100%; }
  body {
    margin: 0;
    background: var(--ground);
    color: var(--ink);
    font: 400 1.0625rem/1.5 var(--body);
  }
  .wrap { max-width: 62rem; margin: 0 auto; padding: 0 1.25rem; }
  a { color: inherit; text-underline-offset: 0.18em; }
  :focus-visible { outline: 3px solid var(--flag); outline-offset: 2px; }
  code { font-family: ui-monospace, 'SF Mono', Menlo, Consolas, monospace; font-size: 0.92em; }

  /* The band: what this is, how to play, which hole. */
  .band { background: var(--turf); color: var(--on-turf); padding: 2.75rem 0 0; }
  h1 {
    margin: 0;
    font: 700 clamp(3.25rem, 11vw, 6rem)/0.9 var(--board);
    letter-spacing: -0.01em;
  }
  .pitch { margin: 1rem 0 1.5rem; max-width: 34rem; font-size: 1.1875rem; color: var(--on-turf); }
  .play { display: flex; flex-wrap: wrap; align-items: stretch; gap: 0.5rem; margin-bottom: 2.25rem; }
  .play code {
    display: flex; align-items: center;
    padding: 0.6rem 0.9rem;
    background: var(--turf-deep); border-radius: 4px;
    font-size: 1.0625rem; color: var(--on-turf);
  }
  .play code::before { content: '$'; margin-right: 0.6rem; color: var(--on-turf-soft); }
  .play button {
    padding: 0.6rem 1rem; border: 0; border-radius: 4px; cursor: pointer;
    background: var(--flag); color: #1b1a12;
    font: 600 1rem var(--body);
  }
  .play button:hover { filter: brightness(1.06); }
  .facts {
    display: flex; flex-wrap: wrap; gap: 0.35rem 2.5rem;
    margin: 0; padding: 0.85rem 0;
    border-top: 1px solid rgb(255 255 255 / 0.22);
    font: 500 1.1875rem var(--board); letter-spacing: 0.01em;
  }
  .facts div { display: flex; gap: 0.5rem; }
  .facts dt { color: var(--on-turf-soft); }
  .facts dd { margin: 0; }

  /* The board: one slat per player. */
  main { padding-top: 1.5rem; padding-bottom: 4rem; }
  table { width: 100%; border-collapse: separate; border-spacing: 0 3px; }
  caption { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
  th {
    padding: 0.25rem 0.85rem; text-align: left; vertical-align: bottom;
    font: 500 1rem var(--board); letter-spacing: 0.02em; color: var(--soft);
  }
  td { padding: 0.6rem 0.85rem; background: var(--slat); vertical-align: middle; }
  td:first-child { border-radius: 3px 0 0 3px; }
  td:last-child { border-radius: 0 3px 3px 0; }
  .num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .pos { width: 3.25rem; text-align: right; }
  td.pos { font: 600 1.25rem var(--board); color: var(--soft); }
  .name { font-weight: 600; }
  .name .small { display: none; font-weight: 400; font-size: 0.9375rem; color: var(--soft); }
  td.par { text-align: right; white-space: nowrap; font: 700 1.75rem/1 var(--board); font-variant-numeric: tabular-nums; }
  td.par.under { color: var(--under); }
  .tok { display: none; margin-top: 0.3rem; font: 400 0.9375rem/1.2 var(--body); color: var(--soft); }
  .setup { color: var(--soft); white-space: nowrap; }
  .me td { box-shadow: inset 0 2px 0 var(--flag), inset 0 -2px 0 var(--flag); }
  .me td:first-child { box-shadow: inset 2px 0 0 var(--flag), inset 0 2px 0 var(--flag), inset 0 -2px 0 var(--flag); }
  .me td:last-child { box-shadow: inset -2px 0 0 var(--flag), inset 0 2px 0 var(--flag), inset 0 -2px 0 var(--flag); }
  .flag { width: 0.8rem; height: 1rem; margin-right: 0.45rem; vertical-align: -0.1rem; color: var(--ink); }
  .you { margin-left: 0.35rem; font-weight: 400; color: var(--soft); }
  #me { scroll-margin-top: 30vh; }
  .empty { margin: 2rem 0; padding: 2rem 1.25rem; background: var(--slat); border-radius: 3px; font-size: 1.1875rem; }

  /* The small print. */
  .notes { margin-top: 2.75rem; max-width: 40rem; color: var(--soft); }
  .notes h2 { margin: 1.75rem 0 0.25rem; font: 600 1.375rem var(--board); color: var(--ink); }
  .notes p { margin: 0; }

  @media (max-width: 44rem) {
    .wide { display: none; }
    .name .small { display: block; }
    .pos { width: 2.25rem; }
    td, th { padding-left: 0.6rem; padding-right: 0.6rem; }
    td.par { font-size: 1.5rem; }
    .tok { display: block; }
    td:nth-child(3) { border-radius: 0 3px 3px 0; }
    .me td:nth-child(3) { box-shadow: inset -2px 0 0 var(--flag), inset 0 2px 0 var(--flag), inset 0 -2px 0 var(--flag); }
  }
</style>
</head>
<body>
<header class="band">
  <div class="wrap">
    <h1>Prompt Rizz</h1>
    <p class="pitch">Everyone gets the same bug and one instruction for their AI agent. Fewest tokens wins.</p>
    <div class="play">
      <code id="command">npx promptrizz</code>
      <button type="button" id="copy">Copy</button>
    </div>
    <dl class="facts">
      <div><dt>Hole</dt><dd>${hole.number}, ${text(hole.title)}</dd></div>
      <div><dt>Par</dt><dd>${count(hole.par)} tokens</dd></div>
      <div><dt>On the board</dt><dd>${playing}</dd></div>
    </dl>
  </div>
</header>
<main class="wrap">
    ${board({ hole, entries, me })}
  <section class="notes">
    <h2>Scores are not checked</h2>
    <p>The game posts each score from the player's own machine when a round ends. Nobody verifies them, so read this as a friendly board and not a referee's.</p>
    <h2>Best and first try</h2>
    <p>Best is a player's cheapest solved round. First try is their very first round, and it stays for good.</p>
    <h2>Your name</h2>
    <p>You pick a name the first time you play. Change it with <code>npx promptrizz name</code>, or leave the board with <code>npx promptrizz leave</code>.</p>
    <h2>Open source</h2>
    <p>The game and this board are on <a href="https://github.com/BitwodedSeleshiDemissie/promptrizz">GitHub</a>.</p>
  </section>
</main>
<script>
  document.getElementById('copy').addEventListener('click', async (event) => {
    await navigator.clipboard.writeText('npx promptrizz');
    event.target.textContent = 'Copied';
    setTimeout(() => { event.target.textContent = 'Copy'; }, 1500);
  });
</script>
</body>
</html>
`;
}
