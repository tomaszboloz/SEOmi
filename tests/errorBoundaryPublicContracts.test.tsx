import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RootErrorBoundary } from '@/components/Layout/RootErrorBoundary';
import { RouteErrorBoundary } from '@/components/Layout/RouteErrorBoundary';

const rootProps = { title: 'App failed', description: 'Try recovery', retryLabel: 'Retry app', reloadLabel: 'Reload app', children: <p>App content</p> };
const routeProps = { title: 'Route failed', description: 'Try route recovery', retryLabel: 'Retry route', backLabel: 'Go back', onBack: vi.fn(), children: <p>Route content</p> };
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('error boundary public methods', () => {
  it('captures root failure state and logs the supplied component stack', () => {
    const error = new Error('root failure');
    expect(RootErrorBoundary.getDerivedStateFromError(error)).toEqual({ error });
    const boundary = new RootErrorBoundary(rootProps);
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    boundary.componentDidCatch(error, { componentStack: 'stack' });
    expect(log).toHaveBeenCalledExactlyOnceWith('root-render-failed', error, 'stack');
    expect(boundary.render()).toBe(rootProps.children);
  });
  it('renders the root fallback and dispatches retry/reload without losing diagnostic evidence', () => {
    const boundary = new RootErrorBoundary(rootProps);
    boundary.state = { error: new Error('root failure') };
    const update = vi.spyOn(boundary, 'setState').mockImplementation(() => undefined);
    render(boundary.render());
    expect(screen.getByRole('alert').textContent).toContain('App failed');
    expect(screen.getByText('root failure')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Retry app' }));
    expect(update).toHaveBeenCalledExactlyOnceWith({ error: null });
    const reload = vi.fn();
    const button = screen.getByRole('button', { name: 'Reload app' });
    vi.stubGlobal('window', { location: { reload } });
    fireEvent.click(button);
    expect(reload).toHaveBeenCalledTimes(1);
  });
  it('captures route failure state while retaining only workflow diagnostics', () => {
    const error = new Error('route failure');
    expect(RouteErrorBoundary.getDerivedStateFromError()).toEqual({ hasError: true });
    const boundary = new RouteErrorBoundary(routeProps);
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    boundary.componentDidCatch(error, { componentStack: null });
    expect(log).toHaveBeenCalledExactlyOnceWith('route-render-failed', error, null);
    expect(boundary.render()).toBe(routeProps.children);
  });
  it('renders a recoverable route fallback with retry and navigation actions', () => {
    const boundary = new RouteErrorBoundary(routeProps);
    boundary.state = { hasError: true };
    const update = vi.spyOn(boundary, 'setState').mockImplementation(() => undefined);
    render(boundary.render());
    expect(screen.getByRole('alert').textContent).toContain('Route failed');
    fireEvent.click(screen.getByRole('button', { name: 'Retry route' }));
    expect(update).toHaveBeenCalledExactlyOnceWith({ hasError: false });
    fireEvent.click(screen.getByRole('button', { name: 'Go back' }));
    expect(routeProps.onBack).toHaveBeenCalledTimes(1);
  });
});
