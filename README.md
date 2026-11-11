# Prompt Rizz

Golf for people who code with AI agents.

Everyone gets the same small bug. You get one instruction. Your agent fixes it, tests check that it really did, and your score is the number of tokens it burned. Lowest wins.

    Prompt Rizz #1: fix the search crash
    Par:    35,000 tokens
    You:    21,394 tokens  (13,606 under par)
    Setup:  Claude Code + Fable 5.2

That score is from a real round. Par is what it costs when you just describe the bug and say "fix it". The 13,606 is the instruction.

There are leaderboards now for who burns the most tokens. This is the other one.

## Play

You need Node 20 or newer and [Claude Code](https://claude.com/claude-code), installed and logged in. It was built against Claude Code 2.1.322, and older versions may not have the options it uses.

    git clone https://github.com/BitwodedSeleshiDemissie/promptrizz.git
    cd promptrizz
    node bin/promptrizz.js

It shows you the task and waits for your one instruction. After that you do nothing. In under half a minute you get a card, copied to your clipboard.

A round runs on your own Claude account and costs about 35,000 tokens. Play as often as you like. Every round starts from a fresh copy of the bug.

## The rules

Every token counts: what the agent reads, what it writes, and what it reads again from cache. Each step the agent takes sends everything so far once more, so steps cost far more than words do. An agent that wanders is an expensive agent.

A round is only solved if the app works afterwards. The game starts the app and searches it. Those checks are kept where the agent cannot see them.

Everyone plays the same clean Claude Code. Your own skills, plugins, settings and MCP servers are switched off for the round, so the instruction is the only thing you bring.

The agent can read and edit files inside a throwaway copy of the app, and that is all. No shell, no web, nothing outside that folder.

## What is missing

There is one hole. There is no daily task, no leaderboard, and nothing stops you from cheating. Scores from different models do not compare, which is why the card names the setup. It has only been run on a Mac.

## The name

Rizz is charm. Getting the job done while saying almost nothing is unspoken rizz.

## Working on it

    npm test

The tests use a stand-in for Claude Code, so they cost nothing. A hole is a folder in `holes/`: a small app with one bug, and a check the game runs afterwards.

## License

MIT
