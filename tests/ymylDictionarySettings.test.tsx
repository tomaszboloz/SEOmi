import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '@/i18n';
import { YmylDictionarySettings } from '@/components/AI/YmylDictionarySettings';
import { readDictionarySettings } from '@/services/llmEconomy';

const NOW = new Date('2026-03-04T05:06:07.000Z');
const setup = () => render(<YmylDictionarySettings now={() => NOW} />);
const paste = (value: string) => fireEvent.change(screen.getByLabelText(/paste terms/i), { target: { value } });

beforeEach(() => localStorage.clear());
afterEach(() => vi.restoreAllMocks());

describe('YmylDictionarySettings', () => {
  it('shows the seed count and toggles the seed', () => {
    setup();
    expect(screen.getByText(/terms active/).textContent).toMatch(/^\d+ terms active/);
    fireEvent.click(screen.getByRole('checkbox'));
    expect(readDictionarySettings().useMeshSeed).toBe(false);
    expect(screen.getByText('Term list saved.')).toBeTruthy();
    expect(screen.getByText('0 terms active')).toBeTruthy();
  });

  it('saves a pasted list with an injected timestamp', () => {
    setup();
    paste('E11;Type 2 diabetes');
    fireEvent.click(screen.getByRole('button', { name: 'Save list' }));
    expect(readDictionarySettings()).toMatchObject({ userSource: 'pasted list', importedAt: NOW.toISOString() });
  });

  it('reports an empty list and keeps storage untouched', () => {
    setup();
    paste('1\n2');
    fireEvent.click(screen.getByRole('button', { name: 'Save list' }));
    expect(screen.getByText('No usable terms found.')).toBeTruthy();
    expect(readDictionarySettings().userText).toBe('');
  });

  it('imports a file and ignores an empty file selection', async () => {
    setup();
    const input = screen.getByLabelText(/import list/i);
    fireEvent.change(input, { target: { files: [] } });
    fireEvent.change(input, { target: { files: [new File(['Zolpidem\nTemazepam'], 'drugs.csv', { type: 'text/csv' })] } });
    await waitFor(() => expect(readDictionarySettings().userSource).toBe('drugs.csv'));
  });

  it('clears the imported list', () => {
    setup();
    paste('Zolpidem');
    fireEvent.click(screen.getByRole('button', { name: 'Save list' }));
    fireEvent.click(screen.getByRole('button', { name: 'Clear imported list' }));
    expect(readDictionarySettings()).toMatchObject({ userText: '', importedAt: null });
  });

  it('shows a failure when storage rejects the write', () => {
    setup();
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('denied'); });
    paste('Zolpidem');
    fireEvent.click(screen.getByRole('button', { name: 'Save list' }));
    expect(screen.getByText('Could not save the term list.')).toBeTruthy();
  });

  it('uses the real clock by default', () => {
    render(<YmylDictionarySettings />);
    paste('Zolpidem');
    fireEvent.click(screen.getByRole('button', { name: 'Save list' }));
    expect(readDictionarySettings().importedAt).not.toBeNull();
  });
});
