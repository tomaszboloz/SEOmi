import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  methodKey,
  loadMethod,
  ClusteringMethodSwitch,
} from '@/components/Keywords/embeddingClustering/ClusteringMethodSwitch';

beforeEach(() => {
  localStorage.clear();
});

describe('ClusteringMethodSwitch direct assertions', () => {
  it('methodKey generates project-specific key', () => {
    expect(methodKey('p-1')).toBe('seomi_project_p-1_keyword_clustering_method_v1');
  });

  it('loadMethod falls back to embeddings when project is null or unconfigured', () => {
    expect(loadMethod(null, () => false)).toBe('embeddings');
    expect(loadMethod('p-1', () => false)).toBe('embeddings');
    expect(loadMethod('p-1', () => true)).toBe('serp');
  });

  it('loadMethod honors stored method when present', () => {
    localStorage.setItem(methodKey('p-1'), 'embeddings');
    expect(loadMethod('p-1', () => true)).toBe('embeddings');

    localStorage.setItem(methodKey('p-1'), 'serp');
    expect(loadMethod('p-1', () => false)).toBe('serp');
  });

  it('renders ClusteringMethodSwitch with active radio buttons and responds to click', () => {
    const onChange = vi.fn();
    render(<ClusteringMethodSwitch method="embeddings" disabled={false} onChange={onChange} />);

    const radios = screen.getAllByRole('radio');
    expect(radios).toHaveLength(2);
    expect(radios[0].getAttribute('aria-checked')).toBe('true');
    expect(radios[1].getAttribute('aria-checked')).toBe('false');

    fireEvent.click(radios[1]);
    expect(onChange).toHaveBeenCalledWith('serp');
  });
});
