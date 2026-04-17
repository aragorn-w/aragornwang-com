# aragornwang.com

Personal site for Aragorn Wang. Source for [aragornwang.com](https://aragornwang.com).

Dual-audience: PhD admissions committees and industry recruiters/hiring managers. Restrained terminal aesthetic; readability and substance over gimmick. Full design and content rationale lives in [`../aragornwang-site-spec.md`](../aragornwang-site-spec.md).

## Stack

- **Astro 6** static-site generator
- **MDX** for long-form research writeups
- **Tailwind CSS v4** via `@tailwindcss/vite` (no `tailwind.config.mjs` — tokens live in `src/styles/global.css` `@theme` blocks)
- **Astro Fonts API** (`fontProviders.fontsource()`) — self-hosts JetBrains Mono + Newsreader, no Google Fonts request at runtime
- **Vanilla `<script>` blocks** in `.astro` components for site chrome (theme/CRT/ligature toggles, boot animation). React 19 stays installed for any future MDX island
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

Two Playwright harnesses against the **preview** server (start `npm run preview` first in another terminal):

```sh
npm run verify:design-system   # 24 checks: theme/CRT/ligature toggles, boot animation, anti-FOUC
npm run verify:routes          # 44 checks: every route renders, key elements present, no console errors
```

The preview server must be running on `127.0.0.1:4321` for these to pass.

## Deploy

Cloudflare Pages auto-builds on push to `main`. Preview deployments fire on push to `dev`. The `aragornwang.com` apex is pointed at the Pages project via Cloudflare DNS.

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

MIT — see [LICENSE](./LICENSE).
