import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import '@/i18n';
import { LlmEconomyPanel } from '@/components/AI/LlmEconomyPanel';
import { LlmEconomyBudgetSettings } from '@/components/AI/LlmEconomyBudgetSettings';
import { useProjectStore } from '@/stores/projectStore';
import { recordLlmCost, writeLlmBudget } from '@/services/llmEconomy/llmBudget';

const P = 'p_panel_test';

beforeEach(() => {
  localStorage.clear();
  useProjectStore.setState({ activeProjectId: P });
});

describe('LlmEconomyPanel live integration', () => {
  it('renders live spend, savings, remaining budget and leavesDevice warning', () => {
    writeLlmBudget(P, { monthlyLimitUsd: 10, warnAtPercent: 80 });
    recordLlmCost(P, { providerId: 'openai', costUsd: 2, savedUsd: 1, cached: true });

    render(<LlmEconomyPanel projectId={P} providerId="openai" />);
    const text = screen.getByTestId('llm-economy-panel').textContent ?? '';
    expect(text).toContain('Spent: $0.00');
    expect(text).toContain('$1.00');
    expect(text).toContain('Cache hits: 1');
    expect(text).toContain('Remaining budget: $10.00');
    expect(screen.getByRole('alert').textContent).toContain('openai');
  });

  it('renders overBudget alert when monthly limit is exceeded', () => {
    writeLlmBudget(P, { monthlyLimitUsd: 5, warnAtPercent: 80 });
    recordLlmCost(P, { providerId: 'claude', costUsd: 6 });

    render(<LlmEconomyPanel projectId={P} providerId="ollama" />);
    const text = screen.getByTestId('llm-economy-panel').textContent ?? '';
    expect(text).toContain('Monthly LLM budget exceeded.');
    expect(screen.queryByText(/leaves/i)).toBeNull();
  });

  it('renders empty state cleanly when projectId is null or omitted', () => {
    render(<LlmEconomyPanel projectId={null} />);
    render(<LlmEconomyPanel />);
    expect(screen.getAllByTestId('llm-economy-panel')[0].textContent).toContain('No AI calls recorded yet.');
  });

  it('shows unavailable instead of masking corrupt budget storage as no limit', () => {
    localStorage.setItem(`seomi_project_${P}_llm_budget_v1`, '{broken');
    render(<LlmEconomyPanel projectId={P} providerId="openai" />);
    expect(screen.getByText('LLM budget or spend storage is unavailable or invalid.')).toBeTruthy();
  });

  it('budget writer refuses to render controls for corrupt storage', () => {
    localStorage.setItem(`seomi_project_${P}_llm_budget_v1`, '{broken');
    render(<LlmEconomyBudgetSettings />);
    expect(screen.getByText('LLM budget or spend storage is unavailable or invalid.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Save budget' })).toBeNull();
  });
});
