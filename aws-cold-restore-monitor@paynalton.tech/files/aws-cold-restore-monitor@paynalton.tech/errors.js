/*
 * Copyright (C) 2026 paynalton
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
const { _ } = require('./i18n');
/** Classifies failures without displaying stderr, which may contain private data. */

/**
 * Builds an issue suitable for display in the interface and notifications.
 * @param {string} code Stable identifier used to deduplicate notifications.
 * @param {'temporary'|'critical'|'warning'} severity Issue severity.
 * @param {string} message Explanation and suggested action, without account data.
 * @returns {Object} Issue; retry is true only for temporary failures.
 */
function issue(code, severity, message) {
    return {code, severity, message, retry: severity === 'temporary'};
}

/**
 * Classifies launch, transport, response, and AWS CLI errors.
 * Exit codes 254/255 alone do not distinguish temporary from critical failures;
 * stderr is inspected locally but its contents are never displayed by this classifier.
 * Unknown errors require manual review rather than indefinite retries.
 * @param {string} stage One of spawn, cli, transport, timeout, response, or internal.
 * @param {Error|string} [error=''] Captured error or AWS stderr.
 * @param {number|null} [exitCode=null] Exit code, if the process exited normally.
 * @returns {Object} Classified issue.
 */
function classify(stage, error = '', exitCode = null) {
    const text = String(error && error.message || error).toLowerCase();
    if (stage === 'timeout')
        return issue('timeout', 'temporary', _("The query exceeded 60 seconds. It will be retried automatically."));
    if (stage === 'internal')
        return issue('internal', 'critical', _("The monitor encountered an internal error. Remove the applet and add it again."));
    if (stage === 'response')
        return issue('response', 'critical', _("AWS returned an invalid response. Check the query with AWS CLI and click Refresh now."));
    if (/expiredtoken|invalidclienttokenid|unrecognizedclient|unable to locate credentials|partial credentials|invalidaccesskeyid|signaturedoesnotmatch|token.*expired|sso|credential/.test(text))
        return issue('credentials', 'critical', _("Could not authenticate with AWS. Check your credentials or renew your SSO session, then click Refresh now."));
    if (/accessdenied|unauthorized|not authorized|forbidden/.test(text))
        return issue('permissions', 'critical', _("AWS denied access. Check the backup:DescribeRestoreJob permission for this profile."));
    if (/resourcenotfound|notfoundexception|does not exist|could not be found/.test(text))
        return issue('not-found', 'critical', _("The job or profile was not found. Check the profile, region, and restore job ID."));
    if (/ssl|certificate|tls/.test(text))
        return issue('certificate', 'critical', _("The secure connection could not be verified. Check your certificates and network configuration."));
    if (stage === 'spawn')
        return issue('executable', 'critical', _("Could not start AWS CLI. Check that it is installed and that the executable path and permissions are correct."));
    if ([2, 252, 253].includes(exitCode) || /invalidparameter|invalidrequest|validationexception|invalid region|invalid endpoint|unknown options/.test(text))
        return issue('configuration', 'critical', _("The AWS CLI configuration or arguments are invalid. Check the applet settings."));
    if (/throttl|too.?many.?requests|requestlimitexceeded|slowdown/.test(text))
        return issue('throttled', 'temporary', _("AWS is throttling requests. The query will be retried after a longer delay."));
    if (/timeout|timed out|could not connect|connection|endpointconnection|network|name resolution|name or service not known|serviceunavailable|internalserver|internalfailure|requesttimeout|\b50[0234]\b/.test(text))
        return issue('unavailable', 'temporary', _("AWS is unavailable or there is a network problem. The query will be retried automatically."));
    if (stage === 'transport' || exitCode === 130)
        return issue('interrupted', 'temporary', _("Communication with AWS CLI was interrupted. The query will be retried automatically."));
    return issue('unknown', 'critical', _("AWS CLI exited with an unrecognized error. Check the query in your terminal and click Refresh now."));
}

/**
 * Calculates increasing retry delays, capped at five minutes unless the base is longer.
 * @param {number} interval Configured interval in seconds; non-finite values use 30.
 * @param {number} failures Number of consecutive temporary failures.
 * @returns {number} Delay in seconds, never below the base interval or ten seconds.
 */
function retryDelay(interval, failures) {
    const base = Number.isFinite(interval) ? Math.max(10, interval) : 30;
    return Math.min(base * Math.pow(2, Math.min(Math.max(0, failures - 1), 6)), Math.max(base, 300));
}
