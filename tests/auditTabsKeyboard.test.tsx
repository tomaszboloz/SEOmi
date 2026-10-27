import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuditTabs } from '@/components/Results/AuditTabs';
import { useAuditStore } from '@/stores/auditStore';
import i18n from '@/i18n';

const tab = (key: string) => screen.getByRole('tab', { name: i18n.t(`sidebar.${key}`) });

describe('AuditTabs keyboard navigation and scrolling', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en');
    useAuditStore.setState({ activeTab: 'overview', showOnlyProblems: false });
    Element.prototype.scrollIntoView = vi.fn();
  });

  it('moves to the next tab with ArrowRight and focuses it', () => {
    render(<AuditTabs />);
    fireEvent.keyDown(tab('overview'), { key: 'ArrowRight' });
    expect(useAuditStore.getState().activeTab).toBe('metadata');
    expect(document.activeElement).toBe(tab('metadata'));
  });

  it('wraps ArrowLeft from the first tab to the last and ArrowRight back', () => {
    render(<AuditTabs />);
    fireEvent.keyDown(tab('overview'), { key: 'ArrowLeft' });
    expect(useAuditStore.getState().activeTab).toBe('dataforseo');
    fireEvent.keyDown(tab('dataforseo'), { key: 'ArrowRight' });
    expect(useAuditStore.getState().activeTab).toBe('overview');
  });

  it('jumps with Home and End', () => {
    render(<AuditTabs />);
    fireEvent.keyDown(tab('overview'), { key: 'End' });
    expect(useAuditStore.getState().activeTab).toBe('dataforseo');
    fireEvent.keyDown(tab('dataforseo'), { key: 'Home' });
    expect(useAuditStore.getState().activeTab).toBe('overview');
  });

  it('ignores unrelated keys', () => {
    render(<AuditTabs />);
    fireEvent.keyDown(tab('overview'), { key: 'a' });
    expect(useAuditStore.getState().activeTab).toBe('overview');
  });

  it('selects a tab on click and marks it selected with a roving tabindex', () => {
    render(<AuditTabs />);
    fireEvent.click(tab('security'));
    expect(tab('security').getAttribute('aria-selected')).toBe('true');
    expect(tab('security').getAttribute('tabindex')).toBe('0');
    expect(tab('overview').getAttribute('tabindex')).toBe('-1');
  });

  it('scrolls the active tab into view when it changes', () => {
    render(<AuditTabs />);
    fireEvent.click(tab('links'));
    expect(Element.prototype.scrollIntoView).toHaveBeenLastCalledWith(
      { behavior: 'smooth', block: 'nearest', inline: 'nearest' },
    );
  });

  it('scrolls the tab strip by 280px in either direction when supported', () => {
    const scrollBy = vi.fn();
    Element.prototype.scrollBy = scrollBy;
    render(<AuditTabs />);
    fireEvent.click(screen.getByRole('button', { name: i18n.t('audit.scrollNext') }));
    expect(scrollBy).toHaveBeenLastCalledWith({ left: 280, behavior: 'smooth' });
    fireEvent.click(screen.getByRole('button', { name: i18n.t('audit.scrollPrevious') }));
    expect(scrollBy).toHaveBeenLastCalledWith({ left: -280, behavior: 'smooth' });
  });

  it('does not throw when scrollBy and scrollIntoView are unavailable', () => {
    Element.prototype.scrollBy = undefined as never;
    Element.prototype.scrollIntoView = undefined as never;
    render(<AuditTabs />);
    expect(() => fireEvent.click(screen.getByRole('button', { name: i18n.t('audit.scrollNext') }))).not.toThrow();
    fireEvent.click(tab('amp'));
    expect(useAuditStore.getState().activeTab).toBe('amp');
  });

  it('toggles the only-problems filter', () => {
    render(<AuditTabs />);
    const toggle = screen.getByRole('button', { name: i18n.t('audit.onlyProblems') });
    fireEvent.click(toggle);
    expect(useAuditStore.getState().showOnlyProblems).toBe(true);
    expect(toggle.getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(toggle);
    expect(useAuditStore.getState().showOnlyProblems).toBe(false);
  });

  it('handles moveFocus safely when tab index is not found', () => {
    render(<AuditTabs />);
    const spy = vi.spyOn(Array.prototype, 'findIndex').mockReturnValueOnce(-1);
    fireEvent.keyDown(tab('overview'), { key: 'ArrowRight' });
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
