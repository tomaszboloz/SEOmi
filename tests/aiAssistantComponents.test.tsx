import { useAuthStore } from '@/stores/authStore';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AIAssistantModalHeader } from '@/components/AI/assistant/AIAssistantModalHeader';
import { AIAssistantEngineSelect } from '@/components/AI/assistant/AIAssistantEngineSelect';
import { AIAssistantApiKeyInput } from '@/components/AI/assistant/AIAssistantApiKeyInput';
import { AIAssistantSuggestions } from '@/components/AI/assistant/AIAssistantSuggestions';
import type { AiSuggestionResponse } from '@/services/ai';
import { codeFiles, maxLocReport } from '../scripts/check-max-loc.mjs';

const mockT = ((key: string, opts?: Record<string, unknown>) => {
  if (opts && 'provider' in opts) return `${key}:${opts.provider}`;
  if (opts && 'count' in opts) return `${key}:${opts.count}`;
  return key;
}) as unknown as Parameters<typeof AIAssistantModalHeader>[0]['t'];

describe('AIAssistant modular architecture', () => {
  it('satisfies physical LOC <= 150 across AIAssistantModal and assistant submodules', () => {
    const files = [
      'src/components/AI/AIAssistantModal.tsx',
      ...codeFiles('src/components/AI/assistant'),
    ];
    expect(files.length).toBeGreaterThanOrEqual(4);
    const report = maxLocReport(files);
    expect(report.violations).toEqual([]);
  });

  it('renders AIAssistantModalHeader and handles close click', () => {
    const close = vi.fn();
    render(<AIAssistantModalHeader closeModal={close} t={mockT} />);

    expect(screen.getByText('ai.title')).toBeTruthy();
    expect(screen.getByText('ai.description')).toBeTruthy();

    const closeBtn = screen.getByRole('button', { name: 'ai.close' });
    fireEvent.click(closeBtn);
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('renders AIAssistantEngineSelect and responds to engine change', () => {
    const setProvider = vi.fn();

    render(
      <AIAssistantEngineSelect
        provider="openai"
        setProvider={setProvider}
        connectionMethod={{ openai: 'api_key', claude: 'api_key', gemini: 'api_key' }}
        t={mockT}
      />,
    );

    const claudeBtn = screen.getByRole('button', { name: /legacyUi\.ai\.claude/ });
    fireEvent.click(claudeBtn);
    expect(setProvider).toHaveBeenCalledWith('claude');

    // The model selector is a store-backed component with its own tests.
    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'gpt-4o-mini' } });
    expect(useAuthStore.getState().model).toBe('gpt-4o-mini');
  });

  it('renders AIAssistantApiKeyInput and responds to input and modal trigger', () => {
    const handleKeyChange = vi.fn();
    const openSub = vi.fn();
    const setInstruction = vi.fn();

    render(
      <AIAssistantApiKeyInput
        provider="openai"
        currentKey="sk-test"
        handleApiKeyChange={handleKeyChange}
        connectionMethod={{ openai: 'api_key', claude: 'api_key', gemini: 'api_key' }}
        openSubscriptionModal={openSub}
        promptInstruction=""
        setPromptInstruction={setInstruction}
        t={mockT}
      />,
    );

    const subBtn = screen.getByRole('button', { name: 'ai.manageSubscriptions' });
    fireEvent.click(subBtn);
    expect(openSub).toHaveBeenCalledTimes(1);

    const keyInput = screen.getByDisplayValue('sk-test');
    fireEvent.change(keyInput, { target: { value: 'sk-new' } });
    expect(handleKeyChange).toHaveBeenCalledWith('sk-new');

    const instructionInput = screen.getByLabelText('ai.customInstruction');
    fireEvent.change(instructionInput, { target: { value: 'focus on e-commerce' } });
    expect(setInstruction).toHaveBeenCalledWith('focus on e-commerce');
  });


  it('renders AIAssistantSuggestions and triggers apply callbacks', () => {
    const suggestions: AiSuggestionResponse = {
      suggestedTitle: 'Optimal SEO Title for Business',
      suggestedDescription: 'A very comprehensive meta description that boosts CTR.',
      keyImprovements: ['Add primary keyword', 'Improve readability'],
      schemaJsonLd: { '@context': 'https://schema.org', '@type': 'WebPage' },
    };
    const applyTitle = vi.fn();
    const applyDesc = vi.fn();
    const copySchema = vi.fn();

    render(
      <AIAssistantSuggestions
        suggestions={suggestions}
        applyTitle={applyTitle}
        applyDescription={applyDesc}
        appliedField={null}
        copySchema={copySchema}
        copiedJson={false}
        t={mockT}
      />,
    );

    expect(screen.getByText('Optimal SEO Title for Business')).toBeTruthy();
    expect(screen.getByText('A very comprehensive meta description that boosts CTR.')).toBeTruthy();
    expect(screen.getByText('Add primary keyword')).toBeTruthy();

    const titleApplyBtn = screen.getByRole('button', { name: /ai\.applyTitle/ });
    fireEvent.click(titleApplyBtn);
    expect(applyTitle).toHaveBeenCalledTimes(1);

    const descApplyBtn = screen.getByRole('button', { name: /ai\.applyDesc/ });
    fireEvent.click(descApplyBtn);
    expect(applyDesc).toHaveBeenCalledTimes(1);

    const copyBtn = screen.getByRole('button', { name: /ai\.copyJson/ });
    fireEvent.click(copyBtn);
    expect(copySchema).toHaveBeenCalledTimes(1);
  });
});
