#!/usr/bin/env bash
# Cloudflare Pages deploy wrapper.
#
# Two responsibilities beyond invoking wrangler:
#
#   1. Branch resolution. wrangler treats --branch=main as a production
#      deploy and any other value as a preview deploy, so the branch we
#      pass here decides which environment receives the artifact. Resolve
#      it from CF_PAGES_BRANCH, else git HEAD (local invocations on a real
#      branch), else fall back to main. CF_PAGES_BRANCH is a classic Pages
#      variable. This project builds on Workers Builds, which documents CI
#      and WORKERS_CI_* variables (including WORKERS_CI_BRANCH) instead,
#      and the two builds observed on 2026-05-19 (dashboard retries of
#      main) ran with CF_PAGES_BRANCH empty and a detached HEAD. Those ran
#      an earlier version of this script, which refused them; under the
#      current logic such a build reaches the fallback and resolves to
#      main. Apart from the diagnostics line, WORKERS_CI_BRANCH is used
#      only by the guard below, which refuses any build whose
#      WORKERS_CI_BRANCH names a branch other than main. It never selects
#      the branch, so the resolution order above is unchanged.
#
#      Non-production branch builds are not meant to run this script at
#      all. The dashboard's Version command, which Workers Builds runs for
#      them instead of the deploy command, is `echo "no non-prod deploys"`
#      (read from the dashboard 2026-09-22), so this project's Cloudflare
#      builds publish no previews. A local run on a branch other than main
#      makes a preview deploy, but a local run on main or a detached HEAD
#      resolves to main and publishes whatever is in dist/ to production.
#
#   2. Commit-message sanitization. wrangler forwards the commit subject
#      in HTTP headers, which are ISO-8859-1 per HTTP/1.1. Raw multibyte
#      UTF-8 (arrows, em dashes, smart quotes) gets rejected by the CF
#      API as "Invalid commit message, it must be a valid UTF-8 string."
#      (code 8000111). Strip to ASCII before handing off to wrangler.
#
set -euo pipefail

# Diagnostics so any future build-env oddity is visible in the deploy log.
echo "deploy-cf: env WORKERS_CI='${WORKERS_CI:-}' WORKERS_CI_BRANCH='${WORKERS_CI_BRANCH:-}' CF_PAGES='${CF_PAGES:-}' CF_PAGES_BRANCH='${CF_PAGES_BRANCH:-}' CF_PAGES_COMMIT_SHA='${CF_PAGES_COMMIT_SHA:-}' CI='${CI:-}'"

# Guard: fail closed and loud. Workers Builds sets WORKERS_CI_BRANCH to the
# pushed branch. If that is anything other than the production branch, stop
# instead of falling through to the main fallback below, which would publish
# the branch to production. A non-zero exit turns the Workers Builds check red
# on GitHub, so a misconfigured Version command is visible, not silent. Only a
# named branch is refused: if WORKERS_CI_BRANCH is empty or unset (or a bare
# refs/heads/), the guard is skipped and the resolution below runs as before.
CI_BRANCH="${WORKERS_CI_BRANCH:-}"
CI_BRANCH="${CI_BRANCH#refs/heads/}"
if [ -n "$CI_BRANCH" ] && [ "$CI_BRANCH" != "main" ]; then
  echo "deploy-cf: refusing to deploy. WORKERS_CI_BRANCH='${WORKERS_CI_BRANCH}' is not the production branch 'main'; non-production builds must not run this script." >&2
  exit 1
fi

RESOLVED_BRANCH="${CF_PAGES_BRANCH:-}"
RESOLVED_FROM=''

if [ -n "$RESOLVED_BRANCH" ]; then
  RESOLVED_FROM='CF_PAGES_BRANCH'
else
  HEAD_BRANCH="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo '')"
  if [ -n "$HEAD_BRANCH" ] && [ "$HEAD_BRANCH" != "HEAD" ]; then
    RESOLVED_BRANCH="$HEAD_BRANCH"
    RESOLVED_FROM='git HEAD'
  else
    RESOLVED_BRANCH='main'
    RESOLVED_FROM='fallback (detached HEAD, no CF_PAGES_BRANCH)'
  fi
fi

echo "deploy-cf: target branch '${RESOLVED_BRANCH}' (resolved from ${RESOLVED_FROM})."

# Idempotent project create. The "already exists" failure mode is expected
# on every run after the first; other failures (auth, permission, network)
# must surface so a deploy does not silently progress against a misconfigured
# Cloudflare account.
if CREATE_OUT=$(npx wrangler pages project create aragornwang-com \
  --production-branch=main 2>&1); then
  echo "deploy-cf: created Cloudflare Pages project 'aragornwang-com'."
  echo "$CREATE_OUT"
elif echo "$CREATE_OUT" | grep -qiE 'already (exists|taken)|name (is|has been) (already )?taken'; then
  echo "deploy-cf: Cloudflare Pages project 'aragornwang-com' already exists, continuing."
else
  echo "deploy-cf: wrangler pages project create failed:" >&2
  echo "$CREATE_OUT" >&2
  exit 1
fi

MSG=$(git log -1 --format=%s | iconv -c -f UTF-8 -t ASCII 2>/dev/null || true)
[ -z "$MSG" ] && MSG="deploy"

exec npx wrangler pages deploy dist \
  --project-name=aragornwang-com \
  --branch="$RESOLVED_BRANCH" \
  --commit-hash="${CF_PAGES_COMMIT_SHA:-$(git rev-parse HEAD)}" \
  --commit-message="$MSG"
