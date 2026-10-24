import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import '@/i18n';
import { LlmEconomyPanel } from '@/components/AI/LlmEconomyPanel';
import { summarizeUsage } from '@/services/llmEconomy';

describe('LlmEconomyPanel', () => {
  it('shows the empty state and no warning for a local provider', () => {
    render(<LlmEconomyPanel summary={summarizeUsage([], null)} providerId="ollama" />);
    expect(screen.getByTestId('llm-economy-panel').textContent).toContain('No AI calls recorded yet.');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('shows cost, savings, hits and the off-device warning', () => {
    const summary = summarizeUsage([{ costUsd: 0.5, cached: false, local: false }, { costUsd: 0.25, cached: true, local: false }], null);
    render(<LlmEconomyPanel summary={summary} providerId="openai" />);
    const text = screen.getByTestId('llm-economy-panel').textContent ?? '';
    expect(text).toContain('Spent: $0.50');
    expect(text).toContain('$0.25');
    expect(text).toContain('Cache hits: 1');
    expect(screen.getByRole('alert').textContent).toContain('openai');
  });
});
