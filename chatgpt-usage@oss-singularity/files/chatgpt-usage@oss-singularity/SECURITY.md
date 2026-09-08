# Security policy

ChatGPT Usage Monitor reads account-level limits through a locally installed Codex
CLI or the backend bundled with a supported ChatGPT desktop package. The applet does not read credential files, accept API keys or persist usage
responses. Please use a private channel for anything that could expose Codex or
ChatGPT authentication data.

## Supported versions

Security fixes target the latest published release and the current `main`
branch. This policy also applies after 1.0: older releases do not receive
separate backports; users should update to the latest supported release.

| Version        | Security support             |
| -------------- | ---------------------------- |
| Latest release | Supported                    |
| Current `main` | Supported development branch |
| Older releases | Upgrade first                |

## Reporting a vulnerability

Use [GitHub private vulnerability reporting](https://github.com/oss-singularity/cinnamon-chatgpt-usage/security/advisories/new)
when possible. If that channel is unavailable, contact the repository owner
privately through the address published on the owner's GitHub profile.

Do not open a public issue containing credentials, tokens, Codex account files,
private paths, complete analytics responses or screenshots with account-specific
data. Include the smallest reproducible description, affected version, Linux
Mint and Cinnamon versions, selected backend type/version, expected security boundary and a
safe synthetic reproduction when possible.

## Security boundaries

- Authentication and network access remain the selected official backend's
  responsibility. The applet does not read its credential files.
- Normal refreshes send one read-only `account/rateLimits/read` request.
- Only explicit confirmation starts `account/rateLimitResetCredit/consume`.
  No startup, refresh, discovery or timer path redeems a reset.
- A timeout or lost reply leaves an unknown outcome. A private journal stores
  the idempotency key, selected opaque credit ID (if any) and backend path
  before dispatch. Retrying requires a new confirmation and reuses that same
  request. A recognized result clears the journal; corrupt journal data
  disables redemption. Keep the same account until the attempt is resolved.
- The normalized snapshot and available credit details stay in memory. History
  stores only model/window keys, sample times, percentages and window reset
  timestamps for eight days, capped at 10,000 samples. It never stores full
  provider responses, prompts, tokens or credit balances.
- History and the unresolved-reset journal live under
  `$XDG_STATE_HOME/cinnamon-chatgpt-usage` (normally `~/.local/state/...`), in
  files created with mode `0600`. Newly created state directories use `0700`.
  Uninstall retains these files and settings. The journal persists until its
  attempt is resolved; it has no automatic expiry that could enable a second
  logical redemption.
- History is local to a desktop profile, not partitioned by account. Follow
  the documented tracking reset procedure before changing accounts. A backend
  path match alone cannot establish that the signed-in account is unchanged.
- Backend commands receive argument arrays, never shell-interpolated paths.
  Discovery and version probes run outside Cinnamon's UI thread. Each version
  probe has a two-second deadline and a bounded output buffer.
- JSON-lines transport limits response size and request time, and terminates
  and reaps its backend process group on completion or cancellation. Applet
  removal sends SIGTERM to the helper so cleanup can finish.
- Web shortcuts open fixed official ChatGPT URLs. No unrelated telemetry or
  network endpoint is used by this project.

## Out of scope and inherited risk

The project does not defend against a malicious process already running as the
same desktop user. Codex, ChatGPT, Cinnamon, Python and the operating system are
external trust boundaries. Report an upstream vulnerability to its owner and
also report it here privately if this integration makes the impact worse.
