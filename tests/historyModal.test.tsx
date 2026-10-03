import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HistoryModal } from '@/components/History/HistoryModal';
import { useAuditStore } from '@/stores/auditStore';
import { useUIStore } from '@/stores/uiStore';
import i18n from '@/i18n';
import { createAuditFixture } from './fixtures/audit';

const auditState = useAuditStore.getState();
const uiState = useUIStore.getState();
const closeModal = vi.fn();
afterEach(() => {
  useAuditStore.setState(auditState);
  useUIStore.setState(uiState);
});
beforeEach(async () => {
  localStorage.clear();
  closeModal.mockClear();
  await i18n.changeLanguage('en');
  useAuditStore.setState({ history: [], currentAudit: null });
  useUIStore.setState({ closeModal });
});

describe('public audit history modal', () => {
  it('describes empty history and closes only through dismissal controls or the backdrop', () => {
    const view = render(<HistoryModal />);
    const dialog = screen.getByRole('dialog', { name: i18n.t('urlBar.history') });
    expect(dialog.getAttribute('aria-describedby')).toBe('audit-history-description');
    expect(screen.getByText(i18n.t('urlBar.historyEmpty'))).toBeTruthy();
    fireEvent.mouseDown(dialog);
    expect(closeModal).not.toHaveBeenCalled();
    fireEvent.mouseDown(screen.getByRole('presentation'));
    fireEvent.click(screen.getByRole('button', { name: i18n.t('urlBar.closeHistory') }));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(closeModal).toHaveBeenCalledTimes(3);
    view.unmount();
    expect(document.body.style.overflow).not.toBe('hidden');
  });

  it.each(['click', 'Enter', ' '] as const)('loads the exact historical snapshot using %s', (activation) => {
    const selected = createAuditFixture({ health_score: 92 });
    const older = createAuditFixture({ final_url: 'https://older.example', health_score: 24,
      meta_tags: { ...createAuditFixture().meta_tags, title: '' } });
    useAuditStore.setState({ history: [selected, older] });
    render(<HistoryModal />);
    const entry = screen.getAllByRole('button', { name: i18n.t('urlBar.loadAudit', { url: selected.final_url }) })
      .find(button => button.tagName === 'DIV')!;
    fireEvent.keyDown(entry, { key: 'ArrowDown' });
    expect(useAuditStore.getState().currentAudit).toBeNull();
    if (activation === 'click') fireEvent.click(entry);
    else fireEvent.keyDown(entry, { key: activation });
    expect(useAuditStore.getState().currentAudit).toBe(selected);
    expect(closeModal).toHaveBeenCalledTimes(1);
    expect(screen.getAllByText(older.final_url)).toHaveLength(2);
  });

  it('uses the load button and removes only the requested history row', () => {
    const selected = createAuditFixture();
    const retained = createAuditFixture({ final_url: 'https://retained.example' });
    useAuditStore.setState({ history: [selected, retained] });
    render(<HistoryModal />);
    const load = screen.getAllByRole('button', { name: i18n.t('urlBar.loadAudit', { url: selected.final_url }) })
      .find(button => button.tagName === 'BUTTON')!;
    fireEvent.click(load);
    expect(useAuditStore.getState().currentAudit).toBe(selected);
    fireEvent.click(screen.getByRole('button', { name: i18n.t('urlBar.removeAudit', { url: selected.final_url }) }));
    expect(useAuditStore.getState().history).toEqual([retained]);
    act(() => useAuditStore.setState({ history: [] }));
    expect(screen.getByText(i18n.t('urlBar.historyEmpty'))).toBeTruthy();
  });
});
