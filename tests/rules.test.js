import assert from 'node:assert/strict';
import test from 'node:test';
import { MOVIESHAKER_MODES, DEFAULT_MODE_ID, listModesForClient, findMode } from '../lib/server/modes.js';

test('MOVIESHAKER_MODES exports an array of modes', () => {
  assert(Array.isArray(MOVIESHAKER_MODES));
  assert(MOVIESHAKER_MODES.length > 0);
});

test('MOVIESHAKER_MODES: every mode has required fields', () => {
  for (const mode of MOVIESHAKER_MODES) {
    assert(typeof mode.id === 'string' && mode.id.length > 0, `mode.id must be non-empty string: ${mode.id}`);
    assert(typeof mode.displayName === 'string' && mode.displayName.length > 0, `mode.displayName must be non-empty string`);
    assert(typeof mode.promptInfo === 'string' && mode.promptInfo.length > 0, `mode.promptInfo must be non-empty string`);
    assert(typeof mode.systemPrompt === 'string' && mode.systemPrompt.length > 0, `mode.systemPrompt must be non-empty string`);
  }
});

test('MOVIESHAKER_MODES: no duplicate ids', () => {
  const ids = MOVIESHAKER_MODES.map((m) => m.id);
  const uniqueIds = new Set(ids);
  assert.equal(ids.length, uniqueIds.size, 'Duplicate mode ids detected');
});

test('DEFAULT_MODE_ID is defined and points to an existing mode', () => {
  assert(typeof DEFAULT_MODE_ID === 'string' && DEFAULT_MODE_ID.length > 0);
  const defaultMode = MOVIESHAKER_MODES.find((m) => m.id === DEFAULT_MODE_ID);
  assert(defaultMode, `Default mode '${DEFAULT_MODE_ID}' not found in MOVIESHAKER_MODES`);
});

test('listModesForClient() returns an array', () => {
  const modes = listModesForClient();
  assert(Array.isArray(modes));
  assert(modes.length > 0);
});

test('listModesForClient() includes id, displayName, promptInfo for each mode', () => {
  const modes = listModesForClient();
  for (const mode of modes) {
    assert(typeof mode.id === 'string' && mode.id.length > 0);
    assert(typeof mode.displayName === 'string' && mode.displayName.length > 0);
    assert(typeof mode.promptInfo === 'string' && mode.promptInfo.length > 0);
  }
});

test('listModesForClient() does not expose systemPrompt to client', () => {
  const modes = listModesForClient();
  for (const mode of modes) {
    assert(!('systemPrompt' in mode), 'systemPrompt must not be exposed to client');
  }
});

test('findMode() returns the correct mode for a valid id', () => {
  const mode = findMode('festivals');
  assert.equal(mode.id, 'festivals');
  assert(typeof mode.displayName === 'string' && mode.displayName.length > 0);
  assert(typeof mode.promptInfo === 'string' && mode.promptInfo.length > 0);
  assert(typeof mode.systemPrompt === 'string' && mode.systemPrompt.length > 0);
});

test('findMode() is case-insensitive', () => {
  const mode1 = findMode('FESTIVALS');
  const mode2 = findMode('festivals');
  const mode3 = findMode('Festivals');
  assert.equal(mode1.id, mode2.id);
  assert.equal(mode2.id, mode3.id);
});

test('findMode() returns default mode for unknown id', () => {
  const mode = findMode('nonexistent-mode-xyz');
  assert.equal(mode.id, DEFAULT_MODE_ID);
});

test('findMode() returns default mode for empty string', () => {
  const mode = findMode('');
  assert.equal(mode.id, DEFAULT_MODE_ID);
});

test('findMode() returns default mode for null', () => {
  const mode = findMode(null);
  assert.equal(mode.id, DEFAULT_MODE_ID);
});

test('findMode() returns default mode for undefined', () => {
  const mode = findMode(undefined);
  assert.equal(mode.id, DEFAULT_MODE_ID);
});

test('findMode() returns default mode for whitespace-only string', () => {
  const mode = findMode('   ');
  assert.equal(mode.id, DEFAULT_MODE_ID);
});
