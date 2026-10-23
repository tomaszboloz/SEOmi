const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

export const crc32 = (bytes: Uint8Array): number => {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
};

const header = (size: number, fill: (view: DataView) => void): Uint8Array => {
  const bytes = new Uint8Array(size);
  fill(new DataView(bytes.buffer));
  return bytes;
};

/** Minimal store-only (uncompressed) ZIP writer; UTF-8 names; fixed DOS epoch date for reproducible output. */
export const buildZip = (files: Array<{ name: string; content: string }>): Uint8Array => {
  const encoder = new TextEncoder();
  const parts: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  for (const file of files) {
    const name = encoder.encode(file.name);
    const data = encoder.encode(file.content);
    const crc = crc32(data);
    const local = header(30, (v) => {
      v.setUint32(0, 0x04034b50, true); v.setUint16(4, 20, true); v.setUint16(6, 0x0800, true);
      v.setUint16(12, 0x21, true); v.setUint32(14, crc, true); v.setUint32(18, data.length, true);
      v.setUint32(22, data.length, true); v.setUint16(26, name.length, true);
    });
    central.push(header(46, (v) => {
      v.setUint32(0, 0x02014b50, true); v.setUint16(4, 20, true); v.setUint16(6, 20, true); v.setUint16(8, 0x0800, true);
      v.setUint16(14, 0x21, true); v.setUint32(16, crc, true); v.setUint32(20, data.length, true);
      v.setUint32(24, data.length, true); v.setUint16(28, name.length, true); v.setUint32(42, offset, true);
    }), name);
    parts.push(local, name, data);
    offset += 30 + name.length + data.length;
  }
  const centralSize = central.reduce((sum, part) => sum + part.length, 0);
  const end = header(22, (v) => {
    v.setUint32(0, 0x06054b50, true); v.setUint16(8, files.length, true); v.setUint16(10, files.length, true);
    v.setUint32(12, centralSize, true); v.setUint32(16, offset, true);
  });
  const all = [...parts, ...central, end];
  const out = new Uint8Array(all.reduce((sum, part) => sum + part.length, 0));
  let position = 0;
  for (const part of all) { out.set(part, position); position += part.length; }
  return out;
};
