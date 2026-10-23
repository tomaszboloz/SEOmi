import { describe, expect, it } from 'vitest';
import { createEmptyTopicalMap } from '@/services/topicalMap';
import { applyRecommendationToBrief } from '@/services/executionCard/briefInjection';
import { BLOCK_END, BLOCK_START, upsertBlock } from '@/services/executionCard/briefBlock';
import type { BriefRecommendationInput } from '@/services/executionCard/briefInput';

const input: BriefRecommendationInput = {
  origin: 'tas', title: 'Solar panels', sourceUrl: 'https://s.test/solar',
  missingEntities: ['inverter', 'inverter', ' '],
  links: { donorUrls: ['https://s.test/a', 'javascript:x'], targetPillarUrl: 'https://s.test/pillar', anchors: ['solar guide'] },
  paaQuestions: ['How much?'], h2Structure: ['Cost'], jsonLdAuthorGaps: ['sameAs'],
  footnotes: [{ attribute: 'Efficiency', value: '22%', sourceUrl: 'https://src.test/e' }, { attribute: 'Bad', value: 'x', sourceUrl: 'nope' }, { attribute: '', value: 'x', sourceUrl: 'https://src.test/e' }],
};

describe('applyRecommendationToBrief', () => {
  it('creates a brief with fields from the modules', () => {
    const { document, created, nodeId } = applyRecommendationToBrief(createEmptyTopicalMap(), input);
    const node = document.nodes[0];
    expect(created).toBe(true);
    expect(nodeId).toBe(node.id);
    expect(node.lifecycle).toBe('briefed');
    expect(node.sourceUrls).toEqual([input.sourceUrl]);
    expect(node.contentBrief.requiredEntities).toEqual(['inverter']);
    expect(node.contentBrief.internalLinkTargets).toEqual(['https://s.test/pillar', 'https://s.test/a']);
    expect(node.contentBrief.draftMarkdown).toContain('How much?');
    expect(node.contentBrief.draftMarkdown).toContain('solar guide');
    expect(node.facts).toHaveLength(1);
  });

  it('does not duplicate the brief, facts or block on repeated clicks', () => {
    const first = applyRecommendationToBrief(createEmptyTopicalMap(), input).document;
    const second = applyRecommendationToBrief(first, { ...input, missingEntities: ['panel'] });
    expect(second.created).toBe(false);
    expect(second.document.nodes).toHaveLength(1);
    const node = second.document.nodes[0];
    expect(node.contentBrief.requiredEntities).toEqual(['inverter', 'panel']);
    expect(node.facts).toHaveLength(1);
    expect(node.contentBrief.draftMarkdown.split(BLOCK_START)).toHaveLength(2);
  });

  it('matches by title and keeps an existing draft and lifecycle', () => {
    const base = applyRecommendationToBrief(createEmptyTopicalMap(), { origin: 'sfs', title: 'Solar Panels', sourceUrl: 'https://s.test/x' }).document;
    base.nodes[0].lifecycle = 'drafted';
    base.nodes[0].contentBrief.draftMarkdown = 'my text';
    const next = applyRecommendationToBrief(base, { origin: 'eetv', title: 'solar panels', sourceUrl: 'https://s.test/y' });
    expect(next.document.nodes).toHaveLength(1);
    expect(next.document.nodes[0].lifecycle).toBe('drafted');
    expect(next.document.nodes[0].contentBrief.draftMarkdown.startsWith('my text')).toBe(true);
    expect(next.document.nodes[0].sourceUrls).toHaveLength(2);
  });

  it('updates only the matching node and omits anchors when none are given', () => {
    const first = applyRecommendationToBrief(createEmptyTopicalMap(), { origin: 'sfs', title: 'One', sourceUrl: 'https://s.test/1' }).document;
    const two = applyRecommendationToBrief(first, { origin: 'tas', title: 'Two', sourceUrl: 'https://s.test/2', links: { donorUrls: [], targetPillarUrl: 'https://s.test/p' } }).document;
    const again = applyRecommendationToBrief(two, { origin: 'sfs', title: 'One', sourceUrl: 'https://s.test/1', missingEntities: ['x'] }).document;
    expect(again.nodes).toHaveLength(2);
    expect(again.nodes[1]).toBe(two.nodes[1]);
    expect(two.nodes[1].contentBrief.draftMarkdown).not.toContain('(');
  });

  it('emits empty sections for empty input and refuses beyond the node cap', () => {
    const doc = applyRecommendationToBrief(createEmptyTopicalMap(), { origin: 'eetv', title: 'T', sourceUrl: 'https://s.test/t', links: { donorUrls: [] } }).document;
    expect(doc.nodes[0].contentBrief.draftMarkdown).not.toContain('\n- ');
    const full = { ...doc, nodes: Array.from({ length: 300 }, (_, i) => ({ ...doc.nodes[0], id: `n${i}`, title: `t${i}`, sourceUrls: [] })) };
    expect(applyRecommendationToBrief(full, input)).toEqual({ document: full, nodeId: null, created: false });
  });

  it('upsertBlock appends or replaces', () => {
    expect(upsertBlock('', 'B')).toBe('B');
    expect(upsertBlock('x', 'B')).toBe('x\n\nB');
    expect(upsertBlock(`a${BLOCK_START}old${BLOCK_END}z`, 'NEW')).toBe('aNEWz');
  });
});
