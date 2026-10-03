const fallbackGlyphWidth = (character: string): number => {
  if (/\s/u.test(character)) return 0.28;
  if (/[ilI|!.,:;'`]/u.test(character)) return 0.28;
  if (/[MW@%&]/u.test(character)) return 0.88;
  if (/[A-Z0-9]/u.test(character)) return 0.62;
  if (/[^\u0000-\u024f]/u.test(character)) return 0.95;
  return 0.52;
};

export const measureSerpText = (text: string, fontSize: number): number => {
  if (typeof document !== 'undefined' && typeof navigator !== 'undefined' && !/jsdom/i.test(navigator.userAgent)) {
    try {
      const context = document.createElement('canvas').getContext('2d');
      if (context) {
        context.font = `${fontSize}px Arial, sans-serif`;
        return context.measureText(text).width;
      }
    } catch {
      // Fall through to the deterministic estimate for restricted WebViews.
    }
  }
  return Array.from(text).reduce((width, character) => width + fallbackGlyphWidth(character) * fontSize, 0);
};

export const truncateSerpText = (
  text: string,
  maxWidth: number,
  fontSize: number,
  measure: (value: string, size: number) => number = measureSerpText,
): string => {
  const normalized = text.replace(/\s+/gu, ' ').trim();
  if (!normalized || measure(normalized, fontSize) <= maxWidth) return normalized;
  const ellipsis = '…';
  const ellipsisWidth = measure(ellipsis, fontSize);
  const characters = Array.from(normalized);
  let low = 0;
  let high = characters.length;
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    const candidate = `${characters.slice(0, middle).join('').trimEnd()}${ellipsis}`;
    if (measure(candidate, fontSize) <= maxWidth) low = middle;
    else high = middle - 1;
  }
  if (low === 0 && ellipsisWidth > maxWidth) return '';
  return `${characters.slice(0, low).join('').trimEnd()}${ellipsis}`;
};

export const truncateSerpSnippet = (
  text: string,
  lineWidth: number,
  fontSize: number,
  maxLines = 2,
  measure: (value: string, size: number) => number = measureSerpText,
): string => {
  const words = text.replace(/\s+/gu, ' ').trim().split(' ').filter(Boolean);
  if (!words.length) return '';
  const lines: string[] = [];
  let wordIndex = 0;
  while (wordIndex < words.length && lines.length < maxLines) {
    let current = '';
    while (wordIndex < words.length) {
      const candidate = current ? `${current} ${words[wordIndex]}` : words[wordIndex];
      if (measure(candidate, fontSize) <= lineWidth) {
        current = candidate;
        wordIndex += 1;
        continue;
      }
      if (!current) {
        current = truncateSerpText(words[wordIndex], lineWidth, fontSize, measure);
        wordIndex += 1;
      }
      break;
    }
    if (current) lines.push(current);
  }
  if (wordIndex < words.length && lines.length > 0) {
    const lastIndex = lines.length - 1;
    lines[lastIndex] = truncateSerpText(`${lines[lastIndex]}…`, lineWidth, fontSize, measure);
  }
  return lines.join(' ');
};

