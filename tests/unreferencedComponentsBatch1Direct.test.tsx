import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LocationOptionButton } from '@/components/DataForSEO/pickers/LocationOptionButton';
import { PickerMenu } from '@/components/DataForSEO/pickers/PickerMenu';
import { ProviderActiveControls } from '@/components/Auth/subscriptionModal/ProviderActiveControls';
import { ProviderMethodButtons } from '@/components/Auth/subscriptionModal/ProviderMethodButtons';

describe('unreferenced components batch 1 direct assertions', () => {
  it('LocationOptionButton renders market label and responds to click', () => {
    const market = { code: 'PL', label: 'Poland', locationCode: 2616 } as any;
    const onClick = vi.fn();
    const onMouseEnter = vi.fn();

    render(
      <LocationOptionButton
        item={market}
        id="loc-btn-1"
        isSelected={false}
        isActive={true}
        onMouseEnter={onMouseEnter}
        onClick={onClick}
      />,
    );

    const button = screen.getByRole('option');
    expect(button.getAttribute('aria-selected')).toBe('false');
    expect(button.textContent).toContain('PL');
    fireEvent.mouseEnter(button);
    expect(onMouseEnter).toHaveBeenCalledOnce();
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('PickerMenu renders listbox with children or empty fallback', () => {
    const { rerender } = render(
      <PickerMenu listId="menu-1" ariaLabel="Test Menu" isEmpty={false}>
        <div data-testid="child">Item 1</div>
      </PickerMenu>,
    );

    expect(screen.getByRole('listbox', { name: 'Test Menu' }).contains(screen.getByTestId('child'))).toBe(true);

    rerender(
      <PickerMenu listId="menu-1" ariaLabel="Test Menu" isEmpty={true}>
        <div data-testid="child">Item 1</div>
      </PickerMenu>,
    );
    expect(screen.getByRole('listbox', { name: 'Test Menu' }).textContent).toContain('—');
  });

  it('ProviderMethodButtons renders connection method buttons', () => {
    const item = { id: 'openai' as const, name: 'OpenAI', cliSupported: true, models: [] } as any;
    const onSetMethod = vi.fn();
    const t = ((k: string) => k) as any;

    render(
      <ProviderMethodButtons
        item={item}
        method="local_cli"
        cli={null}
        onSetMethod={onSetMethod}
        t={t}
      />,
    );

    const localButton = screen.getByRole('button', { name: /auth\.localCliSubscription/ });
    const apiButton = screen.getByRole('button', { name: /auth\.directApiCredential/ });
    fireEvent.click(localButton);
    expect(onSetMethod).toHaveBeenCalledWith('openai', 'local_cli');
    fireEvent.click(apiButton);
    expect(onSetMethod).toHaveBeenCalledWith('openai', 'api_key');
  });

  it('ProviderActiveControls renders connection status and test button', () => {
    const item = { id: 'openai' as const, name: 'OpenAI', cliSupported: true, models: [] } as any;
    const onTest = vi.fn();
    const t = ((k: string) => k) as any;

    render(
      <ProviderActiveControls
        item={item}
        method="local_cli"
        status="connected"
        statusMessage="Connected"
        saving={false}
        onTestConnection={onTest}
        t={t}
      />,
    );

    const testBtn = screen.getByRole('button', { name: 'auth.testConnection' });
    expect(screen.getByText('Connected')).toBeTruthy();
    fireEvent.click(testBtn);
    expect(onTest).toHaveBeenCalledWith('openai');
  });
});
