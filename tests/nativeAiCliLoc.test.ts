// @vitest-environment node
import { expect, it } from 'vitest';
import { codeFiles, maxLocReport } from '../scripts/check-max-loc.mjs';

it('keeps native CLI dispatch, process, authentication and every test within LOC150', () => {
  expect(maxLocReport(['src-tauri/src/commands/ai_cli.rs',
    ...codeFiles('src-tauri/src/commands/ai_cli')]).violations).toEqual([]);
});
