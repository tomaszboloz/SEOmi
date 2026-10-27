import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AioPassageCard } from '@/components/Domain/crawlResults/aio/AioPassageCard';
import i18n from '@/i18n';
import type { AioChunk } from '@/services/aioReadiness/types';

const generateText = vi.fn();
let connected = true;

vi.mock('@/services/siteFocusBenchmark/adapter', () => ({
  createBriefDeps: () => ({
    isConfigured: () => connected,
    generateText,
  }),
}));

const mockPassage: AioChunk & { url: string } = {
  url: 'https://test.example/page#section1',
  heading: 'Blood Sugar Targets',
  level: 2,
  text: 'It is important to check. This value changes after meals.',
  tokens: 12,
  windowIndex: 0,
  score: 35,
  selfContainment: 20,
  answerFirst: 20,
  triples: 1,
  issues: ['dangling-pronoun', 'no-facts'],
};

beforeEach(async () => {
  generateText.mockReset();
  connected = true;
  await i18n.changeLanguage('en');
});

describe('geminiAITrust03: AioPassageCard rewrite proposal boundary', () => {
  it('does not auto-approve: presents proposal as copyable draft without mutating current passage', async () => {
    const aiProposal = 'Normal fasting blood sugar levels are 70-99 mg/dL in healthy adults.';
    generateText.mockResolvedValueOnce(aiProposal);

    render(<AioPassageCard passage={mockPassage} index={0} />);

    expect(screen.getByText(mockPassage.text)).toBeTruthy();
    expect(screen.queryByTestId('aio-optimized')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /Rewrite with AI 1/ }));

    const optimizedBox = await screen.findByTestId('aio-optimized');
    expect(optimizedBox.textContent).toContain(aiProposal);

    // Current passage remains visible and unchanged in the DOM
    expect(screen.getByText(mockPassage.text)).toBeTruthy();

    // Issues remain displayed, not dismissed automatically
    expect(screen.getByText('Unclear reference')).toBeTruthy();
    expect(screen.getByText('No concrete facts')).toBeTruthy();

    // Proposal only offers copy action; no automatic apply/merge/approve button
    expect(screen.getByRole('button', { name: 'Copy' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /approve|apply|accept|merge/i })).toBeNull();
  });

  it('treats AI proposal as unverified: handles clipboard copy gracefully even if clipboard fails', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('Clipboard permission denied'));
    Object.assign(navigator, { clipboard: { writeText } });

    generateText.mockResolvedValueOnce('Rewritten passage with fact: 120 mg/dL.');
    render(<AioPassageCard passage={mockPassage} index={0} />);

    fireEvent.click(screen.getByRole('button', { name: /Rewrite with AI 1/ }));
    await screen.findByTestId('aio-optimized');

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Copy' }));
    });
    expect(writeText).toHaveBeenCalledWith('Rewritten passage with fact: 120 mg/dL.');
  });

  it('does not display proposal card when provider returns empty or whitespace', async () => {
    generateText.mockResolvedValueOnce('   ');
    render(<AioPassageCard passage={mockPassage} index={0} />);

    fireEvent.click(screen.getByRole('button', { name: /Rewrite with AI 1/ }));

    expect(await screen.findByText('The AI returned no text.')).toBeTruthy();
    expect(screen.queryByTestId('aio-optimized')).toBeNull();
    expect(screen.getByText(mockPassage.text)).toBeTruthy();
  });

  it('does not display proposal card when provider is disconnected or throws', async () => {
    generateText.mockRejectedValueOnce(new Error('API quota reached'));
    const { rerender } = render(<AioPassageCard passage={mockPassage} index={0} />);

    fireEvent.click(screen.getByRole('button', { name: /Rewrite with AI 1/ }));
    expect(await screen.findByText('AI request failed: API quota reached')).toBeTruthy();
    expect(screen.queryByTestId('aio-optimized')).toBeNull();

    connected = false;
    rerender(<AioPassageCard passage={mockPassage} index={0} />);
    fireEvent.click(screen.getByRole('button', { name: /Rewrite with AI 1/ }));
    expect(await screen.findByText(/Connect an AI provider in Settings/)).toBeTruthy();
    expect(screen.queryByTestId('aio-optimized')).toBeNull();
  });
});