#!/usr/bin/env bash
# The browsers' Linux system packages on a GitHub runner, kept between runs (deploy-worker.yml, full-tests.yml).
#   bash tools/ci-browser-deps.sh list <browsers…>                the apt packages `npx playwright install-deps <browsers>` asks for
#   bash tools/ci-browser-deps.sh install <dir> <secs> <browsers…>   installs them: from the .deb files kept in <dir> (actions/cache)
#                                    when they are there and install offline, else through apt (Ubuntu's mirrors) within <secs>,
#                                    and keeps the downloaded .deb files in <dir>; says `save=yes` (GITHUB_OUTPUT) when <dir> holds
#                                    a set that installed and should be saved under the run's cache key
# Why: on 2026-11-17/18 `install-deps webkit` took 23 s to over 300 s per runner (the mirrors' speed), and runs failed with
# "WebKit: the browser starts" when it ran out of time. It never fails the step: without the packages the WebKit halves fail
# to start in the tests, which then fail the run (and stop a deploy) with the reason.
set -u
cmd=${1:-}; shift || true

# Playwright's own list, read from the command it would run (a stand-in `sudo` on PATH records it; nothing is installed)
list() {
  local tmp; tmp=$(mktemp -d)
  printf '#!/bin/sh\nprintf "%%s\\n" "$@" > "%s/args"\n' "$tmp" > "$tmp/sudo"; chmod +x "$tmp/sudo"
  PATH="$tmp:$PATH" npx --no-install playwright install-deps "$@" >/dev/null 2>&1
  # the args are: -- sh -c "apt-get update&& apt-get install -y --no-install-recommends <packages>"
  sed -n 's/.*--no-install-recommends //p' "$tmp/args" 2>/dev/null | tr ' ' '\n' | grep -v '^$' | sort -u | tr '\n' ' '
  rm -rf "$tmp"
}

installed() {   # every package given is installed ("ii")
  local p bad=""
  for p in "$@"; do dpkg-query -W -f='${db:Status-Abbrev}' "$p" 2>/dev/null | grep -q '^ii' || bad="$bad $p"; done
  [ -z "$bad" ] || { echo "not installed:$bad"; return 1; }
}

if [ "$cmd" = list ]; then list "$@"; echo; exit 0; fi
[ "$cmd" = install ] || { echo "usage: $0 list <browsers…> | install <dir> <secs> <browsers…>"; exit 2; }
dir=$1; secs=$2; shift 2
out=${GITHUB_OUTPUT:-/dev/null}
read -r -a pkgs <<< "$(list "$@")"
[ ${#pkgs[@]} -gt 0 ] || { echo "::warning::Could not read the system packages Playwright needs for $*; the tests run with what the runner image has."; exit 0; }
echo "${#pkgs[@]} packages for $*: ${pkgs[*]}"
mkdir -p "$dir"
start=$SECONDS
export DEBIAN_FRONTEND=noninteractive

if installed "${pkgs[@]}" >/dev/null; then echo "all installed already (the runner image has them)"; exit 0; fi

# 1. from the kept .deb files, offline (no apt-get update, nothing downloaded)
debs=("$dir"/*.deb)
if [ -e "${debs[0]}" ]; then
  echo "installing ${#debs[@]} kept .deb files offline"
  if sudo -E timeout -k 5 180 apt-get install -y -q --no-install-recommends --no-download -o Dpkg::Use-Pty=0 "${debs[@]}" >"$RUNNER_TEMP/apt-offline.log" 2>&1 && installed "${pkgs[@]}"; then
    echo "installed from the cache in $((SECONDS - start)) s"; echo "save=yes" >> "$out"; exit 0
  fi
  tail -n 20 "$RUNNER_TEMP/apt-offline.log"
  echo "::notice::The kept system packages did not install (a new runner image?); trying apt."
fi

# 2. through apt within the time given: up to three tries, each apt request retried, a stalled mirror given up after 30 s
deadline=$((start + secs)); ok=""
sudo apt-get clean
for i in 1 2 3; do
  left=$((deadline - SECONDS)); [ $left -gt 20 ] || break
  echo "apt, try $i ($left s left)"
  if sudo -E timeout -k 5 $left sh -c 'apt-get update -q -o Acquire::Retries=3 -o Acquire::http::Timeout=30 -o Acquire::https::Timeout=30 && apt-get install -y -q --no-install-recommends -o Acquire::Retries=3 -o Acquire::http::Timeout=30 -o Acquire::https::Timeout=30 -o APT::Keep-Downloaded-Packages=true -o Dpkg::Use-Pty=0 "$@"' sh "${pkgs[@]}" && installed "${pkgs[@]}"; then ok=1; break; fi
  left=$((deadline - SECONDS)); [ $left -gt $((i * 10 + 20)) ] && sleep $((i * 10))
done
if [ -z "$ok" ]; then
  echo "::warning::The browsers' system packages could not be installed in ${secs} s (apt); the tests run with what the runner image has."
  exit 0
fi
echo "installed through apt in $((SECONDS - start)) s"
# keep what apt downloaded: exactly the packages this image lacked
rm -f "$dir"/*.deb
cp /var/cache/apt/archives/*.deb "$dir"/ 2>/dev/null && sudo chown -R "$(id -u):$(id -g)" "$dir"
n=$(ls "$dir"/*.deb 2>/dev/null | wc -l)
if [ "$n" -gt 0 ]; then echo "kept $n .deb files ($(du -sh "$dir" | cut -f1)) for the cache"; echo "save=yes" >> "$out"; fi
exit 0
