import { describe, expect, it } from 'vitest';
import { saveDraftVersion } from '@/services/briefDocument/versions';
import { compareDrafts } from '@/services/briefDocument/diff';
import { buildContentBriefExport, buildContentBriefMarkdown } from '@/services/briefDocument/handoff';
import { createEmptyContentBrief, createTopicalNode } from '@/services/topicalMap';
import i18n from '@/i18n';

describe('brief checkpoint and handoff contracts', () => {
  it('does not save empty drafts, bounds notes and history, and preserves identical checkpoint identity', () => {
    const blank = { ...createEmptyContentBrief(), draftMarkdown: ' \n' };
    expect(saveDraftVersion(blank)).toBe(blank);
    let brief = createEmptyContentBrief();
    for (let index = 0; index < 31; index += 1) {
      brief = saveDraftVersion({ ...brief, draftMarkdown: `draft ${index}` }, ` note ${index} `, '2026-10-01T00:00:00.000Z');
    }
    expect(brief.draftVersions).toHaveLength(30);
    expect(brief.draftVersions[0]).toMatchObject({ note: 'note 30', draftMarkdown: 'draft 30' });
    expect(brief.draftVersions.at(-1)?.note).toBe('note 1');
    expect(new Set(brief.draftVersions.map((version) => version.id)).size).toBe(30);
    expect(saveDraftVersion(brief, 'note 30')).toBe(brief);
    expect(saveDraftVersion(brief).draftVersions[0].note).toBe('');
    const longNote = saveDraftVersion(brief, 'x'.repeat(241));
    expect(longNote.draftVersions[0].note).toHaveLength(240);
    expect(Number.isNaN(Date.parse(longNote.draftVersions[0].savedAt))).toBe(false);
  });

  it('uses multiset counts without counting reordered lines as additions and bounds only evidence', () => {
    expect(compareDrafts('same\nother', 'other\nsame')).toMatchObject({ changed: true, addedLineCount: 0, removedLineCount: 0 });
    expect(compareDrafts('same', 'same')).toMatchObject({ changed: false, addedLines: [], removedLines: [] });
    expect(compareDrafts('a\na\nb', 'b\nc')).toMatchObject({ addedLines: ['c'], removedLines: ['a', 'a'], removedCharacterCount: 2 });
    const lines = Array.from({ length: 250 }, (_, index) => `line${index}`).join('\n');
    for (const [limit, expected] of [[NaN, 40], [Infinity, 40], [0, 1], [-4, 1], [2.9, 2], [900, 200]]) {
      const diff = compareDrafts('', lines, limit);
      expect(diff.addedLines).toHaveLength(expected);
      expect(diff.addedLineCount).toBe(250);
      expect(diff.removedLines).toEqual(['']);
    }
  });

  it('serializes only declared data and labels missing content without inventing facts', () => {
    const node = { ...createTopicalNode(''), title: '' };
    const brief = createEmptyContentBrief();
    const markdown = buildContentBriefMarkdown(node, brief);
    for (const key of ['draftTitle', 'notSelected', 'noEntities', 'noTargets', 'noDraft', 'exportNote']) {
      expect(markdown).toContain(i18n.t(`runtimeErrors.contentBrief.${key}`));
    }
    const payload = buildContentBriefExport(node, brief);
    expect(payload.brief).toBe(brief);
    expect(Object.keys(payload)).toEqual(['schemaVersion', 'exportedAt', 'node', 'brief']);
    expect(Number.isNaN(Date.parse(payload.exportedAt))).toBe(false);
    node.queries = [{ id: 'q', text: '', provenance: 'asserted' }];
    expect(buildContentBriefMarkdown(node, { ...brief, targetQueryId: 'q' })).toContain(i18n.t('runtimeErrors.contentBrief.notSelected'));
  });
});
