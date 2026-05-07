#!/usr/bin/env bash
# Cloudflare Pages deploy wrapper.
#
# Why this exists: wrangler forwards the commit subject in HTTP headers, which
# are ISO-8859-1 per HTTP/1.1. Raw multibyte UTF-8 (arrows, em dashes, smart
# quotes) in the commit message gets rejected by the CF API as
# "Invalid commit message, it must be a valid UTF-8 string." (code 8000111).
# Strip to ASCII before handing off to wrangler.
set -euo pipefail

npx wrangler pages project create aragornwang-com \
  --production-branch=main 2>/dev/null || true

MSG=$(git log -1 --format=%s | iconv -c -f UTF-8 -t ASCII 2>/dev/null || true)
[ -z "$MSG" ] && MSG="deploy"

exec npx wrangler pages deploy dist \
  --project-name=aragornwang-com \
  --branch=main \
  --commit-hash="${CF_PAGES_COMMIT_SHA:-$(git rev-parse HEAD)}" \
  --commit-message="$MSG"
