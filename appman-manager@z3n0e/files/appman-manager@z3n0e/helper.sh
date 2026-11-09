#!/usr/bin/env bash
# AppMan Manager — helper for the Cinnamon applet.
#
# Designed to be cheap: it reads AppMan's app folders directly instead of
# calling `appman -f` (which runs `du` over every app), and update checks run
# niced, with limited parallelism and hard timeouts.
#
#   helper.sh list                    installed apps (TSV); the header line also
#                                     carries the resolved path of appman
#   helper.sh check [APP...]          check for updates without applying them (TSV)
#   helper.sh bg auto|user CMD...     run CMD at lowered priority (background ops)
#   helper.sh run STAMP ID CMD [ARGS...] run an AppMan command inside a terminal
#
# Program lookups (appman, nice, ionice) happen here, in a separate process,
# so the applet never blocks Cinnamon with synchronous PATH walks.
#
# How "check" works: every AM-updater script made from the AM templates looks like
#     version0=$(cat .../version)        <- installed version/URL
#     version=$(curl ... | grep ...)     <- latest version/URL online
#     if command -v appimageupdatetool ... / if [ "$version" != "$version0" ]; then <download>
# We copy only the part before the first download/compare block into a temp
# file and run that. It does the same online lookup that `appman -u` does, but
# never downloads or changes anything.

set -u
export LC_ALL=C

CONFIG_HOME="${XDG_CONFIG_HOME:-$HOME/.config}"
DATA_HOME="${XDG_DATA_HOME:-$HOME/.local/share}"
AMDATADIR="$DATA_HOME/AM"
JOBS="${APPMAN_APPLET_JOBS:-4}"
CHECK_TIMEOUT="${APPMAN_APPLET_TIMEOUT:-45}"

_appspath() {
	local cfg="$CONFIG_HOME/appman/appman-config" p=""
	[ -f "$cfg" ] && p=$(head -n1 "$cfg")
	p="${p/#\~/$HOME}"
	printf '%s' "${p%/}"
}

APPSPATH="$(_appspath)"

# appman from the applet setting (APPMAN_SETTING), else PATH, else ~/.local/bin.
_appman_bin() {
	local p="${APPMAN_SETTING:-}"
	p="${p/#\~/$HOME}"
	if [ -n "$p" ]; then
		case "$p" in
			*/*) [ -x "$p" ] && printf '%s' "$p" ;;
			*) command -v -- "$p" ;;
		esac
		return
	fi
	command -v appman 2>/dev/null && return
	[ -x "$HOME/.local/bin/appman" ] && printf '%s' "$HOME/.local/bin/appman"
}

# Lower this process' priority; children inherit it.
#   $1 = nice level, $2 = "idle" to also use the idle I/O class
_lower_priority() {
	renice -n "$1" -p $$ >/dev/null 2>&1
	[ "${2:-}" = idle ] && ionice -c 3 -p $$ >/dev/null 2>&1
	return 0
}

# GitHub's REST API allows 60 requests an hour without a token, and asking for
# the remaining quota does not count against it. Prints "REMAINING RESET"
# (RESET = Unix time), or nothing when the quota is unknown (offline, bad token).
_gh_quota() {
	local auth=() json rem reset
	[ -n "$GH_AUTH" ] && auth=(-H "Authorization: token $GH_AUTH")
	json=$(curl -fsS --max-time 10 "${auth[@]}" https://api.github.com/rate_limit 2>/dev/null |
		tr -d ' \t\r\n' | grep -o '"core":{[^}]*}')
	rem=$(printf '%s' "$json" | grep -o '"remaining":[0-9]*' | cut -d: -f2)
	reset=$(printf '%s' "$json" | grep -o '"reset":[0-9]*' | cut -d: -f2)
	[ -n "$rem" ] && [ -n "$reset" ] && printf '%s %s\n' "$rem" "$reset"
}

_uses_github_api() { grep -q 'api\.github\.com' "$APPSPATH/$1/AM-updater" 2>/dev/null; }

# Same version extraction as appman's _check_version_filters (AM 10.x),
# so versions shown in the applet match `appman -f`.
_version_filter() {
	sed "s/x86_64\|x64\.\|amd64\|aarch64\|i686\|i386/XXXX/gi" | awk '
	{
		count = 0; pos5 = 0; posL = 0
		for (i = 1; i <= length($0); i++) {
			if (substr($0, i, 1) == "/") {
				posL = i; count++
				if ((match($0, /github.com|codeberg.org|gitlab.com/)) && (count == 5)) pos5 = i
			}
		}
		for (i = 0; i <= 1; i++) {
			type[i] = ""; version[i] = ""
			if (i == 0) vstr = substr($0, pos5, length($0))
			if (i == 1) vstr = substr($0, posL, length($0))
			if (match(vstr, /r[0-9]+\.[0-9a-f]+-[0-9]+/)) { version[i] = substr(vstr, RSTART, RLENGTH); type[i] = 0 }
			else if (match(vstr, /v?[0-9]+(\.[0-9]+)+(rc|r|alpha|beta|pre|patch|rev|final|release)?[0-9]*([._-](rc|r|alpha|beta|pre|patch|rev|final|release)?[0-9]+)?/)) { version[i] = substr(vstr, RSTART, RLENGTH); type[i] = 1 }
			else if (match(vstr, /[0-9]+-[0-9a-f]{7,}/)) { version[i] = substr(vstr, RSTART, RLENGTH); type[i] = 2 }
			else if (match(vstr, /[0-9]+[a-z0-9]*/)) { if ((RLENGTH > 1) && (RLENGTH < 8)) { version[i] = substr(vstr, RSTART, RLENGTH); type[i] = 3 } }
			if (((type[i] == "") || (type[i] == 3)) && match(vstr, /[\/_%\-][0-9a-f]{7,40}/)) { version[i] = substr(vstr, RSTART+1, RLENGTH-1); type[i] = 4 }
			if (type[i] == "") { version[i] = "-"; type[i] = 5 }
		}
		if (type[0] == type[1]) { if (length(version[0]) > length(version[1])) print version[0]; else print version[1] }
		else if (type[0] < 4) print version[0]
		else if (type[1] < 4) print version[1]
		else if (type[0] < type[1]) print version[0]
		else print version[1]
	}' | sed 's/^v//'
}

_human_version() { # $1 = app, stdin = raw version string/URL
	head -n1 | _version_filter | tr '[:upper:]' '[:lower:]' | sed "s/$1//g"
}

_app_dirs() {
	[ -d "$APPSPATH" ] || return 0
	local d
	for d in "$APPSPATH"/*/; do
		d="${d%/}"
		# AppMan treats a folder as an app when it holds an executable "remove"
		# script ("appman hide" clears that bit).
		[ -x "$d/remove" ] && printf '%s\n' "$d"
	done
}

cmd_list() {
	local amver="?" bin
	bin=$(_appman_bin)
	[ -n "$bin" ] && amver=$(grep -m1 -oE '^AMVERSION="[^"]+"' "$bin" 2>/dev/null | cut -d'"' -f2)
	printf '#\t%s\t%s\t%s\n' "${amver:-?}" "$APPSPATH" "$bin"
	local d name ver state icon
	while IFS= read -r d; do
		name="${d##*/}"
		if [ -f "$d/version" ]; then
			ver=$(sort "$d/version" | _human_version "$name")
		elif [ -f "$d/$name" ]; then
			ver=$(date -r "$d/$name" "+%Y.%m.%d")
		else
			ver="?"
		fi
		if [ -f "$d/AM-updater" ]; then state=updatable
		elif [ -f "$d/AM-LOCK" ]; then state=locked
		else state=self
		fi
		icon=""
		for f in "$d"/icons/*; do [ -f "$f" ] && { icon="$f"; break; }; done
		printf '%s\t%s\t%s\t%s\t%s\n' "$name" "${ver:--}" "$state" "$icon" "$d"
	done < <(_app_dirs)
}

# Print one TSV line: app, status, latest (human), detail code.
# Detail codes (translated by the applet): no-updater, nonstandard, unsafe,
# failed, empty, checksum.
_out() { printf '%s\t%s\t%s\t%s\n' "$1" "$2" "${3:-}" "${4:-}"; }

_check_one() {
	local app="$1" dir="$APPSPATH/$1" upd cut tmp res status raw
	case "$app" in ''|.*|*/*) return ;; esac
	upd="$dir/AM-updater"
	[ -f "$upd" ] || { _out "$app" unsupported "" no-updater; return; }

	cut=$(grep -n -m1 -E '^[[:space:]]*if[[:space:]]+(command -v appimageupdatetool|\[ "\$version" != "\$version0" \])' "$upd" | cut -d: -f1)
	if [ -z "$cut" ] || ! grep -q '^version0=' "$upd" || ! grep -qE '(^|[[:space:];)])version=' "$upd"; then
		_out "$app" unsupported "" nonstandard; return
	fi

	tmp="$WORKDIR/$app"
	mkdir -p "$tmp"
	head -n $((cut - 1)) "$upd" > "$tmp/check.sh"

	# Refuse anything that is more than an online lookup.
	if grep -qE '(^|[;&|(`]|then|do|else)[[:space:]]*(wget|curl[^|]*[[:space:]]-[oO]|mv|cp|rm|mkdir|chmod|ln|tar|unzip|7z|notify-send|appimageupdatetool|sudo|doas)([[:space:]]|$)' "$tmp/check.sh"; then
		_out "$app" unsupported "" unsafe; return
	fi

	# Use the user's own GitHub token (set with "appman apikey"), like appman does.
	if [ -n "$GH_AUTH" ] && grep -q "https://api.github.com" "$tmp/check.sh" &&
		! grep -qE 'gh[ps]_[A-Za-z0-9]{36}|github_pat_' "$tmp/check.sh"; then
		sed -i "s#https://api.github.com#--header \"Authorization: token $GH_AUTH\" https://api.github.com#g" "$tmp/check.sh"
	fi

	cat >> "$tmp/check.sh" <<'EOF'

[ "$version" != "$version0" ] && __s=update || __s=current
printf 'AMCHK\t%s\t%s\n' "$__s" "$(printf '%s\n' "$version" | head -n1)"
EOF

	res=$(cd "$tmp" && timeout "$CHECK_TIMEOUT" sh ./check.sh 2>/dev/null | grep -m1 '^AMCHK')
	if [ -z "$res" ]; then
		_out "$app" error "" failed; return
	fi
	status=$(printf '%s' "$res" | cut -f2)
	raw=$(printf '%s' "$res" | cut -f3)
	if [ -z "$raw" ]; then
		_out "$app" error "" empty; return
	fi
	# A failed checksum makes `appman -u` re-download the app anyway.
	if [ "$status" = current ] && grep -sq "Checksum failure" "$dir/AM-VERIFIED"; then
		_out "$app" update "$(printf '%s\n' "$raw" | _human_version "$app")" checksum; return
	fi
	_out "$app" "$status" "$(printf '%s\n' "$raw" | _human_version "$app")" ""
}

cmd_check() {
	local apps=() d n
	_lower_priority 15 idle
	if [ $# -gt 0 ]; then
		apps=("$@")
	else
		while IFS= read -r d; do apps+=("${d##*/}"); done < <(_app_dirs)
	fi

	WORKDIR=$(mktemp -d "${XDG_RUNTIME_DIR:-/tmp}/appman-applet.XXXXXX") || exit 1
	trap 'rm -rf "$WORKDIR"' EXIT

	GH_AUTH=""
	[ -f "$AMDATADIR/ghapikey.txt" ] && GH_AUTH=$(head -n1 "$AMDATADIR/ghapikey.txt")

	# Apps that query the GitHub API. With the quota known, check only as
	# many as it allows; the others would fail anyway.
	local gh=() budget=-1 reset="" quota limited=0
	for n in "${apps[@]}"; do _uses_github_api "$n" && gh+=("$n"); done
	if [ ${#gh[@]} -gt 0 ]; then
		quota=$(_gh_quota)
		[ -n "$quota" ] && { budget=${quota% *}; reset=${quota#* }; }
	fi

	local out="$WORKDIR/results.tsv" running=0
	: > "$out"
	for n in "${apps[@]}"; do
		if [ "$budget" -ge 0 ] && _uses_github_api "$n"; then
			if [ "$budget" -le 0 ]; then
				_out "$n" error "" ratelimit >> "$out"
				limited=1
				continue
			fi
			budget=$((budget - 1))
		fi
		_check_one "$n" >> "$out" &
		running=$((running + 1))
		if [ "$running" -ge "$JOBS" ]; then
			wait -n
			running=$((running - 1))
		fi
	done
	wait

	# Lookups can still run out of quota midway (or another program used it):
	# if GitHub lookups failed and the quota is now 0, say so.
	local failed_gh
	failed_gh=$(awk -F'\t' 'NR == FNR { gh[$0] = 1; next }
		($1 in gh) && $2 == "error" && ($4 == "failed" || $4 == "empty") { print $1 }' \
		<(printf '%s\n' "${gh[@]}") "$out")
	if [ -n "$failed_gh" ]; then
		quota=$(_gh_quota)
		if [ -n "$quota" ] && [ "${quota% *}" -eq 0 ]; then
			reset=${quota#* }
			limited=1
			awk -F'\t' -v OFS='\t' 'NR == FNR { f[$0] = 1; next } ($1 in f) { $4 = "ratelimit" } 1' \
				<(printf '%s\n' "$failed_gh") "$out" > "$out.tmp" && mv "$out.tmp" "$out"
		fi
	fi

	# Header line for the applet: when the GitHub quota resets.
	[ "$limited" -eq 1 ] && printf '#ratelimit\t%s\n' "$reset"
	cat "$out"
}

# Background operations: lower priority (idle I/O for automatic ones), then
# replace this shell with the command.
cmd_bg() {
	if [ "$1" = auto ]; then _lower_priority 15 idle; else _lower_priority 10; fi
	shift
	exec "$@"
}

# The applet watches STAMP (inotify, no polling): "start <id>" when the
# command begins, "done <id> <rc>" when it ends or the window is closed.
cmd_run() {
	local stamp="$1" id="$2"; shift 2
	RUN_RC=130
	_finish() { printf 'done %s %s\n' "$id" "$RUN_RC" > "$stamp" 2>/dev/null; }
	trap _finish EXIT
	trap 'exit 130' HUP INT TERM
	printf 'start %s\n' "$id" > "$stamp" 2>/dev/null
	printf '\033[1;34m:: %s\033[0m\n\n' "${*##*/}"
	"$@"
	RUN_RC=$?
	echo
	if [ "$RUN_RC" -eq 0 ]; then
		printf '\033[1;32m:: Done.\033[0m '
	else
		printf '\033[1;31m:: Finished with exit code %s.\033[0m ' "$RUN_RC"
	fi
	_finish
	trap - EXIT
	read -r -p "Press Enter to close…" _ || true
	exit "$RUN_RC"
}

case "${1:-}" in
	list) shift; cmd_list "$@" ;;
	check) shift; cmd_check "$@" ;;
	bg) shift; cmd_bg "$@" ;;
	run) shift; cmd_run "$@" ;;
	*) echo "usage: $0 {list|check [APP...]|bg auto|user CMD...|run STAMP ID CMD...}" >&2; exit 2 ;;
esac
