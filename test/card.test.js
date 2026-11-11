import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildCard, setupName } from '../src/card.js';

const hole = { number: 42, title: 'fix the search crash', par: 48000 };

test('a solved round under par shows how many tokens were saved', () => {
  const card = buildCard({ hole, tokens: 31200, solved: true, model: 'claude-opus-5-5' });

  assert.equal(
    card,
    [
      'Prompt Rizz #42: fix the search crash',
      'Par:    48,000 tokens',
      'You:    31,200 tokens  (16,800 under par)',
      'Setup:  Claude Code + Opus 5.5',
    ].join('\n'),
  );
});

test('a solved round over par shows how many tokens too many', () => {
  const card = buildCard({ hole, tokens: 53000, solved: true, model: 'claude-opus-5-5' });

  assert.match(card, /^You: {4}53,000 tokens {2}\(5,000 over par\)$/m);
});

test('a solved round that matches par says so', () => {
  const card = buildCard({ hole, tokens: 48000, solved: true, model: 'claude-opus-5-5' });

  assert.match(card, /^You: {4}48,000 tokens {2}\(on par\)$/m);
});

test('an unsolved round says not solved and still shows the tokens used', () => {
  const card = buildCard({ hole, tokens: 31200, solved: false, model: 'claude-opus-5-5' });

  assert.match(card, /^You: {4}not solved {2}\(31,200 tokens used\)$/m);
});

test('a model id becomes a short readable name', () => {
  assert.equal(setupName('claude-fable-5-2'), 'Claude Code + Fable 5.2');
  assert.equal(setupName('claude-opus-4-1-20250805'), 'Claude Code + Opus 4.1');
  assert.equal(setupName('claude-sonnet-5-5[1m]'), 'Claude Code + Sonnet 5.5');
});

test('a model id in an unknown shape is shown as it is', () => {
  assert.equal(setupName('my-custom-model'), 'Claude Code + my-custom-model');
});
