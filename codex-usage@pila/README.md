# Codex Usage

A Cinnamon panel applet that shows Codex token statistics and current account rate limits.

## Features

- Shows the 5-hour and weekly Codex usage windows directly in the panel.
- Can show today's local token count instead of rate limits.
- Popup details include today, week and month token totals, sessions, cache share, model and reasoning effort.
- Reads Codex session history incrementally and keeps only statistical data in a private local cache.
- Uses the authenticated Codex app-server for current account limits. The applet does not read or store Codex credentials.
- Runs collection outside the Cinnamon UI thread.
- Uses GNU gettext for localization.

## Requirements

- Cinnamon desktop.
- Python 3.
- Codex CLI already installed and signed in.
- Local Codex session history under `~/.codex`.

The applet is intended for people who already use Codex. If the Codex app-server is unavailable, local token statistics remain available and the most recent unexpired limit snapshot may be shown as stale.

## Installation

Install **Codex Usage** from Cinnamon System Settings:

1. Open **System Settings**.
2. Open **Applets**.
3. Select the **Download** tab.
4. Search for **Codex Usage** and install it.
5. Return to **Manage** and add it to the panel.

## Configuration

Right-click the applet and choose **Configure**.

Available settings:

- **Panel display**: rate limits or daily tokens.
- **Refresh interval**: 30 to 3600 seconds.
- **Mark limit snapshots stale after**: 60 to 3600 seconds.

## Translations

English is the source language. Included translations:

- Spanish
- German
- French
- Italian
- Brazilian Portuguese
- Polish

Translations cover the panel, popup, metadata and settings UI.

## Privacy

Codex session files are opened read-only. Prompts, responses, code, credentials, account IDs and credit details are not stored by this applet.

The local cache contains only hashed identifiers, file offsets, token counters, timestamps and allowlisted model and limit metadata. It is stored under the user's cache directory with restrictive permissions.

## Compatibility

Tested on Linux Mint 22.3 with Cinnamon 6.6.

## License

GPL-3.0.

This is an independent community project and is not affiliated with, endorsed by, or supported by OpenAI. Codex and the Codex logo are trademarks of OpenAI.
