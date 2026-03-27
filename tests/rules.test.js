import assert from 'node:assert/strict';
import test from 'node:test';
import { parseTemplateMeta } from '../lib/server/rules.js';

test('parseTemplateMeta extracts selection/info/rules sections', () => {
  const content = `# Prompt Selection
Insolvency

# Prompt Information
Assist with restructuring and insolvency triage.

# Prompt Rules
- Keep responses concise.
- Include practical next steps.
`;
  const parsed = parseTemplateMeta(content);
  assert.equal(parsed.displayName, 'Insolvency');
  assert.match(parsed.promptInfo, /restructuring/i);
  assert.match(parsed.rulesOnly, /Keep responses concise/);
});
