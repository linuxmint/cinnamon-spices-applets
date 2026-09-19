/*
 * Copyright (C) 2026 paynalton
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
/**
 * Helpers for constructing queries and presenting responses without Cinnamon dependencies.
 * They do not launch processes or access credentials.
 * @file
 */

/**
 * Settings required to build AWS CLI arguments.
 * @typedef {Object} RestoreConfig
 * @property {string} awsPath Executable name or path, without arguments.
 * @property {string} profile AWS CLI profile name.
 * @property {string} region Restore job region.
 * @property {string} restoreJobId Restore job identifier.
 */

/**
 * AWS response with the normalized percentage added by parseJob.
 * Only Status and percent are validated; other fields retain their original values.
 * @typedef {Object} RestoreJob
 * @property {string} Status AWS status; must be a nonempty string.
 * @property {string|number|null} [PercentDone] Original percentage, unchanged.
 * @property {number|null} percent Percentage from 0 to 100, or null when invalid.
 * @property {string|null} [StatusMessage] Message provided by AWS.
 * @property {string|number|null} [CreationDate] ISO date or Unix seconds.
 * @property {string|number|null} [CompletionDate] ISO date or Unix seconds.
 */

/** @type {string} JMESPath projection of the five fields displayed in the menu. */
var QUERY = '{Status:Status,PercentDone:PercentDone,StatusMessage:StatusMessage,CreationDate:CreationDate,CompletionDate:CompletionDate}';

/**
 * Builds argv for Gio.SubprocessLauncher.spawnv without invoking a shell.
 * Trims surrounding whitespace from settings and requests JSON output.
 * The caller must verify that all four values are nonempty strings.
 * Connection and read timeouts are 10 and 20 seconds respectively;
 * the applet manages the overall execution deadline.
 *
 * @param {RestoreConfig} config Job and executable settings.
 * @returns {string[]} Executable followed by separate, literal arguments.
 */
function command(config) {
    return [config.awsPath.trim(), 'backup', 'describe-restore-job',
        '--profile', config.profile.trim(), '--region', config.region.trim(),
        '--restore-job-id', config.restoreJobId.trim(), '--query', QUERY,
        '--output', 'json', '--color', 'off',
        '--cli-connect-timeout', '10', '--cli-read-timeout', '20'];
}

/**
 * Parses AWS JSON and adds percent to the newly deserialized object.
 * Accepts numbers and decimal strings with an optional percent suffix. Missing,
 * malformed, or out-of-range values produce null. Preserves all other fields
 * and never infers a percentage from Status, even for COMPLETED.
 *
 * @param {string} output Standard output from a successful AWS CLI query.
 * @returns {RestoreJob} Original response with a normalized percentage.
 * @throws {SyntaxError} If output is not valid JSON.
 * @throws {Error} If Status is missing or is not a nonempty string.
 */
function parseJob(output) {
    const job = JSON.parse(output);
    if (!job || typeof job.Status !== 'string' || !job.Status.trim())
        throw new Error('AWS did not return a valid status.');
    const raw = job.PercentDone;
    const value = typeof raw === 'number' ? String(raw) :
        (typeof raw === 'string' ? raw.trim().replace(/%$/, '').trim() : '');
    const percent = /^\d+(\.\d+)?$/.test(value) ? Number(value) : NaN;
    job.percent = Number.isFinite(percent) && percent >= 0 && percent <= 100 ? percent : null;
    return job;
}

/**
 * Formats a date using the system locale and time zone.
 * Numbers are interpreted as Unix seconds; strings are parsed by Date.
 *
 * @param {string|number|null|undefined} value Date returned by AWS.
 * @returns {string} Local date, an em dash for missing or empty values, or the
 * original value converted to text if Date cannot parse it.
 */
function dateText(value) {
    if (value === null || value === undefined || value === '') return '—';
    const date = new Date(typeof value === 'number' ? value * 1000 : value);
    return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString();
}
