import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import i18n from '@/i18n';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { clusterLabelPrompt } from '@/services/embeddings/cluster';
import { readInputs } from '@/services/embeddings/io';
import { SettingsHeader } from '@/components/Settings/settings/SettingsHeader';

beforeEach(async () => { await i18n.changeLanguage('en'); });

describe('embeddings and settings direct assertions', () => {
  it('clusterLabelPrompt formats list of texts into prompt', () => {
    const prompt = clusterLabelPrompt(['apple pie', 'banana bread']);
    expect(prompt).toContain('Name this group of search queries');
    expect(prompt).toContain('- apple pie');
    expect(prompt).toContain('- banana bread');
  });

  it('readInputs parses input texts from file path', () => {
    const tmpDir = mkdtempSync(join(tmpdir(), 'test-inputs-'));
    const tmpPath = join(tmpDir, 'inputs.txt');
    writeFileSync(tmpPath, 'keyword 1\nkeyword 2\n', 'utf8');

    try {
      const inputs = readInputs(tmpPath);
      expect(inputs.length).toBeGreaterThanOrEqual(2);
      expect(inputs[0].text).toBe('keyword 1');
    } finally {
      try {
        rmSync(tmpDir, { recursive: true, force: true });
      } catch {
        // cleanup
      }
    }
  });

  it('SettingsHeader renders settings modal title', () => {
    render(<SettingsHeader />);
    expect(screen.getByText(i18n.t('sidebar.settings'))).toBeDefined();
  });
});
