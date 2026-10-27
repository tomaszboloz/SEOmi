import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TFunction } from 'i18next';
import i18n from '@/i18n';
import { AmpFindingItem } from '@/components/Results/ampAudit/AmpFindingItem';
import { HeadingsTree } from '@/components/Results/HeadingsTree';
import { ImagesAudit } from '@/components/Results/ImagesAudit';
import { MetadataAccessibilityHidden } from '@/components/Results/metadata/MetadataAccessibilityHidden';
import { OverviewServerCard } from '@/components/Results/overview/OverviewServerCard';
import { ShowOnPageButton } from '@/components/Results/ShowOnPageButton';
import { useAuditStore } from '@/stores/auditStore';
import * as tauriService from '@/services/tauri';
import type { AmpFinding } from '@/types';
import { createAuditFixture } from './fixtures/audit';

vi.mock('@/components/Results/ShowOnPageButton', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/components/Results/ShowOnPageButton')>();
  return { ShowOnPageButton: (props: Parameters<typeof original.ShowOnPageButton>[0]) => <original.ShowOnPageButton {...props} /> };
});

const plainT = ((key: string) => key) as unknown as TFunction;

beforeEach(async () => { await i18n.changeLanguage('en'); });

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  act(() => { useAuditStore.setState({ showOnlyProblems: false }); });
});

describe('AmpFindingItem severity icon', () => {
  const finding = (severity: string) => ({ code: 'amp-img-missing-dimensions', severity, message: 'm', evidence: 'e', recommendation: 'r' }) as unknown as AmpFinding;
  const show = (severity: string) => {
    const view = render(<ul><AmpFindingItem finding={finding(severity)} t={plainT} /></ul>);
    return view.container.querySelector('svg')!.getAttribute('class')!;
  };

  it.each([['error', 'text-rose-300'], ['warning', 'text-amber-300'], ['info', 'text-sky-300']])('colors a %s finding with %s', (severity, color) => {
    expect(show(severity)).toContain(color);
  });

  it('uses the informational icon for anything below warning', () => {
    const info = show('info');
    cleanup();
    expect(show('warning')).not.toBe(info);
  });
});

describe('HeadingsTree', () => {
  it('falls back to the requested url and reports no problems in problems-only mode', () => {
    useAuditStore.setState({ showOnlyProblems: true });
    render(<HeadingsTree audit={createAuditFixture({ final_url: '', url: 'https://plain.test/' })} />);
    expect(screen.getByText(i18n.t('legacyUi.headings.noProblems'))).toBeTruthy();
  });
});

describe('ImagesAudit', () => {
  it('renders image rows for an audit without a final url', () => {
    render(<ImagesAudit audit={createAuditFixture({
      final_url: '', url: 'https://plain.test/page',
      images: [{ src: 'https://plain.test/a.png', alt: 'A', has_alt: true, width: '10', height: '10' }],
    })} />);
    expect(screen.getByText('https://plain.test/a.png', { exact: true })).toBeTruthy();
  });
});

describe('MetadataAccessibilityHidden without listed controls', () => {
  it.each([
    ['hidden_form_control_count', 'hidden_form_controls', 'accessibility.hiddenTitle'],
    ['anti_spam_text_control_count', 'anti_spam_text_controls', 'accessibility.antispamTitle'],
  ])('reports zero shown controls when %s is positive but %s is missing', (countKey, listKey, titleKey) => {
    const accessibility = { [countKey]: 4 } as never;
    render(<MetadataAccessibilityHidden audit={createAuditFixture({ accessibility })} />);
    expect(screen.getByText(i18n.t(titleKey, { count: 4 }))).toBeTruthy();
    expect(screen.getByText(i18n.t('accessibility.limitFirst', { shown: 0 }))).toBeTruthy();
    expect(listKey).toBeTruthy();
  });
});

describe('OverviewServerCard', () => {
  it('uses the error badge style for non-200 responses', () => {
    render(<OverviewServerCard audit={createAuditFixture({ http_status: 503 })} />);
    const badge = screen.getByText(i18n.t('exportUi.statuses.http', { status: 503 }));
    expect(badge.className).toContain('text-rose-400');
    expect(badge.className).not.toContain('text-emerald-400');
  });
});

describe('ShowOnPageButton', () => {
  it('shows the generic message when the preview rejects with a non-Error value', async () => {
    vi.spyOn(tauriService, 'openRenderedElementPreview').mockRejectedValue('denied');
    render(<ShowOnPageButton url="https://ex.test/" selector="a" label="link" />);
    fireEvent.click(screen.getByRole('button'));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toBe(i18n.t('componentUi.previewError')));
  });
});
