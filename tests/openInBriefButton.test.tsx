import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OpenInBriefButton } from '@/components/Charts/OpenInBriefButton';
import { readTopicalMap, writeTopicalMap } from '@/services/topicalDocument/storage';
import { createTopicalNode } from '@/services/topicalMap';
import * as storage from '@/services/topicalDocument/storage';
import i18n from '@/i18n';

const input = { origin: 'sfs' as const, title: 'Topic', sourceUrl: 'https://s.test/t', missingEntities: ['entity'] };

describe('OpenInBriefButton', () => {
  beforeEach(() => localStorage.clear());

  it('click creates one brief with module fields, second click updates it', () => {
    const onOpened = vi.fn();
    render(<OpenInBriefButton projectId="p1" input={input} onOpened={onOpened} />);
    fireEvent.click(screen.getByRole('button', { name: i18n.t('executionCard.brief.open') }));
    expect(readTopicalMap('p1').nodes).toHaveLength(1);
    expect(readTopicalMap('p1').nodes[0].contentBrief.requiredEntities).toEqual(['entity']);
    expect(screen.getByRole('status').textContent).toBe(i18n.t('executionCard.brief.state.created'));
    fireEvent.click(screen.getByRole('button', { name: i18n.t('executionCard.brief.open') }));
    expect(readTopicalMap('p1').nodes).toHaveLength(1);
    expect(screen.getByRole('status').textContent).toBe(i18n.t('executionCard.brief.state.updated'));
    expect(onOpened).toHaveBeenCalledTimes(2);
  });

  it('reports failure when the map is full', () => {
    const doc = { ...readTopicalMap('full'), nodes: Array.from({ length: 300 }, (_, i) => ({ ...createTopicalNode(`t${i}`), id: `n${i}` })) };
    writeTopicalMap('full', doc);
    render(<OpenInBriefButton projectId="full" input={input} />);
    fireEvent.click(screen.getByRole('button', { name: i18n.t('executionCard.brief.open') }));
    expect(screen.getByRole('status').textContent).toBe(i18n.t('executionCard.brief.state.failed'));
  });

  it('works without onOpened and reports failure when storage throws', () => {
    render(<OpenInBriefButton projectId="p2" input={input} />);
    vi.spyOn(storage, 'writeTopicalMap').mockImplementationOnce(() => { throw new Error('x'); });
    fireEvent.click(screen.getByRole('button', { name: i18n.t('executionCard.brief.open') }));
    expect(screen.getByRole('status').textContent).toBe(i18n.t('executionCard.brief.state.failed'));
  });
});
