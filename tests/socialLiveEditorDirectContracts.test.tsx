import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SocialLiveEditor } from '@/components/Results/social/SocialLiveEditor';
import { useUIStore } from '@/stores/uiStore';
import i18n from '@/i18n';

const label = (key: string) => i18n.t(`legacyUi.social.${key}`);
const fixture = () => ({ showLiveEditor: false, setShowLiveEditor: vi.fn(), handleReset: vi.fn(),
  liveDraft: { title: 'Measured title', description: 'Measured description', image: '', query: '' },
  updateDraft: vi.fn(), isPixelWidthOptimal: true, isTitleOptimal: true, isDescOptimal: true,
  estimatedPixelWidth: 200, pixelLimits: { title: 600, snippet: 900 }, serpMode: 'desktop' as const,
});
afterEach(() => useUIStore.setState({ activeModal: null }));

describe('direct social live editor controls', () => {
  it('expands/collapses, resets and opens the AI editor without mutating observations', () => {
    const props = fixture();
    const view = render(<SocialLiveEditor {...props} />);
    expect(screen.queryByRole('textbox')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: label('expand') }));
    expect(props.setShowLiveEditor).toHaveBeenLastCalledWith(true);
    fireEvent.click(screen.getByTitle(label('resetTitle')));
    expect(props.handleReset).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole('button', { name: label('aiOptimize') }));
    expect(useUIStore.getState().activeModal).toBe('ai');
    view.rerender(<SocialLiveEditor {...props} showLiveEditor />);
    fireEvent.click(screen.getByRole('button', { name: label('collapse') }));
    expect(props.setShowLiveEditor).toHaveBeenLastCalledWith(false);
  });
  it('dispatches all draft fields and displays observed character/pixel status', () => {
    const props = fixture();
    const view = render(<SocialLiveEditor {...props} showLiveEditor />);
    for (const [placeholder, field, value] of [
      ['titlePlaceholder', 'title', 'New title'], ['descriptionPlaceholder', 'description', 'New description'],
      ['imagePlaceholder', 'image', 'https://example.test/image.jpg'], ['searchQueryPlaceholder', 'query', 'target phrase'],
    ]) {
      fireEvent.change(screen.getByPlaceholderText(label(placeholder)), { target: { value } });
      expect(props.updateDraft).toHaveBeenLastCalledWith({ [field]: value });
    }
    expect(view.container.textContent).toContain('(desktop)');
    expect(view.container.textContent).toContain('14 / 60');
    expect(view.container.querySelectorAll('.text-amber-400')).toHaveLength(0);
    view.rerender(<SocialLiveEditor {...props} showLiveEditor isPixelWidthOptimal={false} isTitleOptimal={false} isDescOptimal={false} serpMode="mobile" />);
    expect(view.container.querySelectorAll('.text-amber-400')).toHaveLength(3);
    expect(view.container.textContent).toContain('(mobile)');
    expect(props.liveDraft.title).toBe('Measured title');
  });
});
