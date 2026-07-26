// @ts-check
import { defineConfig, fontProviders } from 'astro/config';

import mdx from '@astrojs/mdx';
import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  site: 'https://aragornwang.com',
  integrations: [mdx(), sitemap()],

  // Astro 7 changed the default to 'jsx', which strips whitespace between
  // inline elements. That silently glues rendered text together, e.g. the
  // experience-card meta line rendering "Mountain View, CA·4 mos" instead of
  // "Mountain View, CA · 4 mos". `true` keeps the Astro 6 behavior.
  compressHTML: true,

  fonts: [
    {
      name: 'JetBrains Mono',
      cssVariable: '--font-jetbrains-mono',
      provider: fontProviders.fontsource(),
      weights: [400, 500, 700],
      styles: ['normal', 'italic'],
      subsets: ['latin', 'latin-ext'],
      fallbacks: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
    },
    {
      name: 'Newsreader',
      cssVariable: '--font-newsreader',
      provider: fontProviders.fontsource(),
      weights: [400, 500, 600],
      styles: ['normal', 'italic'],
      subsets: ['latin', 'latin-ext'],
      fallbacks: ['Georgia', 'Cambria', 'Times New Roman', 'Times', 'serif'],
    },
  ],

  vite: {
    plugins: [tailwindcss()],
    build: {
      // Vite 8 switched the default CSS minifier to Lightning CSS, which
      // consolidates vendor-prefixed declarations. On the sticky nav it kept
      // only `-webkit-backdrop-filter` and dropped the unprefixed
      // `backdrop-filter`, so Chromium computed `none` and the blur silently
      // stopped working. esbuild was the minifier through Vite 7 and keeps
      // both declarations.
      cssMinify: 'esbuild',
    },
  },
});
