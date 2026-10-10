import { fireEvent, render, screen } from '@testing-library/react';
import type { TFunction } from 'i18next';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DomainAgePanel } from '@/components/SeoTools/workspace/DomainAgePanel';
import { useDomainAgeLookup } from '@/components/SeoTools/workspace/useDomainAgeLookup';
import i18n from '@/i18n';

vi.mock('@/components/SeoTools/workspace/useDomainAgeLookup', () => ({
  useDomainAgeLookup: vi.fn(),
}));

type Lookup = ReturnType<typeof useDomainAgeLookup>;
const t = ((key: string, options?: Record<string, unknown>) =>
  options?.count === undefined ? key : `${key}:${options.count}`) as unknown as TFunction;
const baseLookup = {
  t,
  i18n,
  domain: '',
  updateDomain: vi.fn(),
  record: null,
  registrationDate: null,
  error: null,
  loading: false,
  check: vi.fn().mockResolvedValue(undefined),
} as Lookup;

const configure = (overrides: Partial<Lookup> = {}) => {
  vi.mocked(useDomainAgeLookup).mockReturnValue({ ...baseLookup, ...overrides });
};

describe('DomainAgePanel direct contracts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    configure();
  });

  it('shows the empty lookup state and forwards input and lookup actions', () => {
    const view = render(<DomainAgePanel />);
    const input = screen.getByLabelText('seoTools.domainInput');
    const button = screen.getByRole('button', { name: 'seoTools.lookup' });

    expect((input as HTMLInputElement).value).toBe('');
    expect((button as HTMLButtonElement).disabled).toBe(false);
    expect(screen.getByText('seoTools.rdapNote')).toBeTruthy();
    expect(screen.queryByText('seoTools.domainAge')).toBeNull();
    fireEvent.change(input, { target: { value: 'example.org' } });
    fireEvent.click(button);
    expect(baseLookup.updateDomain).toHaveBeenCalledWith('example.org');
    expect(baseLookup.check).toHaveBeenCalledOnce();
    view.unmount();
  });

  it('exposes lookup errors and disables the action while loading', () => {
    const check = vi.fn().mockResolvedValue(undefined);
    configure({ domain: 'example.org', loading: true, error: 'RDAP unavailable', check });
    render(<DomainAgePanel />);

    expect(screen.getByRole('alert').textContent).toBe('RDAP unavailable');
    const button = screen.getByRole('button', { name: 'seoTools.loading' });
    expect((button as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(button);
    expect(check).not.toHaveBeenCalled();
    expect(screen.queryByText('seoTools.domainAge')).toBeNull();
  });

  it('renders a dated record with its observed name and computed age', () => {
    const registrationDate = '2001-02-03T00:00:00Z';
    configure({
      domain: 'input.example',
      record: { ldhName: 'observed.example', events: [] },
      registrationDate,
    });
    render(<DomainAgePanel />);

    expect(screen.getByText('observed.example')).toBeTruthy();
    expect(screen.getByText('seoTools.registrationDate')).toBeTruthy();
    expect(screen.getByText(new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium' }).format(new Date(registrationDate)))).toBeTruthy();
    expect(screen.getByText('seoTools.domainAge')).toBeTruthy();
    expect(screen.getByText(/^seoTools\.ageDays:/)).toBeTruthy();
  });

  it('uses the input name and unavailable labels when registration data is absent', () => {
    configure({
      domain: 'input.example',
      record: { ldhName: '', events: [] },
      registrationDate: null,
      error: 'seoTools.rdapUnavailable',
    });
    render(<DomainAgePanel />);

    expect(screen.getByText('input.example')).toBeTruthy();
    expect(screen.getByRole('alert').textContent).toBe('seoTools.rdapUnavailable');
    expect(screen.getAllByText('seoTools.notAvailable')).toHaveLength(2);
  });
});
