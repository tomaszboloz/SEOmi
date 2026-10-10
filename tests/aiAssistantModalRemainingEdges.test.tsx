import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, cleanup } from '@testing-library/react';
import { AIAssistantModal } from '@/components/AI/AIAssistantModal';
import { useAIAssistantSession } from '@/components/AI/assistant/useAIAssistantSession';

vi.mock('@/hooks/useModalA11y', () => ({ useModalA11y: () => null }));
vi.mock('@/components/AI/assistant/useAIAssistantSession', () => ({ useAIAssistantSession: vi.fn() }));
vi.mock('@/components/AI/assistant/AIAssistantModalHeader', () => ({ AIAssistantModalHeader: () => null }));
vi.mock('@/components/AI/assistant/AIAssistantEngineSelect', () => ({ AIAssistantEngineSelect: () => null }));
vi.mock('@/components/AI/assistant/AIAssistantApiKeyInput', () => ({ AIAssistantApiKeyInput: () => null }));
vi.mock('@/components/AI/assistant/AIAssistantSuggestions', () => ({ AIAssistantSuggestions: () => null }));

const session = (patch: Record<string, unknown> = {}) => ({
  t: (key: string) => key, closeModal: vi.fn(), openSubscriptionModal: vi.fn(), currentAudit: { url: 'https://example.test' },
  provider: 'openai', setProvider: vi.fn(), connectionMethod: { openai: 'api_key', claude: 'api_key', gemini: 'api_key' },
  currentKey: '', handleApiKeyChange: vi.fn(), promptInstruction: '', setPromptInstruction: vi.fn(), loading: false,
  error: null, suggestions: null, copiedJson: false, appliedField: null, handleGenerate: vi.fn(), applyTitle: vi.fn(),
  applyDescription: vi.fn(), copySchema: vi.fn(), ...patch,
});

describe('AI assistant modal remaining branches', () => {
  afterEach(() => cleanup());

  it('closes only when the backdrop itself is pressed', () => {
    const closeModal = vi.fn();
    vi.mocked(useAIAssistantSession).mockReturnValue(session({ closeModal }) as never);
    render(<AIAssistantModal />);
    const backdrop = screen.getByRole('presentation');
    fireEvent.mouseDown(backdrop);
    fireEvent.mouseDown(screen.getByRole('dialog'));
    expect(closeModal).toHaveBeenCalledTimes(1);
  });

  it('renders an actionable error state', () => {
    vi.mocked(useAIAssistantSession).mockReturnValue(session({ error: 'Provider failed', currentAudit: null }) as never);
    render(<AIAssistantModal />);
    expect(screen.getByText('Provider failed')).toBeTruthy();
    expect((screen.getByRole('button') as HTMLButtonElement).disabled).toBe(true);
  });
});
