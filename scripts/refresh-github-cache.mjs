#!/usr/bin/env node
// Refreshes src/data/github-cache.json from the GitHub API.
// Reads repo slugs from src/content/projects/*.md frontmatter.
// Used by .github/workflows/refresh-github-cache.yml on a weekly cron.

import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import process from 'node:process';

const PROJECTS_DIR = 'src/content/projects';
const CACHE_PATH = 'src/data/github-cache.json';

const files = (await readdir(PROJECTS_DIR)).filter((f) => f.endsWith('.md'));
const repos = [];
for (const file of files) {
  const content = await readFile(join(PROJECTS_DIR, file), 'utf8');
  const m = content.match(/^repo:\s*["']?([^"\n]+?)["']?\s*$/m);
  if (m) repos.push(m[1]);
}

if (repos.length === 0) {
  console.error('No project repos found in', PROJECTS_DIR);
  process.exit(1);
}

const headers = {
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
  'User-Agent': 'aragornwang-com-cache-refresh',
};
if (process.env.GITHUB_TOKEN) {
  headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
}

const cache = {};
for (const repo of repos) {
  const res = await fetch(`https://api.github.com/repos/${repo}`, { headers });
  if (!res.ok) {
    console.error(`✗ ${repo}: HTTP ${res.status} — ${await res.text()}`);
    process.exit(1);
  }
  const d = await res.json();
  cache[repo] = {
    stars: d.stargazers_count ?? 0,
    language: d.language ?? null,
    pushedAt: d.pushed_at,
  };
  console.log(
    `✓ ${repo}: ${cache[repo].stars}★ · ${cache[repo].language} · ${cache[repo].pushedAt}`,
  );
}

const ordered = Object.fromEntries(
  Object.keys(cache)
    .sort()
    .map((k) => [k, cache[k]]),
);
await writeFile(CACHE_PATH, JSON.stringify(ordered, null, 2) + '\n');
console.log(`Wrote ${CACHE_PATH} (${repos.length} repos)`);
