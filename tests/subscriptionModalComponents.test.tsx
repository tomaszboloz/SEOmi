import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PROVIDERS_CONFIG } from '@/components/Auth/subscriptionModal/subscriptionModalTypes';
import { SubscriptionModalHeader } from '@/components/Auth/subscriptionModal/SubscriptionModalHeader';
import { SubscriptionProviderCard } from '@/components/Auth/subscriptionModal/SubscriptionProviderCard';
import { codeFiles, maxLocReport } from '../scripts/check-max-loc.mjs';

const mockT = ((key: string, opts?: any) => {
  if (opts && typeof opts.command !== 'undefined') return `${key}:${opts.command}`;
  return key;
}) as any;

describe('SubscriptionModal modular architecture', () => {
  it('satisfies physical LOC <= 150 across SubscriptionModal and submodules', () => {
    const files = [
      'src/components/Auth/SubscriptionModal.tsx',
      ...codeFiles('src/components/Auth/subscriptionModal'),
    ];
    expect(files.length).toBe(7);
    const report = maxLocReport(files);
    expect(report.violations).toEqual([]);
  });

  it('declares providers configuration with openai, claude, and gemini', () => {
    const providerIds = PROVIDERS_CONFIG.map((p) => p.id);
    expect(providerIds).toEqual(['openai', 'claude', 'gemini']);
  });

  it('renders SubscriptionModalHeader and calls onClose', () => {
    const onClose = vi.fn();
    render(<SubscriptionModalHeader onClose={onClose} t={mockT} />);

    expect(screen.getByText('auth.connectionsTitle')).toBeTruthy();
    const closeBtn = screen.getByRole('button', { name: /auth.closeConnections/i });
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalled();
  });

  it('renders SubscriptionProviderCard and handles interactions', () => {
    const onSetProvider = vi.fn();
    const onSetMethod = vi.fn();
    const onSaveKey = vi.fn();
    const onTestConnection = vi.fn();

    render(
      <SubscriptionProviderCard
        item={PROVIDERS_CONFIG[0]}
        active={true}
        method="api_key"
        cli={{ provider: 'openai', command: 'codex', available: true, detail: 'Installed' }}
        status="connected"
        statusMessage="Ready"
        apiKey="sk-test-key"
        saving={false}
        onSetProvider={onSetProvider}
        onSetMethod={onSetMethod}
        onSaveKey={onSaveKey}
        onTestConnection={onTestConnection}
        t={mockT}
      />,
    );

    expect(screen.getByText('legacyUi.ai.openai')).toBeTruthy();
    expect(screen.getByText('auth.active')).toBeTruthy();

    const localCliBtn = screen.getByRole('button', { name: /auth\.localCliSubscription/i });
    fireEvent.click(localCliBtn);
    expect(onSetMethod).toHaveBeenCalledWith('openai', 'local_cli');

    const testBtn = screen.getByRole('button', { name: /auth\.testConnection/i });
    fireEvent.click(testBtn);
    expect(onTestConnection).toHaveBeenCalledWith('openai');
  });
});
