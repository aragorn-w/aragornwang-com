# aragornwang.com

Personal site for Aragorn Wang. Source for [aragornwang.com](https://aragornwang.com).

Dual-audience: PhD admissions committees and industry recruiters/hiring managers. Restrained terminal aesthetic; readability and substance over gimmick. Full design and content rationale lives in [`../aragornwang-site-spec.md`](../aragornwang-site-spec.md).

## Stack

- **Astro 6** static-site generator
- **MDX** for long-form research writeups
- **Tailwind CSS v4** via `@tailwindcss/vite` (no `tailwind.config.mjs` — tokens live in `src/styles/global.css` `@theme` blocks)
- **Astro Fonts API** (`fontProviders.fontsource()`) — self-hosts JetBrains Mono + Newsreader, no Google Fonts request at runtime
- **Vanilla `<script>` blocks** in `.astro` components for site chrome (theme/CRT/ligature toggles, boot animation). No UI framework runtime; the build ships zero client JS bundles, only inline scripts
- **Cloudflare Pages** hosting + Cloudflare Web Analytics

## Local development

```sh
npm install
npm run dev          # http://localhost:4321
npm run build        # → ./dist (runs scripts/check-no-cv.mjs first)
npm run preview      # serve ./dist on :4321 for a final check
```

## Quality gates

```sh
npm run typecheck    # astro check (covers .astro + .ts files)
npm run lint         # eslint (flat config, eslint v10)
npm run format       # prettier --write .
```

## End-to-end verification

Two Playwright harnesses cover the design system and every route:

```sh
npm run verify                 # builds, starts preview, runs both harnesses, tears down (used in CI)
```

`npm run verify` is self-contained. To run a single harness against an already-running preview (`npm run preview` on `127.0.0.1:4321`):

```sh
npm run verify:design-system   # 24 checks: theme/CRT/ligature toggles, boot animation, anti-FOUC
npm run verify:routes          # 44 checks: every route renders, key elements present, no console errors
```

## Deploy

Cloudflare Pages auto-builds on push to `main` (single-branch workflow; no staging branch). The `aragornwang.com` apex is pointed at the Pages project via Cloudflare DNS.

## Local-only source materials

`./source/` (gitignored) holds Aragorn's resume, CV, and LinkedIn export PDFs. **Never commit them; never deploy them.** The site explicitly does not expose a downloadable CV — see spec §7.1. The `prebuild` script (`scripts/check-no-cv.mjs`) fails the build loud if any CV/resume artifact lands in `public/` or `src/`.

## Where things live

- **Pages:** `src/pages/` (file-based routing)
- **Layouts:** `src/layouts/` (`BaseLayout` → `PageLayout` (960px) / `ProseLayout` (720px))
- **Content collections:** schema in `src/content.config.ts` (Astro 6 location, NOT inside `content/`); entries in `src/content/{experience,research,projects,case-studies}/`
- **Now page source:** `src/content/now.md` (single file, imported directly — not a collection)
- **Design tokens:** `src/styles/global.css` (`@theme` block + `[data-theme]` overrides)
- **CRT effect:** `src/styles/crt.css` (opt-in via `[data-crt='on']` on `<html>`)
- **Toggle persistence helpers:** `src/lib/{theme,crt,ligatures}.ts`
- **Card components:** `src/components/cards/`
- **MDX components:** `src/components/mdx/` (`Figure`, `Callout`, `Equation`)
- **GitHub cache:** `src/data/github-cache.json` (refreshed weekly by `.github/workflows/refresh-github-cache.yml`)

## License

The source code is licensed under the MIT License (see [LICENSE](./LICENSE)). You are welcome to study, reuse, and adapt the build, structure, and configuration.

The written content is reserved. The prose, research writeups, and page copy (everything under `src/content/` and the visible text of the pages) are Copyright (c) 2026 Aragorn Wang, all rights reserved, and are not covered by the MIT License. Please do not republish the writing.
