import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MetadataHreflang } from '@/components/Results/metadata/MetadataHreflang';
import { copyText } from '@/services/clipboard';
import { createAuditFixture } from './fixtures/audit';
import i18n from '@/i18n';

vi.mock('@/services/clipboard', () => ({ copyText: vi.fn() }));
afterEach(() => { vi.useRealTimers(); vi.clearAllMocks(); });

describe('direct metadata hreflang evidence contracts', () => {
  it('omits absent and empty observations', () => {
    const legacy = createAuditFixture();
    Reflect.deleteProperty(legacy.technical, "hreflang_tags");
    const view = render(<MetadataHreflang audit={legacy} />);
    expect(view.container.innerHTML).toBe('');
    view.rerender(<MetadataHreflang audit={createAuditFixture()} />);
    expect(view.container.innerHTML).toBe('');
  });
  it('copies the observed target only and displays confirmation only on successful copy', async () => {
    vi.useFakeTimers();
    const audit = createAuditFixture({ technical: { hreflang_tags: [
      { hreflang: 'pl', href: 'https://example.test/pl' },
      { hreflang: 'en', href: 'https://example.test/en' },
    ] } });
    const view = render(<MetadataHreflang audit={audit} />);
    expect(screen.getByText('pl')).toBeTruthy();
    expect(screen.getByText('https://example.test/en')).toBeTruthy();
    const buttons = screen.getAllByTitle(i18n.t('legacyUi.metadata.copyLink'));
    vi.mocked(copyText).mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    await act(async () => { fireEvent.click(buttons[0]); });
    expect(copyText).toHaveBeenLastCalledWith('https://example.test/pl');
    expect(view.container.querySelectorAll('.lucide-check')).toHaveLength(0);
    await act(async () => { fireEvent.click(buttons[1]); });
    expect(copyText).toHaveBeenLastCalledWith('https://example.test/en');
    expect(buttons[1].querySelector('.lucide-check')).toBeTruthy();
    expect(buttons[0].querySelector('.lucide-check')).toBeNull();
    act(() => { vi.advanceTimersByTime(1500); });
    expect(view.container.querySelectorAll('.lucide-check')).toHaveLength(0);
  });
});
