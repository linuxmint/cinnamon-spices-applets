# AWS Cold Restore Monitor for Cinnamon

A status and progress monitor for cold storage restores managed through AWS Backup, designed for the horizontal panel in Linux Mint 22.1 / Cinnamon 6.4. It displays the restore job's estimated completion percentage. Each applet instance can track a different job.

Applet UUID: `aws-cold-restore-monitor@paynalton.tech`. Project domain: `paynalton.tech`.

The monitor queries AWS Backup restore jobs by ID. It does not initiate restores or determine whether the source recovery point is in cold storage.

## Installation

For a manual installation from a checkout of this repository, open the `aws-cold-restore-monitor@paynalton.tech` directory and run **without sudo**:

```bash
bash install.sh
```

The installer requires `msgfmt` from the distribution's `gettext` package, `flock`, and standard GNU file utilities available in Linux Mint. It stages the JavaScript modules, settings schema, metadata, icon, stylesheet, and license and compiles every translation before replacing installed files. Applet files go into `${XDG_DATA_HOME:-$HOME/.local/share}/cinnamon/applets`; translations go into `~/.local/share/locale`.

Every replacement uses a temporary file on the destination filesystem and an atomic rename. Existing files are backed up first. If installation fails or receives HUP, INT, or TERM, it attempts to restore the previous files and remove newly installed files. Unrelated files and applet settings are preserved. Empty directories created during preparation may remain.

A private transaction journal and installation lock live in `${XDG_STATE_HOME:-$HOME/.local/state}/aws-cold-restore-monitor@paynalton.tech-installer`. If recovery fails, the installer reports the journal location and retains backups beside their destination files. Correct the filesystem problem and rerun the installer with the same state directory; it retries recovery before checking the new checkout or starting another update. Do not delete the journal or hidden staging directories while recovery is pending. A lock prevents concurrent runs using the same state directory.

The applet and its translations are separate replacements, not one atomic transaction. After an uncatchable termination such as SIGKILL, recovery runs on the next invocation; it does not happen automatically at desktop startup. This mechanism is not a guarantee against power loss or filesystem damage: it does not force journal and backup writes to durable storage. Keep the applet removed from the panel during updates and recovery.

Open **System Settings → Applets**, find **AWS Cold Restore Monitor**, and add it to the panel with **+**. If the applet list was already open, close and reopen it. To update an existing installation, remove the applet from the panel, run the installer, then log out and back in before adding it again.

The `install.sh` script and tests belong to the repository checkout. They are outside `files/` and are not included in the Cinnamon Spices download package.

If you installed the earlier **AWS Restore** version (`aws-restore@paynalton`), record its settings and remove it from the panel before adding **AWS Cold Restore Monitor**. Cinnamon treats the new UUID as a different applet, so configure the profile, region, job ID, interval, and executable path again. The installer does not remove the old installation or migrate its settings.

## Configuration

Right-click the applet and choose **Configure…**. The left-click menu also includes this action. The interface uses Gettext and follows your session language. English is the source language; complete Spanish, French, Simplified Chinese (`zh_CN`), Hindi (`hi`), Russian (`ru`), German (`de`), European Portuguese (`pt`), Brazilian Portuguese (`pt_BR`), Polish (`pl`), Italian (`it`), and Japanese (`ja`) catalogs are included. In Spanish, **Configure…** is **Configurar…** and **Refresh now** is **Actualizar ahora**.

| Setting | Value |
| --- | --- |
| Profile | AWS CLI profile name, such as `default` |
| Region | Job region, such as `us-east-1` |
| Restore job ID | Your `RESTORE_JOB_ID` |
| Polling interval | Initially 30 seconds; configurable from 10 to 3600 seconds |
| AWS CLI executable | `aws` or the absolute path returned by `command -v aws` |

Changes apply automatically and restart monitoring. If Cinnamon cannot find `aws`, enter its absolute path: the desktop environment may have a different `PATH` from your terminal. An initial configuration without a job ID shows **Configure** and does not query AWS.

You need **AWS CLI**, a profile with valid authentication, and the `backup:DescribeRestoreJob` permission. A separate SDK installation is not required by the applet. It uses the credentials already available to AWS CLI and does not ask for access keys. For SSO profiles, start or renew the session from your terminal:

```bash
aws sso login --profile YOUR_PROFILE
```

Executable availability is checked when a query is launched. There is no separate `aws --version` preflight or minimum-version check. Launch failures produce a critical issue with instructions to check the executable and its permissions.

## Behavior

- Runs `aws backup describe-restore-job` with the configured profile, region, and job ID. A JMESPath query selects `Status`, `PercentDone`, `StatusMessage`, `CreationDate`, and `CompletionDate`. Output is JSON so parsing does not depend on table formatting.
- Displays the percentage reported by AWS. Missing, malformed, or out-of-range percentages hide the progress indicator and show **no percentage**. A `COMPLETED` status does not imply a fabricated 100% value.
- Shows the job status, estimated progress, status message, creation and completion dates, and the time of the last successful query in the menu. Dates use the system's local time zone.
- Communicates with AWS CLI asynchronously. The normal polling interval starts after the preceding query completes. Polling continues for `COMPLETED`; `FAILED` and `ABORTED` pause automatic queries for user review.
- **Refresh now** requests a manual refresh. If a query is already running, it is left in progress. A 60-second deadline triggers process termination and communication cancellation. Changing settings or removing the applet also cancels pending work.
- Preserves the last successful result after query failures and marks it as previous data. The issue remains visible during retries until a valid response is received. Changing settings clears the previous result and starts a new monitoring episode.

## Appearance

The panel label uses Cinnamon's `applet-label` class. Progress uses the native `slider` control as a read-only indicator, with mouse interaction and focus disabled. Its colors, borders, and height come from the installed theme. Errors are communicated through text and notifications rather than fixed colors.

The menu uses standard Cinnamon styles, with informational rows shown at normal contrast. `stylesheet.css` defines only layout: spacing, indicator width, and maximum detail width, in font-relative units. It does not set colors, fonts, or borders.

## Error handling

| Severity | Examples | Behavior |
| --- | --- | --- |
| Warning | Missing or invalid percentage; AWS CLI writes a warning despite a successful query | System notification; status display and polling continue. |
| Temporary | Network interruption, timeout, service unavailability, or throttling | System notification, **AWS · Retrying**, and retries with increasing delays. |
| Critical | Expired credentials, denied permissions, missing job, invalid certificate, unavailable executable, invalid response, or unknown error | Persistent critical notification, **AWS · Error**, an explanation in the menu, and paused automatic queries. |
| Critical job status | AWS returns `FAILED` or `ABORTED` | Displays the reported state and asks the user to review the job in AWS Backup. |

Temporary failures start with the configured interval, then double the delay up to five minutes. A configured interval longer than five minutes is preserved. A successful response resets the delay. After correcting a critical issue, click **Refresh now** or change the settings to retry. Internal errors may require removing and adding the applet again.

Notifications are deduplicated by issue code during each failure episode. Recovery or a settings restart allows new notifications. Warnings about percentages or successful CLI output can be notified again after the warning clears and returns. Notification text does not contain stderr, profiles, or job IDs. Job details remain in the local menu and tooltip. To diagnose an unknown CLI error, run the query in your terminal.

Errors are also handled when launching or cancelling processes, scheduling timers, loading settings, opening configuration, and updating the interface. If notification delivery fails, the applet attempts to show a fallback message in the menu. If rendering fails, it attempts a critical notification; if both channels fail, a generic message is logged in Cinnamon. Construction failures are reported when possible, then passed to Cinnamon as a failed applet load. Removing the applet attempts every cleanup operation without emitting new notifications; cleanup failures are logged with generic messages.

These handlers cover the applet's runtime boundaries. They cannot guarantee recovery from Cinnamon itself failing or from modules that cannot be loaded before the applet's entry point runs.

## Translations

User-facing messages, settings labels, and metadata use English source strings. The applet binds its UUID as a Gettext domain through `i18n.js`; missing translations fall back to English. Messages with dynamic values use complete format strings so translators can reorder placeholders. AWS status codes and messages are preserved as reported by AWS.

Translation sources are in `files/aws-cold-restore-monitor@paynalton.tech/po/`: the `.pot` template, `es.po` (Spanish), `fr.po` (French), `zh_CN.po` (Simplified Chinese, mainland China), `hi.po` (Hindi), `ru.po` (Russian), `de.po` (German), `pt.po` (European Portuguese), `pt_BR.po` (Brazilian Portuguese), `pl.po` (Polish), `it.po` (Italian), and `ja.po` (Japanese). Do not commit compiled `.mo` files. The manual installer compiles catalogs locally; Cinnamon Spices manages translations for distributed installations. After installing a translation, reload the applet or log out and back in.

From the repository root, update the template using the repository's standard tool (requires its Gettext, Cinnamon extraction, and Python `polib` dependencies):

```bash
./cinnamon-spices-makepot aws-cold-restore-monitor@paynalton.tech
```

From the applet directory, check the translation catalogs:

```bash
msgfmt --check --check-format files/aws-cold-restore-monitor@paynalton.tech/po/es.po -o /tmp/aws-cold-restore-monitor-es.mo
msgfmt --check --check-format files/aws-cold-restore-monitor@paynalton.tech/po/fr.po -o /tmp/aws-cold-restore-monitor-fr.mo
msgfmt --check --check-format files/aws-cold-restore-monitor@paynalton.tech/po/zh_CN.po -o /tmp/aws-cold-restore-monitor-zh_CN.mo
msgfmt --check --check-format files/aws-cold-restore-monitor@paynalton.tech/po/hi.po -o /tmp/aws-cold-restore-monitor-hi.mo
msgfmt --check --check-format files/aws-cold-restore-monitor@paynalton.tech/po/ru.po -o /tmp/aws-cold-restore-monitor-ru.mo
msgfmt --check --check-format files/aws-cold-restore-monitor@paynalton.tech/po/de.po -o /tmp/aws-cold-restore-monitor-de.mo
msgfmt --check --check-format files/aws-cold-restore-monitor@paynalton.tech/po/pt.po -o /tmp/aws-cold-restore-monitor-pt.mo
msgfmt --check --check-format files/aws-cold-restore-monitor@paynalton.tech/po/pt_BR.po -o /tmp/aws-cold-restore-monitor-pt_BR.mo
msgfmt --check --check-format files/aws-cold-restore-monitor@paynalton.tech/po/pl.po -o /tmp/aws-cold-restore-monitor-pl.mo
msgfmt --check --check-format files/aws-cold-restore-monitor@paynalton.tech/po/it.po -o /tmp/aws-cold-restore-monitor-it.mo
msgfmt --check --check-format files/aws-cold-restore-monitor@paynalton.tech/po/ja.po -o /tmp/aws-cold-restore-monitor-ja.mo
```

For isolated installation tests, set `AWS_RESTORE_LOCALE_DIR` to a temporary directory. Normal installations must use the default `~/.local/share/locale`, which is the domain path used by the applet and Cinnamon settings.

## Development checks

From the applet directory:

```bash
node --check files/aws-cold-restore-monitor@paynalton.tech/applet.js
node --check files/aws-cold-restore-monitor@paynalton.tech/errors.js
node --check files/aws-cold-restore-monitor@paynalton.tech/model.js
node --check files/aws-cold-restore-monitor@paynalton.tech/i18n.js
node --test tests/*.test.js
bash -n install.sh
python3 tests/install.test.py
```

From the repository root:

```bash
./validate-spice aws-cold-restore-monitor@paynalton.tech
```

`tests/model.test.js` checks argument construction, percentage parsing, invalid responses, and date handling. `tests/errors.test.js` uses simulated Cinnamon and Gio APIs to check classification, retries, recovery, cancellation, late responses, and desktop service failures. `tests/i18n.test.js` checks the Gettext domain, placeholder preservation, and English fallback. `tests/install.test.py` uses temporary paths and injected command failures to verify successful installation, missing sources, invalid catalogs, partial update rollback, first-install rollback, termination signals, recovery after SIGKILL, retained backups after rollback failures, and concurrent installation exclusion. It requires Python 3 and the installer dependencies. `tests/security.test.js` checks argument injection, private-data disclosure in errors and notifications, plain-text rendering of AWS messages, and common embedded credential signatures in project text files. It requires `cjs` as well as Node.js: one check passes argv captured from the applet through real Gio to a temporary local recorder. It never invokes AWS CLI or reads AWS credentials. `tests/helpers/applet.js` shares desktop test doubles between the error and security suites.

Run the security suite alone with `node --test tests/security.test.js`; it is also included in `node --test tests/*.test.js`. Missing CJS or blocked subprocess execution fails the integration check instead of silently skipping it. Credential scanning reports file paths and rule names, never matched values. The scan does not inspect image pixels, image metadata, Git history, or every possible secret format. These regression checks are not a comprehensive security audit.

These tests do not replace a visual test in Cinnamon.

Visual verification requires adding the applet to a Cinnamon session. Check theme changes, menu readability, and notifications there. A real AWS query requires valid authentication and a restore job ID. Passing the package validator checks repository structure and metadata, not live AWS behavior or the full user interface.

References: [AWS describe-restore-job](https://docs.aws.amazon.com/cli/latest/reference/backup/describe-restore-job.html), [AWS CLI return codes](https://docs.aws.amazon.com/cli/latest/userguide/cli-usage-returncodes.html), and [Cinnamon applet settings](https://github.com/linuxmint/cinnamon/blob/master/docs/reference/cinnamon-tutorials/xlet-settings.xml).

## License

Copyright (C) 2026 paynalton. All project code and images, including `icon.png` and
`screenshot.png`, as well as documentation and translations, are licensed under
**GNU GPL version 3 or any later version** (`GPL-3.0-or-later`).

See [LICENSE](LICENSE) for the project notice and the complete GPLv3 text. An
identical copy is included in `files/aws-cold-restore-monitor@paynalton.tech/LICENSE`
so Cinnamon Spices downloads carry the license. The manual installer also installs
that file with the applet.
