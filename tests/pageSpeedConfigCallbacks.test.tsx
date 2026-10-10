import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PageSpeedConfig } from '@/components/Performance/pagespeed/PageSpeedConfig';
import i18n from '@/i18n';

const label = (key: string) => i18n.t(`pageSpeedUi.${key}`);
const fixture = () => ({
  session: { url: 'https://example.test', strategy: 'mobile' as const, formFactor: 'PHONE' as const, scope: 'url' as const },
  updateSession: vi.fn(), isRunningPsi: false, isRunningCrux: false,
  psiError: null, cruxError: null, runPsi: vi.fn().mockResolvedValue(undefined),
  runCrux: vi.fn().mockResolvedValue(undefined), hasApiKey: false,
});

describe('direct PageSpeed configuration callbacks', () => {
  it('invalidates only affected measurements on URL, strategy, device and scope edits', () => {
    const props = fixture();
    render(<PageSpeedConfig {...props} />);
    fireEvent.change(screen.getByLabelText(label('urlLabel')), { target: { value: 'https://other.test' } });
    expect(props.updateSession).toHaveBeenLastCalledWith({ url: 'https://other.test', pageSpeed: null, crux: null });
    fireEvent.change(screen.getByLabelText(label('pageSpeedDevice')), { target: { value: 'desktop' } });
    expect(props.updateSession).toHaveBeenLastCalledWith({ strategy: 'desktop', pageSpeed: null });
    fireEvent.change(screen.getByLabelText(label('cruxDevice')), { target: { value: 'TABLET' } });
    expect(props.updateSession).toHaveBeenLastCalledWith({ formFactor: 'TABLET', crux: null });
    fireEvent.change(screen.getByLabelText(label('cruxScope')), { target: { value: 'origin' } });
    expect(props.updateSession).toHaveBeenLastCalledWith({ scope: 'origin', crux: null });
  });
  it('dispatches independent runs, disables busy actions and preserves provider errors', () => {
    const props = fixture();
    const view = render(<PageSpeedConfig {...props} />);
    expect(screen.getByText(label('apiMissing'))).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: label('runPageSpeed') }));
    fireEvent.click(screen.getByRole('button', { name: label('fetchFieldData') }));
    expect(props.runPsi).toHaveBeenCalledOnce();
    expect(props.runCrux).toHaveBeenCalledOnce();
    view.rerender(<PageSpeedConfig {...props} hasApiKey isRunningPsi isRunningCrux psiError="PSI unavailable" cruxError="No CrUX sample" />);
    expect(screen.getByText(label('apiConfigured'))).toBeTruthy();
    expect(screen.getAllByRole('alert').map((item) => item.textContent)).toEqual([
      `${label('psiPrefix')}: PSI unavailable`, `${label('cruxPrefix')}: No CrUX sample`,
    ]);
    for (const key of ['runningLighthouse', 'fetchingCrux']) {
      const button = screen.getByRole('button', { name: label(key) });
      expect((button as HTMLButtonElement).disabled).toBe(true);
      fireEvent.click(button);
    }
    expect(props.runPsi).toHaveBeenCalledOnce();
    expect(props.runCrux).toHaveBeenCalledOnce();
  });
});
