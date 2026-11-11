// The public page, built on the server as one HTML string.
// It is loud on purpose: the game is called Prompt Rizz and the whole joke is saying
// less. Token-yellow ground, meme-caption wordmark, a terminal replaying a real round,
// and a board where the best players have the shortest bars.

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

// How much rizz a score has. Fewer tokens, more rizz; over par by a lot, you yap.
const LEVELS = [
  { key: 'unspoken', name: 'Unspoken rizz', upTo: (par) => par - 10000, says: (par) => `${count(par - 10000)} tokens or fewer` },
  { key: 'w', name: 'W rizz', upTo: (par) => par - 5000, says: (par) => `up to ${count(par - 5000)}` },
  { key: 'rizz', name: 'Rizz', upTo: (par) => par - 1, says: () => 'anything under par' },
  { key: 'mid', name: 'Mid', upTo: (par) => par + 5000, says: (par) => `par to ${count(par + 5000)}` },
  { key: 'yapper', name: 'Yapper', upTo: () => Infinity, says: (par) => `over ${count(par + 5000)}` },
];

export function rizz(tokens, par) {
  const { key, name } = LEVELS.find((level) => tokens <= level.upTo(par));
  return { key, name };
}

const percent = (part, whole) => Math.max(2, Math.min(100, Math.round((part / whole) * 1000) / 10));

function row(entry, par, scale, isMe) {
  const against = toPar(entry.best, par);
  const level = rizz(entry.best, par);
  const first = entry.firstSolved ? count(entry.firstTry) : 'not solved';
  const rounds = entry.rounds === 1 ? '1 round' : `${count(entry.rounds)} rounds`;
  return `<li class="row is-${level.key}${isMe ? ' me' : ''}"${isMe ? ' id="me"' : ''}>
        <span class="rank">${entry.rank}</span>
        <div class="player">
          <span class="who">${text(entry.name)}</span>${isMe ? '<span class="you">you</span>' : ''}
          <span class="level level-${level.key}">${level.name}</span>
          <span class="meta">first try ${first}, ${rounds}, ${text(setupName(entry.model).replace('Claude Code + ', ''))}</span>
        </div>
        <div class="meter" aria-hidden="true"><span class="fill fill-${against.side}" style="width:${percent(entry.best, scale)}%"></span><span class="tick" style="left:${percent(par, scale)}%"></span></div>
        <span class="tokens">${count(entry.best)} <small>tokens</small></span>
        <span class="topar ${against.side}">${against.text}</span>
      </li>`;
}

const parLine = (par) => `<li class="parline"><span>par ${count(par)}</span></li>`;

function tally({ hole, players, played, entries }) {
  const rounds = played === 1 ? '1 round played' : `${count(played)} rounds played`;
  if (entries.length === 0) {
    return `<p class="tally">Nobody has solved hole ${hole.number} yet.${played ? ` ${rounds}, none solved.` : ''}</p>`;
  }
  const best = entries[0].best;
  const against = toPar(best, hole.par);
  const how = against.side === 'even' ? 'level with par' : `${against.text.slice(1)} ${against.side} par`;
  return `<p class="tally"><b>${players === 1 ? '1 player' : `${count(players)} players`}</b> on the board. Best so far: <b>${count(best)} tokens</b>, ${how}. ${rounds}.</p>`;
}

// The board on its own: the line of facts and the ranked rows. The page refreshes
// this part every few seconds without reloading.
export function renderBoard({ hole, players, played, entries, me }) {
  if (entries.length === 0) {
    return `${tally({ hole, players, played, entries })}
    <ol class="board">
      <li class="ghost"><span class="rank">1</span><div class="player"><span class="who">your name here</span><span class="meta">Be the first: run <code>npx promptrizz</code></span></div></li>
      ${parLine(hole.par)}
    </ol>`;
  }
  const mine = me?.toLowerCase();
  const scale = Math.max(hole.par * 1.4, ...entries.map((entry) => entry.best));
  const firstOver = entries.findIndex((entry) => entry.best >= hole.par);
  const cut = firstOver === -1 ? entries.length : firstOver;
  const items = entries.map((entry) => row(entry, hole.par, scale, entry.name.toLowerCase() === mine));
  items.splice(cut, 0, parLine(hole.par));
  return `${tally({ hole, players, played, entries })}
    <ol class="board">
      ${items.join('\n      ')}
    </ol>`;
}

// A real round, replayed in the hero. The instruction and the score are from a round
// that was actually played; the page types it out again for whoever is watching.
const DEMO_INSTRUCTION =
  'Empty search crashes the app. Find the cause reading as few files as possible, make an empty search return every book, then stop. No explanation.';

const demo = (hole) => `<span data-s>$ npx promptrizz
</span><span data-s><b>Prompt Rizz #${hole.number}: ${text(hole.title)}</b>
</span><span data-s>
This tiny book-search app crashes when the search box is empty.
Fix it: an empty search should list every book.
</span><span data-s>
A round usually costs about ${count(hole.par)} tokens. Fewest tokens wins.
</span><span data-s>
Your one instruction: </span><span data-s data-type>${text(DEMO_INSTRUCTION)}
</span><span data-s>
Your agent is working. You do nothing else. </span><span data-s data-count="17">17s
</span><span data-s>Checking the fix.
</span><span data-s class="card">
Prompt Rizz #${hole.number}: ${text(hole.title)}
Par:    ${count(hole.par)} tokens
You:    29,583 tokens  (${count(hole.par - 29583)} under par)
Setup:  Claude Code + Fable 5.2
</span><span data-s>
Card copied. Paste it anywhere.</span>`;

const levels = (par) =>
  LEVELS.map(
    (level) =>
      `<li><span class="level level-${level.key}">${level.name}</span><span>${level.says(par)}</span></li>`,
  ).join('\n        ');

export function renderPage({ hole, players, played, entries, me }) {
  const playing = players === 1 ? '1 player' : `${count(players)} players`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Prompt Rizz: say less, fewest tokens wins</title>
<meta name="description" content="Everyone gets the same bug and one instruction for their AI agent. Fewest tokens wins. See who has the most rizz.">
<meta property="og:title" content="Prompt Rizz: say less, fewest tokens wins">
<meta property="og:description" content="Same bug, one instruction, fewest tokens wins. ${playing} on the board.">
<meta name="theme-color" content="#ffd60a">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' fill='%23ffd60a'/%3E%3Ctext x='16' y='25' text-anchor='middle' font-family='Impact,Arial Black,sans-serif' font-size='26' fill='%23000'%3ER%3C/text%3E%3C/svg%3E">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Anton&family=Bricolage+Grotesque:opsz,wght@12..96,400;12..96,600;12..96,800&family=JetBrains+Mono:wght@400;700&display=swap">
<style>
  :root {
    --ground: #ffd60a;
    --line: #000;
    --text: #000;
    --quiet: rgb(0 0 0 / 0.64);
    --block: #fff;
    --pop: #ff2e93;
    --link: #2440ff;
    --term: #000;
    --term-text: #f6f3e7;
    --word-fill: #fff;
    --word-shadow: #000;
    --display: 'Anton', Impact, 'Arial Narrow', sans-serif;
    --body: 'Bricolage Grotesque', system-ui, sans-serif;
    --mono: 'JetBrains Mono', ui-monospace, 'SF Mono', Menlo, Consolas, monospace;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --ground: #000;
      --line: #ffd60a;
      --text: #f6f3e7;
      --quiet: rgb(246 243 231 / 0.66);
      --block: #141414;
      --pop: #ff4fa3;
      --link: #93a4ff;
      --term: #141414;
      --word-fill: #ffd60a;
      --word-shadow: #ff2e93;
    }
  }
  * { box-sizing: border-box; }
  html { -webkit-text-size-adjust: 100%; scroll-behavior: smooth; }
  body { margin: 0; background: var(--ground); color: var(--text); font: 400 1.125rem/1.5 var(--body); }
  .wrap { max-width: 72rem; margin: 0 auto; padding: 0 1.25rem; }
  a { color: inherit; text-decoration-thickness: 2px; text-underline-offset: 0.2em; }
  a:hover { color: var(--link); }
  :focus-visible { outline: 3px solid var(--link); outline-offset: 3px; }
  code { font-family: var(--mono); font-size: 0.9em; }
  h2 { margin: 0 0 1.25rem; font: 400 clamp(2.25rem, 5vw, 3.25rem)/1 var(--display); text-transform: uppercase; letter-spacing: 0.01em; }

  /* Top: where the code lives. */
  .top { display: flex; justify-content: flex-end; gap: 1.25rem; padding: 1rem 0 0; font-weight: 600; font-size: 1rem; }

  /* Hero: the name, the pitch, the command, and a real round playing in a terminal. */
  .hero { display: grid; grid-template-columns: minmax(0, 1.05fr) minmax(0, 0.95fr); gap: 3rem; align-items: center; padding: 1.5rem 0 4rem; }
  .hero > div:first-child { container-type: inline-size; }
  .word {
    position: relative; margin: 0;
    font: 400 clamp(4rem, 28.5cqw, 10.75rem)/0.86 var(--display);
    text-transform: uppercase; letter-spacing: 0.005em;
    color: var(--word-fill);
    -webkit-text-stroke: 0.032em #000;
    paint-order: stroke fill;
    text-shadow: 0.05em 0.05em 0 var(--word-shadow);
  }
  .word span { display: block; }
  .sticker {
    position: absolute; left: 16.6em; top: 6.9em;
    display: grid; place-items: center;
    width: 5.6em; aspect-ratio: 1; border-radius: 50%;
    background: var(--pop); color: #fff; border: 3px solid #000; box-shadow: 4px 4px 0 #000;
    font: 400 0.135em/0.95 var(--display); font-style: normal; letter-spacing: 0.02em; text-align: center;
    -webkit-text-stroke: 0; text-shadow: none; transform: rotate(12deg);
  }
  .tag { margin: 1.75rem 0 0.5rem; font-weight: 800; font-size: clamp(1.5rem, 2.6vw, 2rem); line-height: 1.15; }
  .pitch { margin: 0 0 1.5rem; max-width: 30rem; }
  .play { display: flex; flex-wrap: wrap; gap: 0.75rem; }
  .play code {
    display: flex; align-items: center; padding: 0.75rem 1.1rem;
    background: var(--term); color: #ffd60a; border: 3px solid var(--line); box-shadow: 5px 5px 0 var(--line);
    font-size: 1.125rem; font-weight: 700;
  }
  .play code::before { content: '$'; margin-right: 0.7rem; color: var(--term-text); opacity: 0.6; }
  button {
    padding: 0.75rem 1.2rem; cursor: pointer;
    background: var(--block); color: var(--text); border: 3px solid var(--line); box-shadow: 5px 5px 0 var(--line);
    font: 800 1.0625rem var(--body);
  }
  button:hover { background: var(--pop); color: #fff; }
  button:active { transform: translate(3px, 3px); box-shadow: 2px 2px 0 var(--line); }

  .term { background: var(--term); border: 3px solid var(--line); box-shadow: 9px 9px 0 var(--pop); }
  .termbar { display: flex; align-items: center; gap: 0.4rem; padding: 0.6rem 0.9rem; border-bottom: 3px solid var(--line); color: var(--term-text); font: 600 0.875rem var(--body); }
  .termbar i { width: 0.7rem; height: 0.7rem; border-radius: 50%; background: var(--term-text); opacity: 0.35; }
  .termbar span { margin-left: 0.5rem; opacity: 0.75; }
  #demo {
    margin: 0; padding: 1rem 1.1rem 1.25rem;
    color: var(--term-text); font: 400 0.8125rem/1.55 var(--mono); white-space: pre-wrap; overflow-wrap: anywhere;
  }
  #demo b { color: #ffd60a; font-weight: 700; }
  #demo [data-type] { color: #ffd60a; }
  #demo .card { color: #ff7dbd; font-weight: 700; }
  #demo .caret { display: inline-block; height: 1.05em; border-left: 0.55em solid #ffd60a; margin-right: -0.55em; vertical-align: -0.15em; animation: blink 1s steps(1) infinite; }
  #demo .later { visibility: hidden; }
  @keyframes blink { 50% { opacity: 0; } }

  /* The board. */
  .boardhead { display: flex; flex-wrap: wrap; align-items: end; justify-content: space-between; gap: 1rem; margin-bottom: 0.5rem; }
  .boardhead h2 { margin: 0; }
  .boardhead input {
    width: min(100%, 17rem); padding: 0.6rem 0.8rem;
    background: var(--block); color: var(--text); border: 3px solid var(--line); border-radius: 0;
    font: 600 1rem var(--body);
  }
  .boardhead input::placeholder { color: var(--quiet); }
  .tally { margin: 0 0 1.25rem; font-size: 1.25rem; }
  .board { list-style: none; margin: 0; padding: 0; }
  .row, .ghost {
    display: grid; grid-template-columns: 3.25rem minmax(0, 1.4fr) minmax(7rem, 1.2fr) 7.5rem 8.5rem;
    align-items: center; gap: 1.1rem;
    margin-bottom: 0.7rem; padding: 0.7rem 1.1rem 0.7rem 0.8rem;
    background: var(--block); border: 3px solid var(--line); box-shadow: 4px 4px 0 var(--line);
  }
  .row[hidden] { display: none; }
  .rank { font: 400 2.25rem/1 var(--display); text-align: center; }
  .player { min-width: 0; }
  .who { margin-right: 0.5rem; font-weight: 800; font-size: 1.25rem; overflow-wrap: anywhere; }
  .you { margin-right: 0.5rem; padding: 0.05rem 0.45rem; background: var(--link); color: #fff; font-weight: 800; font-size: 0.8125rem; vertical-align: 0.15em; }
  .meta { display: block; margin-top: 0.1rem; color: var(--quiet); font-size: 0.9375rem; }
  .level { display: inline-block; padding: 0.1rem 0.55rem; border: 2px solid var(--line); font-weight: 800; font-size: 0.875rem; white-space: nowrap; vertical-align: 0.12em; }
  .level-unspoken { background: var(--pop); color: #fff; }
  .level-w { background: var(--line); color: var(--ground); }
  .level-mid { border-style: dashed; color: var(--quiet); }
  .level-yapper { border-style: dotted; color: var(--quiet); }
  .meter { position: relative; height: 1.1rem; border: 2px solid var(--line); }
  .fill { display: block; height: 100%; background: var(--line); }
  .fill-under { background: var(--pop); }
  .tick { position: absolute; top: -0.5rem; bottom: -0.5rem; width: 0; border-left: 3px dashed var(--line); }
  .tokens { text-align: right; font-weight: 600; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .tokens small { color: var(--quiet); font-size: 0.8125rem; font-weight: 400; }
  .topar { text-align: right; font: 400 2.25rem/1 var(--display); white-space: nowrap; }
  .topar.under { color: var(--pop); }
  .row.me { border-color: var(--link); box-shadow: 6px 6px 0 var(--link); }
  #me { scroll-margin-top: 35vh; }
  .ghost { grid-template-columns: 3.25rem 1fr; border-style: dashed; box-shadow: none; background: transparent; }
  .ghost .who, .ghost .rank { color: var(--quiet); }
  .parline { display: flex; align-items: center; gap: 0.9rem; margin: 1.1rem 0 1.2rem; font: 400 1.25rem var(--display); letter-spacing: 0.04em; }
  .parline::before, .parline::after { content: ''; flex: 1; border-top: 3px dashed var(--line); }
  .nomatch { margin: 0.5rem 0 1rem; font-weight: 600; }

  /* Below the board. */
  section { padding: 3.5rem 0 0; }
  .steps { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 1.25rem; margin: 0; padding: 0; list-style: none; counter-reset: step; }
  .steps li { counter-increment: step; padding: 1.1rem 1.2rem 1.3rem; background: var(--block); border: 3px solid var(--line); box-shadow: 5px 5px 0 var(--line); }
  .steps li::before { content: counter(step); display: block; font: 400 3.25rem/1 var(--display); color: var(--pop); }
  .steps h3 { margin: 0.4rem 0 0.3rem; font-weight: 800; font-size: 1.375rem; }
  .steps p { margin: 0; }
  .levels { display: grid; gap: 0.6rem; margin: 0; padding: 0; list-style: none; max-width: 34rem; }
  .levels li { display: grid; grid-template-columns: 10rem 1fr; align-items: center; gap: 1rem; }
  .levels .level { justify-self: start; font-size: 1rem; }
  .fine { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 1.5rem 2rem; }
  .fine h3 { margin: 0 0 0.25rem; font-weight: 800; font-size: 1.1875rem; }
  .fine p { margin: 0; }
  footer { margin-top: 4rem; padding: 1.5rem 0 3rem; border-top: 3px solid var(--line); font-weight: 600; }

  @media (max-width: 56rem) {
    .hero { grid-template-columns: 1fr; gap: 2rem; padding-bottom: 3rem; }
    .steps, .fine { grid-template-columns: 1fr; }
  }
  @media (max-width: 44rem) {
    .row { grid-template-columns: 2.25rem minmax(0, 1fr) auto; grid-template-areas: 'rank player topar' 'rank meter meter'; gap: 0.5rem 0.75rem; padding: 0.7rem 0.8rem 0.9rem 0.6rem; }
    .row .rank { grid-area: rank; font-size: 1.75rem; align-self: start; padding-top: 0.2rem; }
    .row .player { grid-area: player; }
    .row .meter { grid-area: meter; }
    .row .topar { grid-area: topar; font-size: 1.75rem; align-self: start; padding-top: 0.2rem; }
    .row .tokens { display: none; }
    .who { display: block; margin: 0 0 0.2rem; }
    .levels li { grid-template-columns: 8.5rem 1fr; }
  }
  @media (prefers-reduced-motion: reduce) {
    html { scroll-behavior: auto; }
    #demo .caret { animation: none; }
  }
</style>
</head>
<body>
<div class="wrap">
  <nav class="top" aria-label="Elsewhere">
    <a href="https://github.com/BitwodedSeleshiDemissie/promptrizz">GitHub</a>
    <a href="https://www.npmjs.com/package/promptrizz">npm</a>
  </nav>

  <header class="hero">
    <div>
      <h1 class="word"><span>Prompt</span><span>Rizz</span><em class="sticker" aria-hidden="true">no<br>yapping</em></h1>
      <p class="tag">Same bug. One instruction. Fewest tokens wins.</p>
      <p class="pitch">Your AI agent fixes a small bug. You get one line to tell it how. The less it burns, the more rizz you have.</p>
      <div class="play">
        <code>npx promptrizz</code>
        <button type="button" id="copy">Copy</button>
      </div>
    </div>
    <div class="term">
      <div class="termbar"><i></i><i></i><i></i><span>a real round, replayed</span></div>
      <pre id="demo" aria-label="A round of Prompt Rizz as it looks in the terminal">${demo(hole)}</pre>
    </div>
  </header>

  <main>
    <div class="boardhead">
      <h2>The board</h2>
      <input type="search" id="find" placeholder="Find a name" aria-label="Find a name on the board" autocomplete="off">
    </div>
    <div id="board">
    ${renderBoard({ hole, players, played, entries, me })}
    </div>

    <section>
      <h2>How a round goes</h2>
      <ol class="steps">
        <li><h3>Run it</h3><p>Type <code>npx promptrizz</code> in a terminal. You need Node and Claude Code. Nothing to install.</p></li>
        <li><h3>Say less</h3><p>You see the bug, not the code. You get one instruction for your agent. That is your whole turn.</p></li>
        <li><h3>Get carded</h3><p>Tests check the fix. You get a score card to paste anywhere, and your name lands here.</p></li>
      </ol>
    </section>

    <section>
      <h2>Rizz levels</h2>
      <ul class="levels">
        ${levels(hole.par)}
      </ul>
    </section>

    <section>
      <h2>The fine print</h2>
      <div class="fine">
        <div><h3>Scores are not checked</h3><p>The game posts each score from the player's own machine when a round ends. Nobody verifies them. It is a friendly board, not a referee.</p></div>
        <div><h3>What the board gets</h3><p>Your name, the token count, solved or not, and the model. Never your instruction, never your code.</p></div>
        <div><h3>Your name</h3><p>You pick it the first time you play. Change it with <code>npx promptrizz name</code>. Leave with <code>npx promptrizz leave</code>.</p></div>
      </div>
    </section>
  </main>

  <footer>Prompt Rizz is open source. <a href="https://github.com/BitwodedSeleshiDemissie/promptrizz">Read the code</a>.</footer>
</div>
<script>
(function () {
  // Copy the command.
  var copy = document.getElementById('copy');
  copy.addEventListener('click', function () {
    navigator.clipboard.writeText('npx promptrizz').then(function () {
      copy.textContent = 'Copied';
      setTimeout(function () { copy.textContent = 'Copy'; }, 1500);
    });
  });

  // Find a name: hide the rows that do not match.
  var find = document.getElementById('find');
  var board = document.getElementById('board');
  function applyFind() {
    var wanted = find.value.trim().toLowerCase();
    var rows = board.querySelectorAll('.row');
    var shown = 0;
    rows.forEach(function (row) {
      var match = !wanted || row.querySelector('.who').textContent.toLowerCase().indexOf(wanted) !== -1;
      row.hidden = !match;
      if (match) shown += 1;
    });
    var none = board.querySelector('.nomatch');
    if (none) none.remove();
    if (wanted && rows.length && !shown) {
      var note = document.createElement('p');
      note.className = 'nomatch';
      note.textContent = 'Nobody on the board has that name.';
      board.querySelector('.board').before(note);
    }
  }
  find.addEventListener('input', applyFind);

  // Keep the board fresh without reloading the page.
  var last = null;
  function refresh() {
    if (document.hidden) return;
    var me = new URLSearchParams(location.search).get('me');
    fetch('/?part=board' + (me ? '&me=' + encodeURIComponent(me) : ''), { cache: 'no-store' })
      .then(function (response) { return response.ok ? response.text() : null; })
      .then(function (html) {
        if (html === null || html === last) return;
        last = html;
        board.innerHTML = html;
        applyFind();
      })
      .catch(function () {});
  }
  setInterval(refresh, 20000);

  // Replay the round in the terminal: lines appear, the instruction is typed,
  // the seconds tick, the card lands. People who asked for less motion get it still.
  var demo = document.getElementById('demo');
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  var steps = Array.prototype.slice.call(demo.querySelectorAll('[data-s]'));
  var full = steps.map(function (step) { return step.textContent; });
  var caret = document.createElement('span');
  caret.className = 'caret';
  var wait = function (ms) { return new Promise(function (done) { setTimeout(done, ms); }); };
  // Every step keeps its place in the layout the whole time (hidden, not removed),
  // so the terminal never changes size and nothing under it moves.
  var rest = document.createElement('span');
  rest.className = 'later';
  async function replay() {
    for (;;) {
      steps.forEach(function (step, i) { step.textContent = full[i]; step.classList.add('later'); });
      await wait(600);
      for (var i = 0; i < steps.length; i += 1) {
        var step = steps[i];
        step.classList.remove('later');
        if (step.hasAttribute('data-type')) {
          for (var c = 0; c <= full[i].length; c += 1) {
            step.textContent = full[i].slice(0, c);
            rest.textContent = full[i].slice(c);
            step.appendChild(caret);
            step.appendChild(rest);
            await wait(full[i][c] === ' ' ? 45 : 24);
          }
          step.textContent = full[i];
          await wait(350);
        } else if (step.hasAttribute('data-count')) {
          var seconds = Number(step.getAttribute('data-count'));
          for (var s = 0; s <= seconds; s += 1) {
            step.textContent = s + 's\\n';
            await wait(110);
          }
        } else {
          await wait(step.classList.contains('card') ? 900 : 420);
        }
      }
      await wait(8000);
    }
  }
  replay();
})();
</script>
</body>
</html>
`;
}
