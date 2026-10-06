# AI usage

Your AI quotas, right in the Cinnamon panel. One glance tells you how much of each subscription is used — no browser tabs, no CLIs, no guessing.

![Preview of the full window](https://raw.githubusercontent.com/ClaudioDrews/cinnamon-ai-usage/main/docs/demo.png)

## What it shows

Live usage windows, balances and spend for up to nine services:

Codex · Claude Code · Antigravity · Grok / xAI · Nous Portal · OpenCode Go · DeepSeek · OpenRouter · Meta AI (Muse Code)

- **Single click** — the five most recent services, each with its own bar.
- **Hover** — every service, collection time and warnings in the tooltip.
- **Double click** — the full window, with all metrics, renewals and sources.
- **The robot icon** follows your theme, turns yellow at 70% used and red at 90%.

## Private by design

- Keys live in your system keyring — never in the applet, never shown back.
- Read-only: it never runs inference, buys credit or changes a plan.
- Stale or failed readings are labeled as such; nothing is ever invented as zero.

## Details

- Interface in English and Português (Brasil); follows your session language.
- Automatic refresh every 2 minutes (configurable); Update forces one now.
- Needs only what Mint already ships: Cinnamon, Python 3 and the GTK bindings.
- **First run:** nothing configured yet? The menu itself says how many services have no reading and points to **Credentials…**, the window where keys are entered.

[Source code and full documentation](https://github.com/ClaudioDrews/cinnamon-ai-usage) · [Report an issue](https://github.com/ClaudioDrews/cinnamon-ai-usage/issues) · [Leia em português](https://github.com/ClaudioDrews/cinnamon-ai-usage/blob/main/spice/README.pt-BR.md)

Note: the Claude Code connector is implemented but not yet verified on a real account — reports from subscribers are welcome.
