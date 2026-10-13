import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SecretKeyField } from '@/components/Auth/SecretKeyField';
import i18n from '@/i18n';

const field = () => screen.getByLabelText('Provider key') as HTMLInputElement;
const button = (key: string) => screen.getByRole('button', { name: i18n.t(key) }) as HTMLButtonElement;
const show = (props: Partial<React.ComponentProps<typeof SecretKeyField>> = {}) => {
  const onSave = vi.fn<(value: string) => Promise<void>>().mockResolvedValue();
  render(<SecretKeyField label="Provider key" stored={false} inputClassName="x" onSave={onSave} {...props} />);
  return onSave;
};

describe('SecretKeyField', () => {
  beforeEach(async () => { await i18n.changeLanguage('en'); });

  it('keeps every typed character in the draft and writes the key once, on save', async () => {
    const onSave = show();
    expect(field().placeholder).toBe(i18n.t('auth.apiKeyPlaceholder'));
    expect(button('auth.saveApiKey').disabled).toBe(true);
    for (const typed of ['s', 'sk', 'sk-1']) fireEvent.change(field(), { target: { value: typed } });
    expect(field().value).toBe('sk-1');
    expect(onSave).not.toHaveBeenCalled();
    fireEvent.click(button('auth.saveApiKey'));
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe(i18n.t('runtimeErrors.ai.credentialSaved')));
    expect(onSave).toHaveBeenCalledExactlyOnceWith('sk-1');
    expect(field().value).toBe('');
  });

  it('saves a pasted key on Enter without its surrounding whitespace', async () => {
    const onSave = show();
    fireEvent.keyDown(field(), { key: 'Enter' });
    expect(onSave).not.toHaveBeenCalled();
    fireEvent.change(field(), { target: { value: '  apikey_01 \n' } });
    fireEvent.keyDown(field(), { key: 'a' });
    fireEvent.keyDown(field(), { key: 'Enter' });
    await waitFor(() => expect(onSave).toHaveBeenCalledExactlyOnceWith('apikey_01'));
  });

  it('marks a stored key without showing it and removes it on request', async () => {
    const onSave = show({ stored: true });
    expect([field().value, field().placeholder]).toEqual(['', i18n.t('auth.apiKeyStoredPlaceholder')]);
    fireEvent.click(button('auth.removeApiKey'));
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe(i18n.t('auth.apiKeyRemoved')));
    expect(onSave).toHaveBeenCalledExactlyOnceWith('');
  });

  it('offers removal only while no replacement is being typed', () => {
    show({ stored: true });
    fireEvent.change(field(), { target: { value: 'new' } });
    expect(screen.queryByRole('button', { name: i18n.t('auth.removeApiKey') })).toBeNull();
  });

  it('keeps the draft and says so when the store rejects the key', async () => {
    const onSave = show();
    onSave.mockRejectedValueOnce(new Error('keychain locked'));
    fireEvent.change(field(), { target: { value: 'sk-2' } });
    fireEvent.click(button('auth.saveApiKey'));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toBe(i18n.t('auth.apiKeySaveFailed')));
    expect(field().value).toBe('sk-2');
    fireEvent.change(field(), { target: { value: 'sk-3' } });
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('uses the caller placeholder and stays inert while disabled', () => {
    const onSave = show({ disabled: true, placeholder: 'Uses the local CLI', id: 'key' });
    expect([field().id, field().placeholder, field().disabled]).toEqual(['key', 'Uses the local CLI', true]);
    fireEvent.change(field(), { target: { value: 'sk-4' } });
    fireEvent.keyDown(field(), { key: 'Enter' });
    expect(button('auth.saveApiKey').disabled).toBe(true);
    expect(onSave).not.toHaveBeenCalled();
  });
});
