import { describe, expect, it } from 'vitest';
import { assessAeoReadiness, assessContentBrief, assessDraftQuality, buildContentBriefExport, buildContentBriefMarkdown, compareDrafts, extractDraftParagraphs, saveDraftVersion, updateParagraphReview, verifiedFactsForReuse } from '@/services/contentBrief';
import { createEmptyContentBrief, createTopicalNode } from '@/services/topicalMap';

import i18n from '@/i18n';
import { crawled, fact } from "./fixtures/contentBriefContracts";

describe('content brief evidence gate', () => {

it('scores extractable answer structure but labels the result as advisory, not AI visibility', () => {
    const draft = `# Espresso\n\nEspresso is a concentrated coffee drink made by forcing hot water through finely ground coffee.\n\n## Jak przygotować espresso?\n\nNajpierw zmiel kawę drobno, następnie ubij ją równomiernie i rozpocznij ekstrakcję.\n\n- Zmiel ziarna\n- Przygotuj portafilter\n\n| Parametr | Wartość |\n|---|---|\n| Mielenie | drobne |`;
    const result = assessAeoReadiness(draft, 'definition', ['Article']);

    expect(result.score).toBe(100);
    expect(result.questionHeadings).toBe(1);
    expect(result.answeredQuestionHeadings).toBe(1);
    expect(result.schemaTypesObserved).toEqual(['Article']);
    expect(result.outlineIssues).toEqual([]);
    expect(result.methodology).toBe(i18n.t('runtimeErrors.contentBrief.aeoMethodology'));
    expect(assessAeoReadiness(draft, 'none').components.schemaSignal).toBe(0);
  });

it('reports outline issues without changing the advisory score gate', () => {
    const result = assessAeoReadiness('# Tytuł\n\n### Zagnieżdżenie', 'none');

    expect(result.outlineIssues).toEqual([i18n.t('runtimeErrors.contentBrief.outlineJump', { previous: 1, level: 3 })]);
    expect(result.score).toBeGreaterThanOrEqual(0);
  });

it('scores editorial depth and anti-filler as an advisory signal, without converting it into a readiness gate', () => {
    const good = `# Poradnik\n\n## Jak działa proces?\n\nW praktyce najpierw sprawdź HTTP status i źródło danych. Na przykład porównaj odpowiedzi 200 i 404 w Google Search Console, a następnie opisz wpływ na konkretny URL.\n\n## Kiedy użyć tej metody?\n\nRozważmy dwa URL-e, które mają osobne intencje i różne linki wewnętrzne. Dla przykładu crawler może je znaleźć z mapy XML, ale tylko treść główna pokaże kontekst powiązania.`;
    const thin = `## W skrócie\n\nOgólnie rzecz biorąc, jeśli chodzi o rozwiązanie, jest ono bardzo ważne i odgrywa kluczową rolę. Warto zauważyć, że w dzisiejszym świecie szeroki zakres nowoczesnych rozwiązań jest kluczowy.`;

    const goodScore = assessDraftQuality(good, 60);
    const thinScore = assessDraftQuality(thin, 60);

    expect(goodScore.score).toBeGreaterThan(thinScore.score);
    expect(goodScore.components.depth).toBeGreaterThanOrEqual(0);
    expect(goodScore.components).toMatchObject({ examples: 20, length: 15 });
    expect(thinScore.fillerMatches.length).toBeGreaterThan(0);
    const node = { ...createTopicalNode('Guide'), queries: [{ id: 'q1', text: 'espresso guide', provenance: 'asserted' as const }] };
    const brief = { ...createEmptyContentBrief(), targetQueryId: 'q1', snippetTarget: 'definition' as const, draftMarkdown: thin, paragraphReviews: extractDraftParagraphs(thin).map((paragraph) => ({ paragraph, treatment: 'editorial' as const, sourceUrl: '', sourceChecked: false })) };
    expect(assessContentBrief(node, brief, [], []).readyToAdvance).toBe(true);
    expect(assessContentBrief(node, brief, [], []).draftQuality.score).toBe(assessDraftQuality(thin).score);
  });

it('blocks exact reuse of locked facts and requires the declared query, concepts, and live internal URLs', () => {
    const node = { ...createTopicalNode('Guide'), queries: [{ id: 'q1', text: 'espresso guide', provenance: 'asserted' as const }] };
    const brief = { ...createEmptyContentBrief(), targetQueryId: 'q1', requiredEntities: ['espresso', 'grinder'], snippetTarget: 'definition' as const, internalLinkTargets: ['https://site.test/guide#overview'], draftMarkdown: 'An espresso guide describes grinder basics. Claim says 42 units.' };
    const locked = fact('42 units', 'locked', 'https://site.test/fact');

    const result = assessContentBrief(node, brief, [locked], crawled);
    expect(result.lockedFactsInDraft).toEqual([locked]);
    expect(result.unavailableInternalLinks).toEqual([]);
    expect(result.readyToAdvance).toBe(false);
    expect(result.wordCount).toBe(10);
  });

it('allows a complete draft only after explicit fact verification and source entry', () => {
    const node = { ...createTopicalNode('Guide'), queries: [{ id: 'q1', text: 'espresso guide', provenance: 'asserted' as const }] };
    const draftMarkdown = 'An espresso guide explains grinder setup.';
    const brief = { ...createEmptyContentBrief(), targetQueryId: 'q1', requiredEntities: ['espresso', 'grinder'], snippetTarget: 'steps' as const, internalLinkTargets: ['https://site.test/guide'], draftMarkdown, paragraphReviews: [{ paragraph: draftMarkdown, treatment: 'source-backed' as const, sourceUrl: 'https://site.test/evidence', sourceChecked: true }] };
    const verified = fact('42 units', 'verified', 'https://site.test/fact');

    const result = assessContentBrief(node, brief, [verified], crawled);
    expect(result.readyToAdvance).toBe(true);
    expect(verifiedFactsForReuse([verified, fact('Unknown', 'verified')])).toEqual([verified]);
  });

it('keeps a missing source locked even if stale data says it was verified', () => {
    const normalized = fact('Claim', 'verified', '');
    const node = createTopicalNode('Guide');
    const result = assessContentBrief(node, createEmptyContentBrief(), [normalized], []);
    expect(result.lockedFactsInDraft).toEqual([]);
    expect(verifiedFactsForReuse([normalized])).toEqual([]);
    expect(result.readyToAdvance).toBe(false);
  });

it('requires an explicit review for every draft paragraph and a checked source for factual paragraphs', () => {
    const node = { ...createTopicalNode('Guide'), queries: [{ id: 'q1', text: 'espresso guide', provenance: 'asserted' as const }] };
    const paragraph = 'Espresso recipes vary by region.';
    const brief = { ...createEmptyContentBrief(), targetQueryId: 'q1', snippetTarget: 'faq' as const, draftMarkdown: paragraph };
    const unreviewed = assessContentBrief(node, brief, [], []);
    expect(unreviewed.unreviewedParagraphs).toEqual([paragraph]);
    expect(unreviewed.readyToAdvance).toBe(false);

    const checked = updateParagraphReview(brief.paragraphReviews, paragraph, { treatment: 'source-backed', sourceUrl: 'https://site.test/evidence', sourceChecked: true });
    const result = assessContentBrief(node, { ...brief, paragraphReviews: checked }, [], []);
    expect(result.unreviewedParagraphs).toEqual([]);
    expect(result.unsupportedParagraphs).toEqual([]);
    expect(result.readyToAdvance).toBe(true);
  });

it('invalidates a source confirmation when the evidence URL changes', () => {
    const paragraph = 'A claim.';
    const checked = updateParagraphReview([], paragraph, { treatment: 'source-backed', sourceUrl: 'https://site.test/a', sourceChecked: true });
    const changed = updateParagraphReview(checked, paragraph, { sourceUrl: 'https://site.test/b', sourceChecked: false });
    expect(changed[0]).toMatchObject({ treatment: 'source-backed', sourceUrl: 'https://site.test/b', sourceChecked: false });
  });

it('saves bounded explicit draft checkpoints and de-duplicates identical consecutive versions', () => {
    const brief = { ...createEmptyContentBrief(), draftMarkdown: 'Line one\nLine two' };
    const first = saveDraftVersion(brief, 'initial', '2026-09-24T10:00:00.000Z');
    const duplicate = saveDraftVersion(first, 'initial', '2026-09-24T10:01:00.000Z');
    const second = saveDraftVersion({ ...first, draftMarkdown: 'Line one\nLine three' }, 'updated', '2026-09-24T10:02:00.000Z');

    expect(first.draftVersions).toHaveLength(1);
    expect(duplicate.draftVersions).toHaveLength(1);
    expect(second.draftVersions).toHaveLength(2);
    expect(second.draftVersions[0]).toMatchObject({ note: 'updated', draftMarkdown: 'Line one\nLine three' });
  });

it('produces a bounded line diff with repeated-line counts', () => {
    const diff = compareDrafts('same\nremoved\nsame', 'same\nadded\nsame\nadded', 1);

    expect(diff).toMatchObject({ changed: true, addedLineCount: 2, removedLineCount: 1, addedCharacterCount: 10, removedCharacterCount: 7 });
    expect(diff.addedLines).toEqual(['added']);
    expect(diff.removedLines).toEqual(['removed']);
  });

it('exports only declared brief data with provenance-safe Markdown and JSON', () => {
    const node = { ...createTopicalNode('Coffee guide'), lifecycle: 'drafted' as const, queries: [{ id: 'q1', text: 'coffee guide', provenance: 'asserted' as const }] };
    const brief = { ...createEmptyContentBrief(), targetQueryId: 'q1', requiredEntities: ['coffee'], internalLinkTargets: ['https://site.test/about'], draftMarkdown: 'Coffee guide draft.' };
    const markdown = buildContentBriefMarkdown(node, brief);
    const payload = buildContentBriefExport(node, brief, '2026-09-24T10:00:00.000Z');

    expect(markdown).toContain('# Coffee guide');
    expect(markdown).toContain('coffee guide');
    expect(markdown).toContain('https://site.test/about');
    expect(markdown).toContain(i18n.t('runtimeErrors.contentBrief.exportNote'));
    expect(payload).toEqual({ schemaVersion: 1, exportedAt: '2026-09-24T10:00:00.000Z', node: { id: node.id, title: 'Coffee guide', lifecycle: 'drafted' }, brief });
  });
});
