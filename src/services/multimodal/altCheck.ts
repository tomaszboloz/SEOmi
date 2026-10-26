export type AltIssue = 'missing' | 'empty' | 'filename' | 'generic' | 'too-long' | 'repeats-caption' | 'unrelated-to-context';

export interface AltInput {
  src: string;
  /** `undefined` means the attribute is absent; '' means present and empty. */
  alt?: string;
  caption?: string;
  /** Text around the image (paragraph or figure context). */
  context?: string;
}

export interface AltVerdict {
  /** 'decorative' only for an explicit empty alt, which is valid HTML; nothing is inferred from the pixels. */
  role: 'decorative' | 'unknown';
  issues: AltIssue[];
  /** 0-1 lexical overlap between alt and context; null when either side is empty. Text only, not image understanding. */
  contextOverlap: number | null;
}

const MAX_ALT = 125;
const GENERIC = new Set(['image', 'photo', 'picture', 'img', 'graphic', 'screenshot', 'zdjęcie', 'obraz', 'foto', 'bild', 'imagen', 'imagem', 'immagine', 'изображение', 'фото']);
const FILE = /\.(jpe?g|png|gif|webp|avif|svg|bmp|tiff?)$|^(img|dsc|image|photo|screenshot)[-_ ]?\d+/i;
const tokens = (text: string): Set<string> => new Set((text.toLocaleLowerCase().match(/[\p{L}\p{N}]{3,}/gu) ?? []));

const overlap = (a: string, b: string): number | null => {
  const left = tokens(a);
  const right = tokens(b);
  if (!left.size || !right.size) return null;
  return [...left].filter((token) => right.has(token)).length / left.size;
};

/**
 * Technical and wording checks on alt text. Separate from any visual analysis: a clean alt does not prove it
 * matches the picture, and an unavailable image model never lowers this result.
 */
export const checkAlt = (input: AltInput): AltVerdict => {
  const alt = input.alt?.trim();
  if (input.alt === undefined) return { role: 'unknown', issues: ['missing'], contextOverlap: null };
  if (!alt) return { role: 'decorative', issues: [], contextOverlap: null };
  const issues: AltIssue[] = [];
  const file = input.src.split(/[?#]/)[0].split('/').pop() ?? '';
  if (FILE.test(alt) || (file !== '' && alt.toLowerCase() === file.toLowerCase())) issues.push('filename');
  if (GENERIC.has(alt.toLocaleLowerCase())) issues.push('generic');
  if (alt.length > MAX_ALT) issues.push('too-long');
  const caption = input.caption?.trim();
  if (caption && caption.toLocaleLowerCase() === alt.toLocaleLowerCase()) issues.push('repeats-caption');
  const contextOverlap = input.context ? overlap(alt, input.context) : null;
  if (contextOverlap === 0) issues.push('unrelated-to-context');
  return { role: 'unknown', issues, contextOverlap };
};
