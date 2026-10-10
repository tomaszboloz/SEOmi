import { describe, expect, it, vi } from 'vitest';

vi.mock('@/styles/globals.css', () => ({}));
vi.mock('@/App', () => ({
  default: () => <div data-testid="mock-app">Mock App</div>,
}));

describe('main bootstrap', () => {
  it('mounts application into root element when language is ready', async () => {
    const root = document.createElement('div');
    root.id = 'root';
    document.body.appendChild(root);

    await import('@/main');
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(root.querySelector('[data-testid="mock-app"]')).not.toBeNull();
  });
});
