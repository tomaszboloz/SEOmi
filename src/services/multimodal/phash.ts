/** Decoded grayscale image: `gray` holds width*height values 0-255, row-major. */
export interface GrayImage { width: number; height: number; gray: ArrayLike<number> }

const SIZE = 32;
const LOW = 8;

/** Box-average resample to SIZE x SIZE; every source pixel lands in exactly one cell. */
const resample = (image: GrayImage): number[] => {
  const sum = new Array<number>(SIZE * SIZE).fill(0);
  const count = new Array<number>(SIZE * SIZE).fill(0);
  for (let y = 0; y < image.height; y += 1) {
    for (let x = 0; x < image.width; x += 1) {
      const cell = Math.min(SIZE - 1, Math.floor((y * SIZE) / image.height)) * SIZE + Math.min(SIZE - 1, Math.floor((x * SIZE) / image.width));
      sum[cell] += image.gray[y * image.width + x];
      count[cell] += 1;
    }
  }
  return sum.map((value, cell) => (count[cell] ? value / count[cell] : 0));
};

const COS = Array.from({ length: LOW }, (_, u) => Array.from({ length: SIZE }, (_, x) => Math.cos(((2 * x + 1) * u * Math.PI) / (2 * SIZE))));

/** Low-frequency 8x8 block of the 2D DCT (separable). */
const lowDct = (grid: number[]): number[] => {
  const rows = Array.from({ length: SIZE }, (_, y) => COS.map((basis) => basis.reduce((acc, c, x) => acc + c * grid[y * SIZE + x], 0)));
  return COS.flatMap((basis) => Array.from({ length: LOW }, (_, u) => basis.reduce((acc, c, y) => acc + c * rows[y][u], 0)));
};

/**
 * 64-bit perceptual hash (DCT of a 32x32 grayscale grid, low-frequency 8x8 block compared with its median,
 * DC term excluded from the median). Robust to resize and mild re-compression; NOT to rotation or heavy crops.
 * Returns a 16-character hex string, or null for an empty image.
 */
export const perceptualHash = (image: GrayImage): string | null => {
  if (image.width < 1 || image.height < 1 || image.gray.length < image.width * image.height) return null;
  const block = lowDct(resample(image));
  const sorted = block.slice(1).sort((a, b) => a - b);
  const median = (sorted[Math.floor((sorted.length - 1) / 2)] + sorted[Math.ceil((sorted.length - 1) / 2)]) / 2;
  const bits = block.map((value) => (value > median ? '1' : '0')).join('');
  return Array.from({ length: 16 }, (_, i) => parseInt(bits.slice(i * 4, i * 4 + 4), 2).toString(16)).join('');
};

/** Number of differing bits between two hashes of equal length; null when they cannot be compared. */
export const hammingDistance = (a: string | null, b: string | null): number | null => {
  if (!a || !b || a.length !== b.length || !/^[0-9a-f]+$/.test(a + b)) return null;
  return [...a].reduce((acc, char, i) => acc + (parseInt(char, 16) ^ parseInt(b[i], 16)).toString(2).replace(/0/g, '').length, 0);
};

/**
 * Near-duplicate decision. The threshold is an explicit argument: no value has been calibrated on real data yet
 * (issue #96 D02). A match only says the pictures look alike; it does not show stock use, authorship or value.
 */
export const isNearDuplicate = (a: string | null, b: string | null, maxDistance: number): boolean | null => {
  const distance = hammingDistance(a, b);
  return distance === null ? null : distance <= maxDistance;
};
