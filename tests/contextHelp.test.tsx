import { render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import { ContextHelp } from '@/components/ContextHelp';

it('exposes a labelled, described disclosure for keyboard and assistive technology users', () => {
  render(<ContextHelp id="test-help" label="Export help">Saved data only.</ContextHelp>);
  const summary = screen.getByText('Export help').closest('summary');
  expect(summary?.getAttribute('aria-describedby')).toBe('test-help-description');
  expect(screen.getByText('Saved data only.').getAttribute('id')).toBe('test-help-description');
});
