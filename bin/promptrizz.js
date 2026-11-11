#!/usr/bin/env node
import { createInterface } from 'node:readline';
import { copyToClipboard } from '../src/clipboard.js';
import { playRound } from '../src/round.js';

// The prompt is closed as soon as a line is typed, so Ctrl-C can stop a running round.
function ask(question) {
  return new Promise((resolve, reject) => {
    const prompt = createInterface({ input: process.stdin, output: process.stdout });
    let answered = false;
    prompt.question(question, (answer) => {
      answered = true;
      prompt.close();
      resolve(answer);
    });
    prompt.once('close', () => {
      if (!answered) reject(new Error('No instruction was typed.'));
    });
  });
}

try {
  await playRound({ ask, print: console.log, copy: copyToClipboard });
} catch (error) {
  console.error(`\n${error.message}`);
  process.exitCode = 1;
}
