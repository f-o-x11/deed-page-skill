#!/bin/sh
# deed.page publish — POSIX. No GNU seq.
# Token: $DEEDPAGE_TOKEN, else ~/.config/deed-page/token (override with
# $DEEDPAGE_TOKEN_FILE). A newly minted token is saved there (mode 600) so the
# next publish, in this session or a later one, stays under the same owner.
# The token is never printed.
set -eu

usage() {
  cat <<'EOF'
publish.sh {file-or-dir} [--slug SLUG] [--client NAME] [--ref REF] [--ttl SECONDS] [--spa] [--base-url URL]

Uses $DEEDPAGE_TOKEN, else the token file ~/.config/deed-page/token.
Saves a newly minted token to that file (mode 600). Sends X-Client
(default $DEEDPAGE_CLIENT or deed-page-skill) and ref (default skill-script).
Prints the live URL on the last line of stdout.
An archive over ${DEEDPAGE_SPLIT_BYTES:-4000000} bytes (about 4 MB), or a
non-JSON 413 from /v1/sites, is published with publish-large.mjs instead.
EOF
}

BASE_URL="${DEEDPAGE_URL:-https://deed.page}"
SLUG=""
CLIENT="${DEEDPAGE_CLIENT:-deed-page-skill}"
REF="skill-script"
TOKEN_FILE="${DEEDPAGE_TOKEN_FILE:-${HOME:-.}/.config/deed-page/token}"
TTL=""
SPA=0
PATH_ARG=""

while [ $# -gt 0 ]; do
  case "$1" in
    --slug)
      SLUG="${2:-}"
      shift 2
      ;;
    --client)
      CLIENT="${2:-}"
      shift 2
      ;;
    --ref)
      REF="${2:-}"
      shift 2
      ;;
    --ttl)
      TTL="${2:-}"
      shift 2
      ;;
    --spa)
      SPA=1
      shift
      ;;
    --base-url)
      BASE_URL="${2:-}"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    --)
      shift
      break
      ;;
    -*)
      echo "unknown option: $1" >&2
      usage >&2
      exit 2
      ;;
    *)
      if [ -n "$PATH_ARG" ]; then
        echo "unexpected argument: $1" >&2
        exit 2
      fi
      PATH_ARG="$1"
      shift
      ;;
  esac
done

if [ -z "$PATH_ARG" ]; then
  echo "usage: publish.sh {file-or-dir}" >&2
  exit 2
fi

if [ ! -e "$PATH_ARG" ]; then
  echo "not found: $PATH_ARG" >&2
  exit 2
fi

TMPDIR="${TMPDIR:-/tmp}"
STAMP=$$
i=0
while [ -e "$TMPDIR/deedpage-$STAMP-$i.tar.gz" ]; do
  i=$((i + 1))
done
ARCHIVE="$TMPDIR/deedpage-$STAMP-$i.tar.gz"
WORKDIR="$TMPDIR/deedpage-$STAMP-$i.work"

cleanup() {
  rm -f "$ARCHIVE" "$TMPDIR/deedpage-$STAMP-$i.body"
  rm -rf "$WORKDIR"
}
trap cleanup EXIT INT HUP TERM

if [ -d "$PATH_ARG" ]; then
  tar -C "$PATH_ARG" -czf "$ARCHIVE" .
elif [ -f "$PATH_ARG" ]; then
  case "$PATH_ARG" in
    *.html|*.htm)
      mkdir -p "$WORKDIR"
      cp "$PATH_ARG" "$WORKDIR/index.html"
      tar -C "$WORKDIR" -czf "$ARCHIVE" .
      ;;
    *)
      PARENT=$(dirname -- "$PATH_ARG")
      BASE=$(basename -- "$PATH_ARG")
      tar -C "$PARENT" -czf "$ARCHIVE" "$BASE"
      ;;
  esac
else
  echo "not a file or directory: $PATH_ARG" >&2
  exit 2
fi

BYTES=$(wc -c < "$ARCHIVE" | tr -d '[:space:]')
SPLIT_AT="${DEEDPAGE_SPLIT_BYTES:-4000000}"

use_large() {
  LARGE=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)/publish-large.mjs
  if ! command -v node >/dev/null 2>&1 || [ ! -f "$LARGE" ]; then
    echo "site is ${BYTES} bytes; over 4 MB needs Node 18+ and publish-large.mjs (curl -fsSLO https://deed.page/cli/publish-large.mjs)" >&2
    exit 2
  fi
  set -- node "$LARGE" "$PATH_ARG" --client "$CLIENT" --ref "$REF" --base-url "$BASE_URL"
  if [ -n "$SLUG" ]; then
    set -- "$@" --slug "$SLUG"
  fi
  if [ -n "$TTL" ]; then
    set -- "$@" --ttl "$TTL"
  fi
  if [ "$SPA" -eq 1 ]; then
    set -- "$@" --spa
  fi
  # exec replaces this shell, so the EXIT trap never runs: remove the archive now.
  cleanup
  trap - EXIT INT HUP TERM
  exec "$@"
  exit 2
}

if [ "$BYTES" -gt "$SPLIT_AT" ]; then
  use_large
fi

QUERY=""
if [ -n "$SLUG" ]; then
  QUERY="slug=$SLUG"
fi
if [ -n "$REF" ]; then
  QUERY="${QUERY:+$QUERY&}ref=$REF"
fi
ENDPOINT="$BASE_URL/v1/sites${QUERY:+?$QUERY}"

TOKEN_IN="${DEEDPAGE_TOKEN:-}"
if [ -z "$TOKEN_IN" ] && [ -f "$TOKEN_FILE" ]; then
  TOKEN_IN=$(tr -d ' \r\n' < "$TOKEN_FILE")
fi

set -- -sS -X PUT --data-binary @"$ARCHIVE" -H "Content-Type: application/gzip"
if [ -n "$TOKEN_IN" ]; then
  set -- "$@" -H "Authorization: Bearer ${TOKEN_IN}"
fi
if [ -n "$CLIENT" ]; then
  set -- "$@" -H "X-Client: $CLIENT"
fi
if [ -n "$TTL" ]; then
  set -- "$@" -H "X-Ttl: $TTL"
fi
if [ "$SPA" -eq 1 ]; then
  set -- "$@" -H "X-Spa: 1"
fi

echo "publishing $PATH_ARG → $ENDPOINT" >&2

BODYFILE="$TMPDIR/deedpage-$STAMP-$i.body"
HTTP=$(curl -o "$BODYFILE" -w '%{http_code}' "$@" "$ENDPOINT" || printf '000')
RESP=$(cat "$BODYFILE" 2>/dev/null || true)
TRIM=$(printf '%s' "$RESP" | sed 's/^[[:space:]]*//')
case "$TRIM" in
  \{*|\[*) ;;
  *)
    if [ "$HTTP" = "413" ]; then
      use_large
    fi
    ;;
esac

# Echo the response without the token value.
printf '%s\n' "$RESP" | sed 's/"token":"[^"]*"/"token":"[saved]"/' >&2

TOKEN=$(printf '%s' "$RESP" | sed -n 's/.*"token":"\([^"]*\)".*/\1/p')
if [ -n "$TOKEN" ]; then
  if [ -s "$TOKEN_FILE" ] && [ "$(tr -d ' \r\n' < "$TOKEN_FILE")" != "$TOKEN" ]; then
    SAVE_TO="$TOKEN_FILE.new"
  else
    SAVE_TO="$TOKEN_FILE"
  fi
  mkdir -p "$(dirname -- "$SAVE_TO")"
  (umask 077 && printf '%s\n' "$TOKEN" > "$SAVE_TO")
  chmod 600 "$SAVE_TO"
  if [ "$SAVE_TO" = "$TOKEN_FILE" ]; then
    echo "token minted and saved to $TOKEN_FILE (mode 600). Later publishes reuse it. It is not returned again." >&2
  else
    echo "token minted and saved to $SAVE_TO; $TOKEN_FILE already holds a different token and was left as is." >&2
  fi
fi

LIVE=$(printf '%s' "$RESP" | sed -n 's/.*"url":"\([^"]*\)".*/\1/p')
if [ -z "$LIVE" ]; then
  # Plan-limit errors carry one sentence for the user and a checkout link a human opens.
  MSG=$(printf '%s' "$RESP" | sed -n 's/.*"user_message":"\([^"]*\)".*/\1/p')
  if [ -n "$MSG" ]; then
    echo "$MSG" >&2
  fi
  echo "publish failed" >&2
  exit 1
fi

printf '%s\n' "$LIVE"
