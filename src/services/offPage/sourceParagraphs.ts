import type { SourceParagraph } from './cocitation';
import type { SourceEvidence } from './sources';

export const sourceParagraphs = (sources: SourceEvidence[]): SourceParagraph[] => sources.flatMap((source) => {
  if (source.availability !== 'ok') return [];
  const paragraphs: SourceParagraph[] = [];
  for (const match of source.text.matchAll(/[^\n]+/gu)) {
    let start = match.index;
    const end = start + match[0].length;
    while (start < end) {
      const boundary = Math.min(start + 1000, end);
      const space = source.text.lastIndexOf(' ', boundary);
      const stop = boundary < end && space > start ? space : boundary;
      const chunk = source.text.slice(start, stop);
      const text = chunk.trim();
      if (text) paragraphs.push({ sourceUrl: source.sourceUrl, offset: start + chunk.indexOf(text), text, linked: false });
      start = stop;
    }
  }
  return paragraphs;
});
