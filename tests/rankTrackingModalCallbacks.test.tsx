import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { RankTrackingAddModal } from '@/components/Keywords/rankTracking/RankTrackingAddModal';
import { normalizeRankTrackingMarketDraft } from '@/components/Keywords/rankTracking/rankTrackingTypes';
import i18n from '@/i18n';

vi.mock('@/components/DataForSEO/DataForSeoPickers', () => ({
  DataForSeoLocationPicker: ({ onChange }: { onChange: (value: string) => void }) =>
    <button type="button" onClick={() => onChange('United States')}>Select location</button>,
  DataForSeoLanguagePicker: ({ onChange }: { onChange: (value: string) => void }) =>
    <button type="button" onClick={() => onChange('en')}>Select language</button>,
}));

const draft = { keyword: 'SEO', domain: 'example.test', targetUrl: '', location: 'Poland', language: 'pl' };

describe('direct rank tracking modal callbacks', () => {
  it('does not expose or dispatch controls while closed', () => {
    const update = vi.fn();
    const view = render(<RankTrackingAddModal isOpen={false} draft={draft} selectedMarket={undefined}
      onUpdateDraft={update} onClose={vi.fn()} onSubmit={vi.fn()} t={i18n.t} />);
    expect(view.container.innerHTML).toBe('');
    expect(update).not.toHaveBeenCalled();
  });
  it('dispatches literal field edits, normalized market, language, submit and cancel', () => {
    const update = vi.fn();
    const close = vi.fn();
    const submit = vi.fn((event) => event.preventDefault());
    const view = render(<RankTrackingAddModal isOpen draft={draft} selectedMarket={undefined}
      onUpdateDraft={update} onClose={close} onSubmit={submit} t={i18n.t} />);
    const fields = [
      ['keywordPlaceholder', 'keyword', 'updated phrase'],
      ['domainPlaceholder', 'domain', 'new.example.test'],
      ['targetUrlPlaceholder', 'targetUrl', 'https://new.example.test/page'],
    ];
    for (const [placeholder, field, value] of fields) {
      fireEvent.change(screen.getByPlaceholderText(i18n.t(`rankTrackingUi.${placeholder}`)), { target: { value } });
      expect(update).toHaveBeenLastCalledWith({ [field]: value });
    }
    fireEvent.click(screen.getByRole('button', { name: 'Select location' }));
    expect(update).toHaveBeenLastCalledWith(normalizeRankTrackingMarketDraft('United States', 'pl'));
    fireEvent.click(screen.getByRole('button', { name: 'Select language' }));
    expect(update).toHaveBeenLastCalledWith({ language: 'en' });
    const inputs = screen.getAllByRole('textbox') as HTMLInputElement[];
    expect(inputs.map((input) => input.required)).toEqual([true, true, false]);
    fireEvent.submit(view.container.querySelector('form')!);
    expect(submit).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole('button', { name: i18n.t('rankTrackingUi.cancel') }));
    expect(close).toHaveBeenCalledOnce();
    expect(submit).toHaveBeenCalledOnce();
  });
});
