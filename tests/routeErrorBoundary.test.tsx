import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RouteErrorBoundary } from '@/components/Layout/RouteErrorBoundary';

const BrokenRoute = () => {
  throw new Error('test route failure');
};

describe('RouteErrorBoundary', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('keeps a broken workflow inside a recoverable fallback', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const onBack = vi.fn();

    render(
      <RouteErrorBoundary
        title="Route failed"
        description="The route could not be rendered."
        retryLabel="Retry"
        backLabel="Overview"
        onBack={onBack}
      >
        <BrokenRoute />
      </RouteErrorBoundary>,
    );

    expect(screen.getByRole('alert').textContent).toContain('Route failed');
    expect(consoleError).toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Overview' }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });
  it('recovers the current workflow after its failure is resolved and the user retries', () => {
    vi.spyOn(console,'error').mockImplementation(()=>undefined);
    let failed=true;
    const Recoverable=()=>{if(failed)throw new Error('temporary failure');return <p>Recovered route</p>;};
    render(<RouteErrorBoundary title="Route failed" description="Try again" retryLabel="Retry" backLabel="Overview" onBack={()=>undefined}><Recoverable/></RouteErrorBoundary>);
    expect(screen.getByRole('alert')).toBeTruthy();
    failed=false;
    fireEvent.click(screen.getByRole('button',{name:'Retry'}));
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByText('Recovered route')).toBeTruthy();
  });

});
