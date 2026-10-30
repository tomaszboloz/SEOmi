export const CHUNK_PROFILE = { chunkWords: 60, maxChunks: 40 } as const;

export interface TextChunk { text: string; offset: number; heading: string | null }

/** Word windows of `chunkWords` inside [start, end), with character offsets into the whole text. */
const windows = (text: string, start: number, end: number, heading: string | null, limit: number): TextChunk[] => {
  const words = [...text.slice(start, end).matchAll(/\S+/gu)];
  const out: TextChunk[] = [];
  for (let i = 0; i < words.length && out.length < limit; i += CHUNK_PROFILE.chunkWords) {
    const window = words.slice(i, i + CHUNK_PROFILE.chunkWords);
    out.push({ text: window.map((match) => match[0]).join(' '), offset: start + (window[0].index ?? 0), heading });
  }
  return out;
};

/**
 * Section-aware chunks (#67): the text is split at its H2/H3 headings, located in document order, and
 * each section is split into windows of at most `chunkWords` words that keep the section heading. A
 * heading that cannot be found in the text is skipped; with no locatable heading the whole text is one
 * section without a heading, so offsets always point into the original text.
 */
export const chunkSections = (text: string, headings: readonly string[] = []): TextChunk[] => {
  const marks: Array<{ at: number; heading: string | null }> = [{ at: 0, heading: null }];
  let from = 0;
  for (const raw of headings) {
    const heading = raw.trim();
    const at = heading ? text.indexOf(heading, from) : -1;
    if (at < 0) continue;
    marks.push({ at, heading });
    from = at + heading.length;
  }
  const out: TextChunk[] = [];
  marks.forEach((mark, index) => {
    const end = marks[index + 1]?.at ?? text.length;
    out.push(...windows(text, mark.at, end, mark.heading, CHUNK_PROFILE.maxChunks - out.length));
  });
  return out;
};
