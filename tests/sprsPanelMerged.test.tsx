import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import '@/i18n';
import { SprsPanel } from '@/components/Charts/SprsPanel';
import { computeSprs } from '@/services/semanticGraph/sprs';

afterEach(cleanup);
const report = computeSprs([{ id: 'a' }, { id: 'b' }, { id: 'c' }], [{ source: 'a', target: 'b', links: 1 }, { source: 'b', target: 'a', links: 1 }, { source: 'a', target: 'c', links: 1 }]);

it('is the single SPRS panel: limit, readable labels and solver meta (#106)', () => {
  render(<SprsPanel report={report} limit={2} labelFor={(id) => `page ${id}`} />);
  expect(document.querySelectorAll('tbody tr')).toHaveLength(2);
  expect(screen.getAllByText(/^page [abc]$/u)[0].getAttribute('title')).toMatch(/^[abc]$/u);
  expect(screen.getByText(/iterations, residual/u)).toBeTruthy();
});
it('keeps raw ids without a label function and shows every page without a limit', () => {
  render(<SprsPanel report={report} />);
  expect(document.querySelectorAll('tbody tr')).toHaveLength(3);
  expect(screen.getByText('a').getAttribute('title')).toBeNull();
});
