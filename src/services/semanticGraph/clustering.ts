/** Weighted-Jaccard floor shared by topic edges and cluster merges. */
export const MIN_TOPIC_SIMILARITY = 0.16;

export interface PageSimilarity {
  left: number;
  right: number;
  similarity: number;
}

interface MergeCandidate {
  average: number;
  left: number;
  right: number;
  leftVersion: number;
  rightVersion: number;
}

const precedes = (a: MergeCandidate, b: MergeCandidate): boolean =>
  a.average > b.average || (a.average === b.average && (a.left < b.left || (a.left === b.left && a.right < b.right)));

/** Minimal binary max-heap; stale candidates are skipped by version on pop. */
class MergeQueue {
  private items: MergeCandidate[] = [];

  get size(): number {
    return this.items.length;
  }

  push(candidate: MergeCandidate): void {
    const items = this.items;
    items.push(candidate);
    let index = items.length - 1;
    while (index > 0) {
      const parent = (index - 1) >> 1;
      if (!precedes(items[index], items[parent])) break;
      [items[index], items[parent]] = [items[parent], items[index]];
      index = parent;
    }
  }

  pop(): MergeCandidate | undefined {
    const items = this.items;
    const top = items[0];
    const last = items.pop();
    if (items.length && last) {
      items[0] = last;
      let index = 0;
      for (;;) {
        const left = index * 2 + 1;
        const right = left + 1;
        let best = index;
        if (left < items.length && precedes(items[left], items[best])) best = left;
        if (right < items.length && precedes(items[right], items[best])) best = right;
        if (best === index) break;
        [items[index], items[best]] = [items[best], items[index]];
        index = best;
      }
    }
    return top;
  }
}

/**
 * Average-linkage agglomeration: two groups merge only while the mean
 * similarity over all their page pairs (missing pairs count as 0) stays at or
 * above the topic-edge floor. Unlike connected components, one page that
 * shares terms with two topics cannot chain them into a single cluster.
 * Returns each page's cluster root, which is the lowest page index in it.
 */
export const clusterByAverageLinkage = (pageCount: number, similarities: PageSimilarity[]): number[] => {
  const root = Array.from({ length: pageCount }, (_, index) => index);
  const size = new Array<number>(pageCount).fill(1);
  const version = new Array<number>(pageCount).fill(0);
  // Summed pairwise similarity between the group rooted at i and each neighbouring group.
  const links = Array.from({ length: pageCount }, () => new Map<number, number>());
  const queue = new MergeQueue();
  const enqueue = (a: number, b: number) => {
    const [left, right] = a < b ? [a, b] : [b, a];
    // Only linked groups are enqueued, so the summed similarity exists.
    const average = links[left].get(right)! / (size[left] * size[right]);
    if (average >= MIN_TOPIC_SIMILARITY) {
      queue.push({ average, left, right, leftVersion: version[left], rightVersion: version[right] });
    }
  };
  for (const { left, right, similarity } of similarities) {
    links[left].set(right, similarity);
    links[right].set(left, similarity);
  }
  similarities.forEach(({ left, right }) => enqueue(left, right));

  while (queue.size) {
    const candidate = queue.pop()!;
    const { left, right } = candidate;
    if (candidate.leftVersion !== version[left] || candidate.rightVersion !== version[right]) continue;
    for (const [neighbour, sum] of links[right]) {
      links[neighbour].delete(right);
      if (neighbour === left) continue;
      const total = (links[left].get(neighbour) ?? 0) + sum;
      links[left].set(neighbour, total);
      links[neighbour].set(left, total);
    }
    links[right].clear();
    links[left].delete(right);
    size[left] += size[right];
    root[right] = left;
    version[left] += 1;
    version[right] += 1;
    for (const neighbour of links[left].keys()) enqueue(left, neighbour);
  }

  const find = (index: number): number => {
    let current = index;
    while (root[current] !== current) current = root[current];
    return current;
  };
  return root.map((_, index) => find(index));
};
