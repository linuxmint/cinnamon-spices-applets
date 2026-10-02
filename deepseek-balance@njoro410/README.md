# DeepSeek Balance

Shows your [DeepSeek](https://platform.deepseek.com) API account balance in the
Cinnamon panel as a percentage or a progress bar, with spend details on hover.
The DeepSeek logo in the panel is tinted while peak-rate billing hours are
active.

## Install

Install **DeepSeek Balance** from the Applets section of Cinnamon System
Settings (Download tab), then add it to the panel from the Manage tab.

## Configure

Right-click the applet → **Configure…**

| Option | What it does |
| --- | --- |
| API key | From platform.deepseek.com → API keys |
| Currency | Which balance to show if the account holds more than one |
| Refresh interval | Minutes between balance checks (default 5) |
| Show in panel | Percentage / Bar / Bar + percentage / Balance amount |
| Bar color | The bar's fill color; still turns red below the warning threshold |
| Peak-hours logo | Tint the panel logo while peak-rate hours apply |
| Peak logo color | Color the logo switches to during peak hours |
| Reference amount | The "100%" level — e.g. your last top-up |
| Turn red below | Warning threshold, in % of the reference |

## What it shows

- **Panel** — the DeepSeek logo and the chosen display mode; turns red below
  the warning threshold, and the logo is tinted during peak-rate hours.
- **Hover** — balance, paid/granted breakdown, whether the account can still
  make API calls, peak/off-peak rate and when it flips, percent of reference
  remaining, spend for today / last 7 days / last 30 days, and a rough
  "days left" estimate at the current rate.
- **Click** — a menu with the same summary, "Refresh now", and a link to the
  DeepSeek platform dashboard.

## Where the numbers come from

The only official API-key endpoint is
`GET https://api.deepseek.com/user/balance`, which reports the balance — not
token counts. Spend figures are therefore inferred from balance changes the
applet records over time in
`~/.local/state/deepseek-balance@njoro410/history.json`:

- only decreases count as spend (top-ups are ignored);
- the paid/granted split describes the *current* balance, not your original
  top-up total — the API doesn't report how much was ever topped up, which is
  why the percentage uses a reference amount you configure;
- coverage is limited to when the applet was running, so long gaps between
  refreshes can slightly under-count;
- token counts are not available from the API — the platform dashboard shows
  them per API key.

## Privacy and your API key

The applet's only network traffic is HTTPS requests to DeepSeek's official
balance endpoint (`api.deepseek.com/user/balance`), carrying your API key in
the request header. It goes to DeepSeek and nowhere else — no telemetry, no
analytics, no third-party service — and it's encrypted in transit by TLS.

The key itself is stored locally, in Cinnamon's per-applet settings directory
(`~/.config/cinnamon/spices/deepseek-balance@njoro410/`), as plain text, the
same way most CLI tools keep credentials. Treat it as a secret on your
machine, and if it ever leaks, delete it at
[platform.deepseek.com](https://platform.deepseek.com/api_keys) and issue a
new one. Spend history stays local too — it lives in
`~/.local/state/deepseek-balance@njoro410/history.json`.

## Peak-hour pricing

DeepSeek bills API usage at 2× during peak hours — Monday to Friday,
09:00–12:00 and 14:00–18:00 Beijing time (01:00–04:00 and 06:00–10:00 UTC).
Everything else is off-peak at half price, including weekends. Chinese public
holidays are off-peak too, but the applet can't detect those, so it may show
peak on a holiday. The logo tint and the tooltip's "Peak hours" line follow
this schedule; DeepSeek can change it, so check platform.deepseek.com when in
doubt.

## License

GPL-2.0-or-later — see the LICENSE file. Copyright (C) 2026 njoro410.
