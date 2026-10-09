# Security policy

Z Usage Monitor reads Z.ai account-level quota limits through the public
Z.ai usage monitor API and optional ZCode plan balances through the ZCode
billing endpoint. Credentials are an optional user-configured Z.ai API key
(applet setting, `ZAI_API_KEY` environment variable or
`~/.config/cinnamon-z-usage/api-key`), with automatic fallback to the
Coding Plan API key cached by a signed-in ZCode app. The applet never
writes credentials and persists only normalized usage numbers. Please use
a private channel for anything that could expose Z.ai or ZCode
authentication data.

## Supported versions

Security fixes target the latest published release and the current `main`
branch. Older releases do not receive separate backports; users should
update to the latest supported release.

| Version        | Security support             |
| -------------- | ---------------------------- |
| Latest release | Supported                    |
| Current `main` | Supported development branch |
| Older releases | Upgrade first                |

## Reporting a vulnerability

Use [GitHub private vulnerability reporting](https://github.com/oss-singularity/cinnamon-z-usage/security/advisories/new)
when possible. If that channel is unavailable, contact the repository owner
privately through the address published on the owner's GitHub profile.

Do not open a public issue containing credentials, tokens, account files,
private paths, complete API responses or screenshots with account-specific
data. Include the smallest reproducible description, affected version, Linux
Mint and Cinnamon versions, the configured credential source, expected
security boundary and a safe synthetic reproduction when possible.

## Security boundaries

- Network access is limited to read-only `GET` requests against
  `https://api.z.ai` and `https://zcode.z.ai`; the applet never sends
  analytics, prompts or account content anywhere.
- The monitor request carries the resolved Z.ai API key as a plain
  `Authorization` header. The plan-balance request reuses the signed-in
  ZCode app's cached key and client headers; no credential file of the
  ZCode app is modified.
- The normalized snapshot stays in memory. History stores only
  model/window keys, sample times, percentages, window reset timestamps
  and sampled numeric credit balances needed to derive observed
  consumption for eight days, capped at 10,000 samples. It never stores
  full provider responses, prompts or tokens.
- History lives under `$XDG_STATE_HOME/cinnamon-z-usage` (normally
  `~/.local/state/...`), in files created with mode `0600`. Newly created
  state directories use `0700`. Uninstall retains these files and
  settings.
- History is local to a desktop profile, not partitioned by account.
  Follow the documented tracking reset procedure before changing
  accounts.
- The Python helper is spawned with argument arrays, never
  shell-interpolated paths, with a bounded response buffer and request
  timeout; applet removal cancels and reaps it so cleanup can finish.
- A short-lived plan-balance cache is replayed when the balance endpoint
  is rate-limited; it contains only normalized quota numbers.
- Web shortcuts open fixed official Z.ai pages (chat, usage dashboard,
  API key management). No unrelated telemetry or network endpoint is used
  by this project.

## Out of scope and inherited risk

The project does not defend against a malicious process already running as
the same desktop user. Z.ai, ZCode, Cinnamon, Python and the operating
system are external trust boundaries. Report an upstream vulnerability to
its owner and also report it here privately if this integration makes the
impact worse.
