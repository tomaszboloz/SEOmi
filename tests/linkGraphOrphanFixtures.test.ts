// @vitest-environment node
import { describe, expect, it } from 'vitest';
import fixtures from '@/constants/linkGraphOrphanFixtures.json';
import { orphanNodes } from '@/services/linkGraph';

/** Shared with the Rust crawl report (`link_graph.rs`): one orphan rule in both runtimes (#106). */
describe('orphan rule shared with the Rust crawl report', () => {
  it.each(fixtures)('$name', ({ nodes, edges, roots, orphans }) => {
    expect(orphanNodes(nodes, edges.map(([from, to]) => ({ from, to })), new Set(roots))).toEqual(orphans);
  });
});
