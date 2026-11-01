import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import i18n from '@/i18n';
import { SprsWhatIf } from '@/components/Charts/SprsWhatIf';
import { computeSprs, flagChanges, simulateWhatIfRun } from '@/services/semanticGraph/sprs';

beforeEach(async () => { await i18n.changeLanguage('en'); });
afterEach(cleanup);

const nodes = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
const edges = [{ source: 'a', target: 'b', links: 1 }, { source: 'b', target: 'a', links: 1 }, { source: 'a', target: 'c', links: 1 }];

describe('What-If diagnostic flag changes (#71 GEM-71-09)', () => {
  it('lists dead ends that appear or disappear, sorted, ignoring pages missing on one side', () => {
    const before = computeSprs(nodes, edges).pages;
    expect(before.find((page) => page.nodeId === 'c')?.deadEnd).toBe(true);
    const fixed = simulateWhatIfRun(nodes, edges, { add: [{ source: 'c', target: 'a', links: 1 }] });
    expect(fixed.flagChanges).toContainEqual({ nodeId: 'c', flag: 'deadEnd', now: false });
    const broken = simulateWhatIfRun(nodes, edges, { remove: [{ source: 'b', target: 'a' }] });
    expect(broken.flagChanges).toContainEqual({ nodeId: 'b', flag: 'deadEnd', now: true });
    expect(simulateWhatIfRun(nodes, edges, { removeNodes: ['c'] }).flagChanges.every((change) => change.nodeId !== 'c')).toBe(true);
    expect(simulateWhatIfRun(nodes, edges, { add: [{ source: 'a', target: 'a' }] }).flagChanges).toEqual([]);
  });
  it('orders several flags of one page by flag order and pages by id', () => {
    const page = (nodeId: string, flags: Partial<Record<'deadEnd' | 'underLinked' | 'leak', boolean>>) => ({ nodeId, score: 0, probability: 0, inDegree: 0, outDegree: 0, deadEnd: false, underLinked: false, leak: false, ...flags });
    const result = flagChanges([page('z', {}), page('a', {}), page('gone', {})], [page('z', { leak: true }), page('a', { leak: true, deadEnd: true }), page('new', { leak: true })]);
    expect(result.map((change) => `${change.nodeId}:${change.flag}`)).toEqual(['a:deadEnd', 'a:leak', 'z:leak']);
  });
  it('shows the flag changes under the What-If table and nothing when none changed', () => {
    render(<SprsWhatIf nodes={nodes} edges={edges} />);
    fireEvent.change(screen.getByLabelText('From page'), { target: { value: 'c' } });
    fireEvent.change(screen.getByLabelText('To page'), { target: { value: 'a' } });
    fireEvent.click(screen.getByRole('button', { name: 'Simulate' }));
    expect(screen.getByRole('list', { name: 'Diagnostic flag changes' }).textContent).toContain('c is no longer: Dead end');
    fireEvent.change(screen.getByLabelText('Change'), { target: { value: 'remove' } });
    fireEvent.change(screen.getByLabelText('From page'), { target: { value: 'b' } });
    fireEvent.change(screen.getByLabelText('To page'), { target: { value: 'a' } });
    fireEvent.click(screen.getByRole('button', { name: 'Simulate' }));
    expect(screen.getByRole('list', { name: 'Diagnostic flag changes' }).textContent).toContain('b is now: Dead end');
  });
  it('hides the list when the change flips nothing', () => {
    render(<SprsWhatIf nodes={nodes} edges={edges} />);
    fireEvent.change(screen.getByLabelText('From page'), { target: { value: 'b' } });
    fireEvent.change(screen.getByLabelText('To page'), { target: { value: 'c' } });
    fireEvent.click(screen.getByRole('button', { name: 'Simulate' }));
    expect(screen.queryByRole('list', { name: 'Diagnostic flag changes' })).toBeNull();
  });
});
