# CotaBar

See how much of your AI coding limits you have used, right on the panel:
**Claude Code**, **Antigravity (Gemini)**, **Codex (ChatGPT)** and **GitHub Copilot**.

Each tool is a double ring with its letter in the middle:

- **outer ring**: long window (week or month)
- **inner ring**: short window (5 hours or day)
- next to it, both percentages with the period letter (**H** hours, **D** day, **W** week,
  **M** month). They turn amber at 80% and red at 95%.

Click it to see every limit with a bar, the percentage and when it resets.

The interface is in English, Spanish and Portuguese.

## Where the numbers come from

The applet runs a small Python script (`cotabar-coletor`, standard library only) every few
minutes. It borrows the login each tool already has on this computer and asks the same
usage endpoint the tool itself uses:

| Tool | Login file it reads | Endpoint |
|---|---|---|
| Claude Code | `~/.claude/.credentials.json` | `api.anthropic.com/api/oauth/usage` |
| Antigravity (`agy`) | `~/.gemini/antigravity-cli/antigravity-oauth-token` | `cloudcode-pa.googleapis.com` quota summary |
| Codex | `~/.codex/auth.json` | `chatgpt.com/backend-api/wham/usage` |
| GitHub Copilot | `gh auth token` | `api.github.com/copilot_internal/user` |

- It never refreshes a token (that would log the running tool out) and never writes one.
  The result saved to `~/.cache/cotabar/usuario.json` holds only percentages and reset times.
- Nothing is sent anywhere else.
- Tools that are not installed are hidden.

Codex support follows the official endpoint but has not been tested with a real account yet.
Reports are welcome.

## Settings

- one switch per tool, and whether to hide the ones that are not installed
- how often to check (default 5 minutes)
- which numbers to show next to the ring, and the period letter
- language: automatic, English, Spanish or Portuguese

Source code and issues: https://github.com/Davicjc/cotabar
