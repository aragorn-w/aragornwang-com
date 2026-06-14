#!/usr/bin/env node
// Generate public/favicon.ico from public/favicon.svg.
// Multi-size ICO containing PNG-encoded 16, 32, 48 frames.
// Run once when the favicon design changes.
//
// Sharp ships as a transitive dep of Astro, so no extra install.

import sharp from 'sharp';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SRC = ROOT + 'public/favicon.svg';
const OUT = ROOT + 'public/favicon.ico';

const SIZES = [16, 32, 48];

const svg = readFileSync(SRC);

const pngs = await Promise.all(SIZES.map((size) => sharp(svg).resize(size, size).png().toBuffer()));

// ICO layout: ICONDIR (6) + ICONDIRENTRY[count] (16 each) + raw PNG bodies.
let offset = 6 + 16 * SIZES.length;

const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0); // reserved
header.writeUInt16LE(1, 2); // type: 1 = ICO
header.writeUInt16LE(SIZES.length, 4); // image count

const entries = SIZES.map((size, i) => {
  const buf = Buffer.alloc(16);
  buf.writeUInt8(size === 256 ? 0 : size, 0); // width (0 means 256)
  buf.writeUInt8(size === 256 ? 0 : size, 1); // height
  buf.writeUInt8(0, 2); // palette colors (0 for PNG)
  buf.writeUInt8(0, 3); // reserved
  buf.writeUInt16LE(1, 4); // color planes
  buf.writeUInt16LE(32, 6); // bits per pixel
  buf.writeUInt32LE(pngs[i].length, 8); // image bytes
  buf.writeUInt32LE(offset, 12); // image offset
  offset += pngs[i].length;
  return buf;
});

const ico = Buffer.concat([header, ...entries, ...pngs]);
writeFileSync(OUT, ico);

console.log(`✓ generate-favicon: wrote ${OUT} (${SIZES.join(', ')}px, ${ico.length} bytes)`);
