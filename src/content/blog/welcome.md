---
title: 'Starting a blog'
date: 2026-06-17
description: 'A template post showing the frontmatter fields and the markdown that renders. Marked draft, so it stays out of the published site.'
tags: ['meta']
draft: true
---

This is a starter post. It is marked `draft: true`, so it shows up only in local
development (`npm run dev`) and never on the published site. Copy this file to a
new name, change the frontmatter, set `draft: false`, and write.

## Frontmatter

Every post needs the fields above:

- `title` and `description` are required (`description` is capped at 160 characters and feeds the page meta tag and the card on `/blog`).
- `date` drives ordering (newest first) and the published date shown on the post.
- `tags` is optional; it renders as small labels on the post and its card.
- `draft` defaults to `false`. Set it to `true` while a post is unfinished.

## What renders

Standard markdown works. A short list:

1. Headings (`##`, `###`)
2. **Bold**, _italic_, and `inline code`
3. Links, like [the homepage](/)
4. Blockquotes and code blocks

```js
// fenced code blocks render with the site's mono font
const hello = (name) => `hello, ${name}`;
```

> Blockquotes render with the prose styling used across the site.

That is the whole feature: drop a markdown file in `src/content/blog/`, and it
appears on `/blog` and in the RSS feed once `draft` is `false`.
