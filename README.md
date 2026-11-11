# Prompt Rizz

Golf for people who code with AI agents.

Everyone gets the same small bug. You get one instruction. Your agent fixes it, tests check that it really did, and your score is the number of tokens it burned. Lowest wins.

    Prompt Rizz #1: fix the search crash
    Par:    35,000 tokens
    You:    29,583 tokens  (5,417 under par)
    Setup:  Claude Code + Fable 5.2

That score is from a real round. Par is what it costs when you just describe the bug and say "fix it". The 5,417 is the instruction.

There are leaderboards now for who burns the most tokens. This is the other one.

## Play

You need Node 20 or newer and [Claude Code](https://claude.com/claude-code), installed and logged in. It was built against Claude Code 2.1.322. If yours is too old, the game says so and tells you how to update.

    npx promptrizz

It shows you the task and waits for your one instruction. You see the task, not the code. After that you do nothing. In under half a minute you get a card, copied to your clipboard, and only then does it tell you where the agent worked, so you can look at what it did.

A round runs on your own Claude account and costs about 35,000 tokens. Play as often as you like. Every round starts from a fresh copy of the bug.

## The leaderboard

There is a public board: https://promptrizz.vercel.app

The first time you play, the game asks for a name. Give one and you are on the board. Press Enter and you play without it. It only asks once.

If you gave a name, the game sends four things after every round: your name, the token count, whether the round was solved, and the model. Nothing else. Never your instruction, never your code.

The board ranks you by your best solved round and shows your first try next to it. The name is tied to a file on your machine (`~/.promptrizz/profile.json`), so nobody else can post as you.

    npx promptrizz name     change your name, or join later
    npx promptrizz leave    delete your name and scores from the board

## The rules

Every token counts: what the agent reads, what it writes, and what it reads again from cache. Each step the agent takes sends everything so far once more, so steps cost far more than words do. An agent that wanders is an expensive agent.

A round is only solved if the app works afterwards. The game starts the app and searches it. Those checks are kept where the agent cannot see them.

Everyone plays the same clean Claude Code. Your own skills, plugins, settings and MCP servers are switched off for the round, so the instruction is the only thing you bring.

The agent can read and edit files inside a throwaway copy of the app, and that is all. No shell, no web, nothing outside that folder.

## What is missing

There is one hole and no daily task. Nothing stops you from cheating: the code is right here, reading it first is the easy way to a low number, and the board takes whatever number a machine sends it. Treat it as a friendly board. Scores from different models do not compare, which is why the card and the board name the setup. It has only been run on a Mac.

## The name

Rizz is charm. Getting the job done while saying almost nothing is unspoken rizz.

## Working on it

    git clone https://github.com/BitwodedSeleshiDemissie/promptrizz.git
    cd promptrizz
    npm test

The tests use a stand-in for Claude Code and a stand-in for the board, so they cost nothing and post nothing. A hole is a folder in `holes/`: a small app with one bug, and a check the game runs afterwards.

The board is in `web/`: a few functions on Vercel, a Postgres database, and one page.

    cd web
    npm install
    npm test

Those tests run against a Postgres that lives inside the test process, never the real one.

## License

MIT
