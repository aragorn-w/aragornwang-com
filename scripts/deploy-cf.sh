#!/usr/bin/env bash
# Cloudflare Pages deploy wrapper.
#
# Two responsibilities beyond invoking wrangler:
#
#   1. Branch resolution. wrangler treats --branch=main as a production
#      deploy and any other value as a preview deploy, so the branch we
#      pass here decides which environment receives the artifact. Resolve
#      it from CF_PAGES_BRANCH (push-triggered builds), else git HEAD
#      (local invocations on a real branch), else fall back to main
#      (the CF Pages "Retry deployment" path on the unified Workers+Pages
#      build leaves CF_PAGES_BRANCH empty and checks out the target SHA
#      in detached HEAD without setting any of the classic CF_PAGES_*
#      env vars, so there is no detectable CI indicator to gate on).
#
#   2. Commit-message sanitization. wrangler forwards the commit subject
#      in HTTP headers, which are ISO-8859-1 per HTTP/1.1. Raw multibyte
#      UTF-8 (arrows, em dashes, smart quotes) gets rejected by the CF
#      API as "Invalid commit message, it must be a valid UTF-8 string."
#      (code 8000111). Strip to ASCII before handing off to wrangler.
#
set -euo pipefail

# Diagnostics so any future build-env oddity is visible in the deploy log.
echo "deploy-cf: env CF_PAGES='${CF_PAGES:-}' CF_PAGES_BRANCH='${CF_PAGES_BRANCH:-}' CF_PAGES_COMMIT_SHA='${CF_PAGES_COMMIT_SHA:-}' CI='${CI:-}'"

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
