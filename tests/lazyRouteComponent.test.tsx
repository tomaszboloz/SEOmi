import { Suspense } from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { lazyRoute } from '@/services/lazyRoute';
afterEach(cleanup);

it('loads a lazy route only when rendered and renders the resolved component', async () => {
  const loader = vi.fn().mockResolvedValue({ default: () => <p>Loaded route</p> });
  const Route = lazyRoute(loader);
  expect(loader).not.toHaveBeenCalled();
  render(<Suspense fallback={<p>Loading route</p>}><Route /></Suspense>);
  expect(await screen.findByText('Loaded route')).toBeTruthy();
  expect(loader).toHaveBeenCalledOnce();
});

it('recovers one transient lazy-route failure and renders the actual retry result', async () => {
  const loader = vi.fn().mockRejectedValueOnce(new Error('temporary chunk error')).mockResolvedValue({ default: () => <p>Recovered route</p> });
  const Route = lazyRoute(loader);
  render(<Suspense fallback={<p>Loading route</p>}><Route /></Suspense>);
  expect(await screen.findByText('Recovered route')).toBeTruthy();
  expect(loader).toHaveBeenCalledTimes(2);
});
