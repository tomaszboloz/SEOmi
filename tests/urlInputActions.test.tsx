import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { URLInput } from '@/components/URLBar/URLInput';
import { useProjectStore } from '@/stores/projectStore';
import { useAuditStore } from '@/stores/auditStore';
import { createAuditFixture } from './fixtures/audit';
import i18n from '@/i18n';

vi.mock('@/components/URLBar/urlInput/URLBatchQueueSection', () => ({ URLBatchQueueSection: () => null }));

const startAudit = vi.fn();
const DRAFT = 'seomi_project_u1_audit_url_draft_v1';
const box = () => screen.getByRole('textbox', { name: i18n.t('legacyUi.url.urlAria') }) as HTMLInputElement;
const analyze = () => screen.getByRole('button', { name: i18n.t('urlBar.analyze') });
const project = (rootUrl: string | undefined) => ({ id: 'u1', name: 'U', rootUrl, createdAt: 'x', lastOpenedAt: 'x' });

describe('URLInput actions', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en');
    localStorage.clear();
    startAudit.mockReset();
    useProjectStore.setState({ projects: [project('https://root.test/')], activeProjectId: 'u1' });
    useAuditStore.setState({ startAudit, isLoading: false, currentAudit: null } as never);
  });

  it('submits the trimmed URL', async () => {
    render(<URLInput />);
    fireEvent.change(box(), { target: { value: '  https://x.test/p  ' } });
    fireEvent.submit(box().closest('form')!);
    expect(startAudit).toHaveBeenCalledWith('https://x.test/p');
  });

  it('does not submit blank URLs or while an audit is loading', () => {
    render(<URLInput />);
    fireEvent.change(box(), { target: { value: '   ' } });
    fireEvent.submit(box().closest('form')!);
    expect((analyze() as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(box(), { target: { value: 'https://x.test' } });
    act(() => useAuditStore.setState({ isLoading: true } as never));
    fireEvent.submit(box().closest('form')!);
    expect(startAudit).not.toHaveBeenCalled();
  });

  it('truncates the stored draft to 2048 characters but keeps the full input', () => {
    render(<URLInput />);
    const long = `https://x.test/${'a'.repeat(3000)}`;
    fireEvent.change(box(), { target: { value: long } });
    expect(box().value).toBe(long);
    expect(localStorage.getItem(DRAFT)).toHaveLength(2048);
  });

  it('prefers a stored draft (even empty) over the project root URL', async () => {
    localStorage.setItem(DRAFT, '');
    render(<URLInput />);
    await waitFor(() => expect(box().value).toBe(''));
  });

  it('clears the field and stops persisting without an active project', async () => {
    useProjectStore.setState({ activeProjectId: null });
    render(<URLInput />);
    expect(box().value).toBe('');
    fireEvent.change(box(), { target: { value: 'https://x.test' } });
    expect(localStorage.length).toBe(0);
    expect(box().value).toBe('https://x.test');
  });

  it('falls back to an empty URL when the project has no root URL', () => {
    useProjectStore.setState({ projects: [project(undefined)] });
    render(<URLInput />);
    expect(box().value).toBe('');
  });

  it('pastes trimmed clipboard text, ignoring empty text and denied access', async () => {
    const readText = vi.fn().mockResolvedValueOnce('  https://pasted.test  ').mockResolvedValueOnce('').mockRejectedValueOnce(new Error('denied'));
    Object.defineProperty(navigator, 'clipboard', { value: { readText }, configurable: true });
    render(<URLInput />);
    const paste = screen.getByTitle(i18n.t('urlBar.quickPaste'));
    fireEvent.click(paste);
    await waitFor(() => expect(box().value).toBe('https://pasted.test'));
    expect(localStorage.getItem(DRAFT)).toBe('https://pasted.test');
    fireEvent.click(paste);
    fireEvent.click(paste);
    await waitFor(() => expect(readText).toHaveBeenCalledTimes(3));
    expect(box().value).toBe('https://pasted.test');
  });

  it('re-audits the current audit URL only when one exists', () => {
    useAuditStore.setState({ currentAudit: createAuditFixture({ url: 'https://done.test/' }) } as never);
    render(<URLInput />);
    fireEvent.click(screen.getByTitle(i18n.t('legacyUi.url.reauditTitle')));
    expect(startAudit).toHaveBeenCalledWith('https://done.test/');
  });

  it('hides re-audit without a current audit', () => {
    render(<URLInput />);
    expect(screen.queryByTitle(i18n.t('legacyUi.url.reauditTitle'))).toBeNull();
  });

  it('skips re-audit when the current audit has no URL', () => {
    useAuditStore.setState({ currentAudit: createAuditFixture({ url: '' }) } as never);
    render(<URLInput />);
    fireEvent.click(screen.getByTitle(i18n.t('legacyUi.url.reauditTitle')));
    expect(startAudit).not.toHaveBeenCalled();
  });
});
