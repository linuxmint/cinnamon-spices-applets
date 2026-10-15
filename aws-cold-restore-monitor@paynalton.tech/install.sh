#!/usr/bin/env bash
# Copyright (C) 2026 paynalton
# SPDX-License-Identifier: GPL-3.0-or-later
# Installs from a checkout without sudo; settings and unrelated files are preserved.
# Prepares and validates every replacement before updating any installed file.
# A private journal supports rollback and recovery on the next installer invocation.
set -euo pipefail
umask 077
uuid='aws-cold-restore-monitor@paynalton.tech'
project_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
state="${XDG_STATE_HOME:-$HOME/.local/state}/$uuid-installer"
[[ "$state" == /* ]] || { printf 'XDG_STATE_HOME must be an absolute path.\n' >&2; exit 1; }
for tool in flock mktemp install cp mv rm mkdir chmod touch dirname; do
    command -v "$tool" >/dev/null || { printf 'Required installation tool is missing: %s\n' "$tool" >&2; exit 1; }
done
mkdir -p -- "$state"
chmod 700 -- "$state"
exec 9>"$state/lock"
flock -n 9 || { printf 'Another installation is running. Try again after it finishes.\n' >&2; exit 1; }
journal="$state/transaction"

# Removes staged data after preparation failure, successful rollback, or commit.
# Leaves the journal in place if cleanup fails, so the next invocation can retry.
cleanup() {
    local target staged previous
    if [[ -f "$journal/manifest" ]]; then
        while IFS= read -r -d '' target && IFS= read -r -d '' staged && IFS= read -r -d '' previous; do
            rm -rf -- "$staged" || return 1
        done < "$journal/manifest"
    fi
    rm -rf -- "$journal"
}

# Restores every previous file atomically; entries without a predecessor are removed.
# Backups are copied, not consumed, making recovery safe to repeat after interruption.
rollback() {
    local target staged previous failed=0
    while IFS= read -r -d '' target && IFS= read -r -d '' staged && IFS= read -r -d '' previous; do
        if [[ "$previous" == yes ]]; then
            if ! cp -p -- "$staged/backup" "$staged/restore" || ! mv -fT -- "$staged/restore" "$target"; then
                failed=1
            fi
        else
            rm -f -- "$target" || failed=1
        fi
    done < "$journal/manifest"
    [[ "$failed" == 0 ]]
}

# Recovers a prior transaction; a committed transaction needs only temporary cleanup.
# Failure retains all backups and blocks further updates instead of hiding the problem.
recover() {
    if [[ -f "$journal/ready" && ! -f "$journal/committed" ]]; then
        printf 'Restoring the previous installation.\n' >&2
        rollback || { printf 'Recovery failed. Backups retained in %s; correct the filesystem problem and rerun this installer.\n' "$journal" >&2; return 1; }
        # Cleanup can itself be interrupted; mark rollback complete before removing backups.
        touch -- "$journal/committed" || return 1
    fi
    cleanup
}

# Preserves the original failure status and attempts recovery for errors and signals.
finish() {
    local status=$?
    trap - EXIT HUP INT TERM
    if [[ -d "$journal" ]]; then
        if ! recover; then
            printf 'Installation recovery or cleanup is incomplete: %s\n' "$journal" >&2
            status=1
        fi
    fi
    exit "$status"
}

# Recover before checking source dependencies: a broken checkout must not prevent rollback.
if [[ -d "$journal" ]]; then
    recover || exit 1
fi
if ! command -v msgfmt >/dev/null 2>&1; then
    printf 'Translation installation requires msgfmt. Install the gettext package.\n' >&2
    exit 1
fi
trap finish EXIT
trap 'exit 129' HUP
trap 'exit 130' INT
trap 'exit 143' TERM
mkdir -- "$journal"
: > "$journal/manifest"
# Use absolute paths in the journal so recovery works from any working directory.
destination="${XDG_DATA_HOME:-$HOME/.local/share}/cinnamon/applets/$uuid"
locale_root="${AWS_RESTORE_LOCALE_DIR:-$HOME/.local/share/locale}"
[[ "$destination" == /* && "$locale_root" == /* && "$state" == /* ]] || {
    printf 'Installation and state directories must be absolute paths.\n' >&2; exit 1;
}

# Prepares one file beside its target (same filesystem for atomic rename).
# Records ownership of temporary data before copying; no target changes occur here.
# Arguments: source file, destination file, kind (file or catalog).
prepare() {
    local source=$1 target=$2 kind=$3 parent staged previous=no
    parent=$(dirname -- "$target")
    mkdir -p -- "$parent"
    if [[ -L "$target" || ( -e "$target" && ! -f "$target" ) ]]; then
        printf 'Refusing to replace a symlink or non-regular file: %s\n' "$target" >&2
        return 1
    fi
    [[ ! -e "$target" ]] || previous=yes
    staged=$(mktemp -d -- "$parent/.$uuid-install.XXXXXXXX")
    printf '%s\0%s\0%s\0' "$target" "$staged" "$previous" >> "$journal/manifest"
    if [[ "$previous" == yes ]]; then cp -p -- "$target" "$staged/backup"; fi
    if [[ "$kind" == catalog ]]; then
        msgfmt --check --check-format "$source" -o "$staged/new"
        chmod 644 -- "$staged/new"
    else
        install -m 644 -- "$source" "$staged/new"
    fi
}

for filename in metadata.json settings-schema.json applet.js model.js errors.js i18n.js icon.png stylesheet.css LICENSE; do
    prepare "$project_dir/files/$uuid/$filename" "$destination/$filename" file
done
for catalog in "$project_dir/files/$uuid/po/"*.po; do
    language=${catalog##*/}
    language=${language%.po}
    prepare "$catalog" "$locale_root/$language/LC_MESSAGES/$uuid.mo" catalog
done
# The ready marker is written only after every backup and candidate is complete.
touch -- "$journal/ready"
while IFS= read -r -d '' target && IFS= read -r -d '' staged && IFS= read -r -d '' previous; do
    mv -fT -- "$staged/new" "$target"
done < "$journal/manifest"
touch -- "$journal/committed"
cleanup
printf 'Applet installed in %s\n' "$destination"
printf 'Open Applets, find AWS Cold Restore Monitor, and add it to the panel. Right-click → Configure.\n'
