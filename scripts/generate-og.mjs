#!/usr/bin/env node
// Generate public/og-default.png from an SVG template.
// Run once (or whenever the design changes); commits the PNG.
//
// Sharp ships as a transitive dep of Astro, so no extra install.

import sharp from 'sharp';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const OUT = ROOT + 'public/og-default.png';

const FONT = "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";

// Spec colors (dark theme — §4.2)
const BG = '#0a0a0a';
const FG = '#e4e4e4';
const FG_MUTED = '#9a9a9a';
const FG_DIM = '#5a5a5a';
const ACCENT = '#48cef0';
const BORDER = '#262626';

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="${BG}"/>
  <rect x="40" y="40" width="1120" height="550" fill="none" stroke="${BORDER}" stroke-width="1"/>

  <g font-family="${FONT}">
    <text x="80" y="118" font-size="22" fill="${FG_DIM}">~/aragorn $</text>
    <text x="240" y="118" font-size="22" fill="${ACCENT}">cat about</text>

    <text x="80" y="280" font-size="86" font-weight="700" fill="${FG}" letter-spacing="-1.5">Aragorn Wang</text>

    <text x="80" y="370" font-size="30" fill="${FG_MUTED}">Deep learning researcher.</text>
    <text x="80" y="418" font-size="30" fill="${FG_MUTED}">CS @ Colorado School of Mines.</text>
    <text x="80" y="466" font-size="30" fill="${FG_MUTED}">Incoming Google SWE intern.</text>

    <text x="80" y="555" font-size="18" fill="${FG_DIM}">aragornwang.com</text>
  </g>
</svg>`;

mkdirSync(ROOT + 'public', { recursive: true });

await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toFile(OUT);

console.log('✓ wrote ' + OUT);
