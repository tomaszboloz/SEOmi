export const stripFrontMatter = (value: string) => value.replace(/^---\s*\r?\n[\s\S]*?\r?\n---\s*\r?\n?/, '');
export const scoreWords = (value: string) => (value.match(/[\p{L}\p{N}]+(?:['’_-][\p{L}\p{N}]+)*/gu) ?? []).length;
export const scoreSections = (value: string) => {
  const parts = value.split(/^##\s+(.+)$/m);
  const sections: Array<{ heading: string; body: string }> = [];
  for (let index = 1; index < parts.length; index += 2) sections.push({ heading: parts[index].trim(), body: parts[index + 1] });
  return sections;
};
type DraftBlock = { kind: 'h1' | 'h2' | 'h3' | 'list' | 'table' | 'paragraph'; text: string };
export const markdownBlocks = (value: string): DraftBlock[] => {
  const blocks: DraftBlock[] = [];
  let paragraph: string[] = [];
  const flush = () => { if (paragraph.length) blocks.push({ kind: 'paragraph', text: paragraph.join(' ').trim() }); paragraph = []; };
  for (const rawLine of stripFrontMatter(value).split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) { flush(); continue; }
    if (line.startsWith('#')) {
      flush();
      const hashes = line.match(/^#+/)![0].length;
      blocks.push({ kind: hashes === 1 ? 'h1' : hashes === 2 ? 'h2' : 'h3', text: line.replace(/^#+\s*/, '') });
    } else if (/^(?:[-*+]\s|\d+[.)]\s)/.test(line)) {
      flush(); blocks.push({ kind: 'list', text: line.replace(/^(?:[-*+]\s|\d+[.)]\s)/, '') });
    } else if (line.startsWith('|')) {
      flush(); blocks.push({ kind: 'table', text: line });
    } else paragraph.push(line);
  }
  flush();
  return blocks;
};
const questionStarts = new Set(['what', 'why', 'how', 'when', 'where', 'which', 'who', 'is', 'are', 'can', 'do', 'does', 'should', 'will', 'vs', 'co', 'jak', 'dlaczego', 'kiedy', 'gdzie', 'który', 'która', 'czy', 'ile', 'kim', 'czym']);
export const isQuestionHeading = (heading: string) => heading.trim().endsWith('?') || questionStarts.has(heading.trim().toLocaleLowerCase().split(/\s+/)[0]);
export const sentenceLengths = (value: string) => value.split(/(?<=[.!?])\s+/).map((sentence) => scoreWords(sentence)).filter(Boolean);
