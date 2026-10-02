export const normalizeHttpUrl = (value: string): string | null => {
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol)) return null;
    url.hash = '';
    return url.href;
  } catch { return null; }
};

export const citationCandidates = (citation: string): string[] => {
  const candidates = [citation.trim()];
  // Answer text often places sentence punctuation directly after a URL. Only
  // accept a trimmed form if it actually matches the selected crawl snapshot.
  let candidate = candidates[0];
  while (candidate && /[.,;:!?)}\]>]$/.test(candidate)) {
    candidate = candidate.slice(0, -1);
    candidates.push(candidate);
  }
  return candidates;
};

