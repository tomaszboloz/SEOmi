import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TopicalCrawlEvidence } from '@/components/Charts/semanticTopical/TopicalCrawlEvidence';
import { TopicFactList } from '@/components/Charts/semanticTopical/editor/TopicFactList';
import { TopicFactForm } from '@/components/Charts/semanticTopical/editor/TopicFactForm';
import { topicalSession } from './fixtures/topicalSessionContracts';

vi.mock('react-i18next', async (importOriginal) => ({ ...await importOriginal<typeof import('react-i18next')>(), useTranslation: () => ({ t: (key: string, values?: { attribute?: string }) => `${key}${values?.attribute ? `:${values.attribute}` : ''}` }) }));

describe('topical crawl evidence contracts', () => {
  it('renders no selected topic and distinguishes unavailable from measured terms', () => {
    const session = topicalSession({ selectedNode: null });
    const { container, rerender } = render(<TopicalCrawlEvidence session={session} />);
    expect(container.textContent).toBe('');
    const selected = topicalSession();
    rerender(<TopicalCrawlEvidence session={selected} />);
    expect(screen.getByText('semanticWorkspace.noImportedTerms')).toBeTruthy();
    selected.selectedNode!.evidenceTerms = ['coffee', 'beans'];
    rerender(<TopicalCrawlEvidence session={selected} />);
    expect(screen.getByText('coffee')).toBeTruthy();
    expect(screen.getByText('beans')).toBeTruthy();
    expect(screen.queryByText('semanticWorkspace.noImportedTerms')).toBeNull();
  });
  it('verifies and removes only the requested topic fact', () => {
    const session = topicalSession();
    const facts = [
      { id: 'a', attribute: 'Origin', value: 'PL', sourceUrl: 'https://site.test/source', reuseStatus: 'locked' as const },
      { id: 'b', attribute: 'Claim', value: 'Unverified', sourceUrl: '', reuseStatus: 'locked' as const },
    ];
    session.selectedNode!.facts = facts;
    const { rerender } = render(<TopicFactList session={session} />);
    expect(screen.getByRole('link').getAttribute('href')).toBe(facts[0].sourceUrl);
    expect((screen.getByRole('checkbox', { name: 'semanticWorkspace.confirmFact:Claim' }) as HTMLInputElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole('checkbox', { name: 'semanticWorkspace.confirmFact:Origin' }));
    expect(session.updateNode).toHaveBeenCalledWith('coffee', { facts: [{ ...facts[0], reuseStatus: 'verified' }, facts[1]] });
    fireEvent.click(screen.getByRole('button', { name: 'semanticWorkspace.removeTopicAttribute:Origin' }));
    expect(session.updateNode).toHaveBeenCalledWith('coffee', { facts: [facts[1]] });
    rerender(<TopicFactList session={{ ...session, selectedNode: null }} />);
    expect(screen.queryByRole('checkbox')).toBeNull();
  });
  it('updates independent draft fields and prevents addition of blank topic facts', () => {
    const session = topicalSession();
    const { rerender } = render(<TopicFactForm session={session} />);
    const button = screen.getByRole('button') as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    const entries = [['semanticWorkspace.topicAttribute', 'attribute'], ['semanticWorkspace.topicValue', 'value'], ['semanticWorkspace.topicSource', 'sourceUrl']] as const;
    for (const [label, field] of entries) {
      fireEvent.change(screen.getByLabelText(label), { target: { value: 'Updated' } });
      const updater = vi.mocked(session.setTopicFactDraft).mock.calls.at(-1)![0];
      expect(typeof updater).toBe('function');
      if (typeof updater === 'function') expect(updater(session.topicFactDraft)).toEqual({ ...session.topicFactDraft, [field]: 'Updated' });
    }
    rerender(<TopicFactForm session={{ ...session, topicFactDraft: { attribute: 'A', value: ' ', sourceUrl: '' } }} />);
    expect(button.disabled).toBe(true);
    rerender(<TopicFactForm session={{ ...session, topicFactDraft: { attribute: 'A', value: 'B', sourceUrl: '' } }} />);
    fireEvent.click(button);
    expect(session.addTopicFact).toHaveBeenCalledTimes(1);
    rerender(<TopicFactForm session={{ ...session, selectedNode: null }} />);
    expect(screen.queryByRole('button')).toBeNull();
  });
});
