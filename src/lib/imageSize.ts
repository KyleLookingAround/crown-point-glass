/**
 * Intrinsic image dimensions, read from the file at build time.
 *
 * An <img> with no width/height makes the browser guess: the page renders,
 * the photo arrives, and everything below it jumps. Hard-coding numbers in
 * the templates doesn't help, because photos come in through the /admin
 * editor from whoever took them — so the sizes have to be read from the
 * files themselves.
 *
 * Only the header of each file is parsed, and results are cached, so this
 * costs effectively nothing even with a gallery full of photos. Anything
 * unrecognised returns null and the caller falls back to a sensible ratio;
 * a missing size is a layout wobble, not a reason to fail a build.
 */
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

export interface Size { width: number; height: number }

const cache = new Map<string, Size | null>();

/**
 * `src` is as it appears in the content or markup — "/assets/x.png",
 * "./assets/x.png" or "assets/x.png" all resolve to public/assets/x.png.
 */
export function imageSize(src: string): Size | null {
  const rel = src.replace(/^\.?\//, '').split('?')[0].split('#')[0];
  if (cache.has(rel)) return cache.get(rel)!;
  const size = read(join(process.cwd(), 'public', rel));
  cache.set(rel, size);
  return size;
}

function read(file: string): Size | null {
  if (!existsSync(file)) return null;
  let buf: Buffer;
  try {
    buf = readFileSync(file);
  } catch {
    return null;
  }
  return png(buf) ?? gif(buf) ?? webp(buf) ?? jpeg(buf) ?? svg(buf);
}

function png(b: Buffer): Size | null {
  // 8-byte signature, then an IHDR chunk whose width/height are big-endian.
  if (b.length < 24 || b.readUInt32BE(0) !== 0x89504e47) return null;
  return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
}

function gif(b: Buffer): Size | null {
  if (b.length < 10 || b.toString('ascii', 0, 3) !== 'GIF') return null;
  return { width: b.readUInt16LE(6), height: b.readUInt16LE(8) };
}

function webp(b: Buffer): Size | null {
  if (b.length < 30 || b.toString('ascii', 0, 4) !== 'RIFF' || b.toString('ascii', 8, 12) !== 'WEBP') return null;
  const kind = b.toString('ascii', 12, 16);
  // VP8 (lossy), VP8L (lossless) and VP8X (extended) each store it differently.
  if (kind === 'VP8 ') return { width: b.readUInt16LE(26) & 0x3fff, height: b.readUInt16LE(28) & 0x3fff };
  if (kind === 'VP8L') {
    const bits = b.readUInt32LE(21);
    return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
  }
  if (kind === 'VP8X') {
    const w = b[24] | (b[25] << 8) | (b[26] << 16);
    const h = b[27] | (b[28] << 8) | (b[29] << 16);
    return { width: w + 1, height: h + 1 };
  }
  return null;
}

function jpeg(b: Buffer): Size | null {
  if (b.length < 4 || b.readUInt16BE(0) !== 0xffd8) return null;
  // Walk the marker segments to the start-of-frame, which carries the size.
  let i = 2;
  while (i + 9 < b.length) {
    if (b[i] !== 0xff) { i++; continue; }
    const marker = b[i + 1];
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) { i += 2; continue; }
    const len = b.readUInt16BE(i + 2);
    // SOF0–SOF15, excluding the DHT/JPG/DAC markers interleaved in that range.
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return { height: b.readUInt16BE(i + 5), width: b.readUInt16BE(i + 7) };
    }
    i += 2 + len;
  }
  return null;
}

function svg(b: Buffer): Size | null {
  const head = b.toString('utf8', 0, 1024);
  if (!head.includes('<svg')) return null;
  const attr = (name: string) => Number(head.match(new RegExp(`\\s${name}="([\\d.]+)`))?.[1]);
  const w = attr('width'), h = attr('height');
  if (w && h) return { width: Math.round(w), height: Math.round(h) };
  // No width/height attributes — fall back to the viewBox, which every
  // drawing in public/assets carries.
  const vb = head.match(/viewBox="([\d.\s-]+)"/)?.[1]?.trim().split(/\s+/).map(Number);
  if (vb?.length === 4 && vb[2] && vb[3]) return { width: Math.round(vb[2]), height: Math.round(vb[3]) };
  return null;
}
