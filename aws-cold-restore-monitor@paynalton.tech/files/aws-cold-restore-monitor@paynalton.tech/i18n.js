/*
 * Copyright (C) 2026 paynalton
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
const Gettext = imports.gettext;
const GLib = imports.gi.GLib;

const UUID = 'aws-cold-restore-monitor@paynalton.tech';
Gettext.bindtextdomain(UUID, GLib.build_filenamev([GLib.get_home_dir(), '.local', 'share', 'locale']));

/**
 * Translates an English message using the applet's dedicated Gettext domain.
 * Missing translations fall back to the original English message.
 * @param {string} message Complete English message, optionally with format placeholders.
 * @returns {string} Translation selected by the user's locale, or the source message.
 */
function _(message) {
    return Gettext.dgettext(UUID, message);
}
