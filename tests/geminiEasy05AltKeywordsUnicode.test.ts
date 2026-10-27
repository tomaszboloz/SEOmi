import { describe, expect, it } from 'vitest';
import { checkAlt } from '@/services/multimodal/altCheck';

describe('altCheck - suspicious filename patterns and extensions', () => {
  it('detects camera prefixes with various separators and casing', () => {
    expect(checkAlt({ src: '/a.png', alt: 'dsc_0042' }).issues).toContain('filename');
    expect(checkAlt({ src: '/a.png', alt: 'DSC-1099' }).issues).toContain('filename');
    expect(checkAlt({ src: '/a.png', alt: 'img-9876' }).issues).toContain('filename');
    expect(checkAlt({ src: '/a.png', alt: 'screenshot-20261026' }).issues).toContain('filename');
    expect(checkAlt({ src: '/a.png', alt: 'photo 77' }).issues).toContain('filename');
  });

  it('detects diverse image file extensions at end of alt string', () => {
    const extensions = ['graphic.avif', 'vector.svg', 'diagram.webp', 'schema.bmp', 'chart.tiff', 'anim.gif'];
    for (const alt of extensions) {
      expect(checkAlt({ src: '/a.png', alt }).issues).toContain('filename');
    }
  });

  it('detects matching src basename without standard extension or with query and hash', () => {
    const resQuery = checkAlt({
      src: 'https://cdn.example.org/assets/quarterly-cover?w=800&q=75',
      alt: 'quarterly-cover',
    });
    expect(resQuery.issues).toContain('filename');

    const resHash = checkAlt({
      src: '/media/avatar-user-42#top',
      alt: 'AVATAR-USER-42',
    });
    expect(resHash.issues).toContain('filename');
  });

  it('does not flag natural descriptive sentences that begin with screenshot or photo words', () => {
    const res = checkAlt({
      src: '/docs/screen.png',
      alt: 'Screenshot of the configuration panel showing network options',
    });
    expect(res.issues).not.toContain('filename');
  });
});

describe('altCheck - multilingual generic keywords and descriptive phrases', () => {
  it('flags generic keywords in Polish, German, Spanish, Italian and Cyrillic', () => {
    const generics = [
      'obraz',
      'zdjęcie',
      'bild',
      'foto',
      'imagen',
      'imagem',
      'immagine',
      'изображение',
      'фото',
      'graphic',
      'picture',
    ];
    for (const keyword of generics) {
      expect(checkAlt({ src: '/x.png', alt: keyword }).issues).toContain('generic');
      expect(checkAlt({ src: '/x.png', alt: keyword.toUpperCase() }).issues).toContain('generic');
    }
  });

  it('does not flag descriptive phrases that contain generic words', () => {
    const phrases = [
      'Zdjęcie rentgenowskie klatki piersiowej',
      'Obraz olejny przedstawiający pejzaż górski',
      'Foto budka z rekwizytami na przyjęciu',
    ];
    for (const alt of phrases) {
      expect(checkAlt({ src: '/x.png', alt }).issues).not.toContain('generic');
    }
  });
});

describe('altCheck - Unicode tokenization, casing and multiple issues', () => {
  it('extracts Unicode tokens with diacritics and computes overlap regardless of letter case', () => {
    const res = checkAlt({
      src: '/travel/boat.jpg',
      alt: 'ŻÓŁTA ŁÓDŹ PODWODNA',
      context: 'W muzeum stoi odrestaurowana żółta łódź badawcza z ubiegłego stulecia.',
    });
    expect(res.issues).toEqual([]);
    expect(res.contextOverlap).toBeCloseTo(2 / 3, 5);
  });

  it('supports Cyrillic tokens in context overlap calculation', () => {
    const res = checkAlt({
      src: '/vehicles/tractor.png',
      alt: 'красный трактор',
      context: 'в поле работает новый красный трактор модели 2026',
    });
    expect(res.issues).toEqual([]);
    expect(res.contextOverlap).toBe(1);
  });

  it('accumulates generic, repeats-caption, and unrelated-to-context issues concurrently', () => {
    const res = checkAlt({
      src: '/icons/doc.png',
      alt: 'zdjęcie',
      caption: 'ZDJĘCIE',
      context: 'Podręcznik zaawansowanej analizy algorytmów numerycznych',
    });
    expect(res.issues).toEqual(['generic', 'repeats-caption', 'unrelated-to-context']);
  });

  it('accumulates filename and too-long issues concurrently', () => {
    const longFilename = `IMG_${'0'.repeat(125)}.jpg`;
    const res = checkAlt({ src: '/a.png', alt: longFilename });
    expect(res.issues).toContain('filename');
    expect(res.issues).toContain('too-long');
  });
});
