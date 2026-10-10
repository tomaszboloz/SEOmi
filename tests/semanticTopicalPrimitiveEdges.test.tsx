import { act, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FactReuseToggle, Metric } from '@/components/Charts/semanticTopical/workspacePrimitives';
import { useTopicalFacts } from '@/components/Charts/semanticTopical/session/useTopicalFacts';
import type { TopicalMapDocument, TopicalNode } from '@/services/topicalMap';

const node = (id = 'topic-1'): TopicalNode => ({
  id, title: 'Topic', kind: 'pillar', boundary: 'core', parentId: null, relatedNodeIds: [],
  intent: 'informational', lifecycle: 'planned', scheduledDate: '', queries: [], evidenceTerms: [],
  sourceUrls: [], sourceRunId: null, sourceClusterId: null, facts: [],
  contentBrief: { targetQueryId: '', requiredEntities: [], snippetTarget: 'none', internalLinkTargets: [], draftMarkdown: '', paragraphReviews: [], draftVersions: [] },
});

const makeDocument = (): TopicalMapDocument => ({ schemaVersion: 1, entity: { name: 'Acme', description: '', facts: [] }, nodes: [], updatedAt: '2026-10-05' });

describe('semantic topical primitive and fact edges', () => {
  it('renders metric values and makes sourced facts toggleable while unsourced facts stay locked', () => {
    const onChange = vi.fn();
    const view = render(<><Metric label="URLs" value={0} /><FactReuseToggle fact={{ id: 'f1', attribute: 'Industry', value: 'SaaS', sourceUrl: '', reuseStatus: 'locked' }} onChange={onChange} /></>);
    expect(screen.getByText('0')).toBeTruthy();
    const checkbox = screen.getByRole('checkbox') as HTMLInputElement;
    expect(checkbox.disabled).toBe(true);
    view.rerender(<FactReuseToggle fact={{ id: 'f1', attribute: 'Industry', value: 'SaaS', sourceUrl: 'https://example.com/fact', reuseStatus: 'locked' }} onChange={onChange} />);
    fireEvent.click(screen.getByRole('checkbox'));
    expect(onChange).toHaveBeenCalledWith('verified');
    view.rerender(<FactReuseToggle fact={{ id: 'f1', attribute: 'Industry', value: 'SaaS', sourceUrl: 'https://example.com/fact', reuseStatus: 'verified' }} onChange={onChange} />);
    expect((screen.getByRole('checkbox') as HTMLInputElement).checked).toBe(true);
    fireEvent.click(screen.getByRole('checkbox'));
    expect(onChange).toHaveBeenLastCalledWith('locked');
  });

  it('rejects incomplete drafts, then emits bounded entity and topic fact patches', () => {
    const documentRef = { current: makeDocument() };
    const updateEntity = vi.fn();
    const updateNode = vi.fn();
    const hook = renderHook(({ selectedNode }) => useTopicalFacts({ documentRef, selectedNode, updateEntity, updateNode }), { initialProps: { selectedNode: null as TopicalNode | null } });
    act(() => { hook.result.current.setFactDraft({ attribute: '  ', value: 'value', sourceUrl: 'https://example.com' }); });
    act(() => { hook.result.current.addEntityFact(); });
    act(() => { hook.result.current.setFactDraft({ attribute: 'Attribute', value: '  ', sourceUrl: '' }); });
    act(() => { hook.result.current.addEntityFact(); });
    act(() => { hook.result.current.setTopicFactDraft({ attribute: 'Topic fact', value: 'Value', sourceUrl: '' }); });
    act(() => { hook.result.current.addTopicFact(); });
    expect(updateEntity).not.toHaveBeenCalled();
    expect(updateNode).not.toHaveBeenCalled();
    act(() => { hook.result.current.setFactDraft({ attribute: '  Industry  ', value: '  SaaS  ', sourceUrl: ' https://example.com/fact ' }); });
    act(() => { hook.result.current.addEntityFact(); });
    expect(updateEntity).toHaveBeenCalledWith({ facts: [expect.objectContaining({ attribute: 'Industry', value: 'SaaS', sourceUrl: 'https://example.com/fact', reuseStatus: 'locked' })] });
    expect(hook.result.current.factDraft).toEqual({ attribute: '', value: '', sourceUrl: '' });
    hook.rerender({ selectedNode: node() });
    act(() => { hook.result.current.setTopicFactDraft({ attribute: ' Price ', value: ' $99 ', sourceUrl: 'https://example.com/price' }); });
    act(() => { hook.result.current.addTopicFact(); });
    expect(updateNode).toHaveBeenCalledWith('topic-1', { facts: [expect.objectContaining({ attribute: 'Price', value: '$99', sourceUrl: 'https://example.com/price' })] });
    expect(hook.result.current.topicFactDraft).toEqual({ attribute: '', value: '', sourceUrl: '' });
  });
});
