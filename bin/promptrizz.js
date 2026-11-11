#!/usr/bin/env node
import { createInterface } from 'node:readline';
import { main } from '../src/cli.js';
import { copyToClipboard } from '../src/clipboard.js';

// One reader for everything the player types. It leaves the terminal in its normal
// mode, so Ctrl-C stops the game, and a running agent with it, at any moment.
const keyboard = createInterface({ input: process.stdin });
const typedLines = keyboard[Symbol.asyncIterator]();

async function ask(question) {
  process.stdout.write(question);
  const { value, done } = await typedLines.next();
  if (done) throw new Error('Nothing was typed.');
  return value;
}

// Shows that the wait is alive: a seconds counter on a real terminal, one plain line
// anywhere else. Returns the function that takes it down.
function progress(text) {
  if (!process.stdout.isTTY) {
    console.log(text);
    return () => {};
  }
  const started = Date.now();
  const draw = () => process.stdout.write(`\r${text} ${Math.floor((Date.now() - started) / 1000)}s`);
  draw();
  const ticker = setInterval(draw, 1000);
  return () => {
    clearInterval(ticker);
    process.stdout.write('\n');
  };
}

try {
  process.exitCode = await main({
    args: process.argv.slice(2),
    ask,
    print: console.log,
    copy: copyToClipboard,
    progress,
  });
} catch (error) {
  console.error(`\n${error.message}`);
  process.exitCode = 1;
} finally {
  keyboard.close();
}
