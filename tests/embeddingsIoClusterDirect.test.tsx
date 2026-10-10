import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { writeFileSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { clusterLabelPrompt } from '@/services/embeddings/cluster';
import { readInputs } from '@/services/embeddings/io';
import { SettingsHeader } from '@/components/Settings/settings/SettingsHeader';

describe('embeddings and settings direct assertions', () => {
  it('clusterLabelPrompt formats list of texts into prompt', () => {
    const prompt = clusterLabelPrompt(['apple pie', 'banana bread']);
    expect(prompt).toContain('Name this group of search queries');
    expect(prompt).toContain('- apple pie');
    expect(prompt).toContain('- banana bread');
  });

  it('readInputs parses input texts from file path', () => {
    const tmpPath = join(tmpdir(), `test-inputs-${Date.now()}.txt`);
    writeFileSync(tmpPath, 'keyword 1\nkeyword 2\n', 'utf8');

    try {
      const inputs = readInputs(tmpPath);
      expect(inputs.length).toBeGreaterThanOrEqual(2);
      expect(inputs[0].text).toBe('keyword 1');
    } finally {
      try {
        unlinkSync(tmpPath);
      } catch {
        // cleanup
      }
    }
  });

  it('SettingsHeader renders settings modal title', () => {
    render(<SettingsHeader />);
    expect(screen.getByText('sidebar.settings')).toBeDefined();
  });
});
