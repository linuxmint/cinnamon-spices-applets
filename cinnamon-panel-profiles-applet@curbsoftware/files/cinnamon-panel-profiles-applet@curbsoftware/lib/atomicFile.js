/* Panel Profiles file primitives.
 *
 * Every write is private-mode, atomic (temp sibling + rename), and all-Gio:
 * no shell, no subprocess, no eval. Every public function catches exceptions
 * and returns a failure value (false or null) so nothing ever throws into a
 * GObject signal handler.
 *
 * No St/Clutter imports and no require() calls: loadable headless.
 *
 * Copyright (C) 2026 curbsoftware
 * SPDX-License-Identifier: GPL-2.0-or-later
 */

const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const ByteArray = imports.byteArray;

/* Injected logger. Defaults to silent so this module is safe standalone. */
let _logger = null;

/**
 * setDependencies:
 * @deps (object): { logger }
 *
 * Test/init seam. The logger is optional; without one, failures are silent
 * (the return value still reports them).
 */
function setDependencies(deps) {
    _logger = (deps && deps.logger) ? deps.logger : null;
}

/**
 * resetDependencies:
 *
 * Restores defaults. Test teardown helper.
 */
function resetDependencies() {
    _logger = null;
}

function _warn(msg) {
    try {
        if (_logger && typeof _logger.warn === "function")
            _logger.warn(msg);
    } catch (ignored) {
        /* logging must never take the caller down */
    }
}

/* Gio.File for a path. Never throws for ordinary path strings. */
function _fileFor(path) {
    return Gio.File.new_for_path(path);
}

/**
 * ensurePrivateDir:
 * @path (string): directory path to create.
 *
 * Creates the directory and all missing parents, then forces mode 0700.
 * An existing directory is fine (parents flag tolerates it); the chmod still
 * runs so a previously loose directory gets tightened.
 *
 * Returns (boolean): true if the directory exists with the right mode.
 */
function ensurePrivateDir(path) {
    try {
        const dir = _fileFor(path);
        try {
            dir.make_directory_with_parents(null);
        } catch (e) {
            /* Gio.IOErrorEnum.EXISTS is the happy path; anything else is real */
            if (!e.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.EXISTS))
                throw e;
        }
        const info = new Gio.FileInfo();
        info.set_attribute_uint32("unix::mode", 0o700);
        dir.set_attributes_from_info(info, Gio.FileQueryInfoFlags.NONE, null);
        return true;
    } catch (e) {
        _warn("ensurePrivateDir failed: " + e);
        return false;
    }
}

/* cjs 115 has no GLib.getpid in introspection, so temp names are built
 * from program name + monotonic time + an in-process counter. The only
 * collision that matters is two writers targeting the same destination
 * path at once, and no two live writers share all three components. */
let _tmpCounter = 0;

function _tempSuffix() {
    _tmpCounter += 1;
    let prg = "";
    try {
        prg = String(GLib.get_prgname()).replace(/[^A-Za-z0-9._-]/g, "_") + "-";
    } catch (ignored) {
    }
    return ".tmp-" + prg + GLib.get_monotonic_time() + "-" + _tmpCounter;
}

/**
 * writePrivateFileAtomic:
 * @path (string): destination file path.
 * @text (string): full file contents.
 *
 * Writes to a temp sibling (same directory, unique ".tmp-" prefix), sets
 * mode 0600 on the temp file BEFORE any content flows, then moves it over
 * the destination. A crash mid-write leaves either the old file or the
 * temp, never a half-written destination.
 *
 * Returns (boolean): true on success.
 */
function writePrivateFileAtomic(path, text) {
    let tempPath = path + _tempSuffix();
    try {
        const dest = _fileFor(path);
        const parent = dest.get_parent();
        if (parent) {
            const parentPath = parent.get_path();
            if (parentPath && !ensurePrivateDir(parentPath))
                return false;
        }

        const temp = _fileFor(tempPath);
        /* Replace any leftover temp from an earlier crashed write. */
        try {
            temp.delete(null);
        } catch (ignored) {
            /* usually just ENOENT */
        }

        const stream = temp.create(Gio.FileCreateFlags.NONE, null);

        /* Mode first, content second. */
        const info = new Gio.FileInfo();
        info.set_attribute_uint32("unix::mode", 0o600);
        temp.set_attributes_from_info(info, Gio.FileQueryInfoFlags.NONE, null);

        const bytes = new GLib.Bytes(String(text));
        stream.write_bytes(bytes, null);
        stream.close(null);

        temp.move(dest, Gio.FileCopyFlags.OVERWRITE, null, null);
        return true;
    } catch (e) {
        _warn("writePrivateFileAtomic failed: " + e);
        /* Best-effort temp cleanup; failure here is harmless. */
        try {
            _fileFor(tempPath).delete(null);
        } catch (ignored) {
        }
        return false;
    }
}

/**
 * readTextFile:
 * @path (string): file to read.
 *
 * Returns (string|null): file contents as UTF-8 text, or null on any
 * failure (missing, unreadable, oversized). load_contents can hand back an
 * over-allocated array in some cjs versions, so trailing NUL bytes are
 * trimmed.
 */
function readTextFile(path) {
    try {
        const [ok, contents, length] = _fileFor(path).load_contents(null);
        if (!ok)
            return null;
        let text = ByteArray.toString(contents);
        const nul = text.indexOf("\0");
        if (nul !== -1)
            text = text.substring(0, nul);
        return text;
    } catch (e) {
        _warn("readTextFile failed: " + e);
        return null;
    }
}

/**
 * sha256Hex:
 * @text (string): input text.
 *
 * Returns (string): lowercase hex SHA-256 digest.
 */
function sha256Hex(text) {
    try {
        const checksum = new GLib.Checksum(GLib.ChecksumType.SHA256);
        checksum.update(String(text));
        return checksum.get_string();
    } catch (e) {
        _warn("sha256Hex failed: " + e);
        return "";
    }
}

/**
 * fileExists:
 * @path (string): path to test.
 *
 * Returns (boolean): true if a regular file exists at the path.
 */
function fileExists(path) {
    try {
        return _fileFor(path).query_exists(null);
    } catch (e) {
        _warn("fileExists failed: " + e);
        return false;
    }
}
