# Z Usage Monitor for Cinnamon

An independent OSS Singularity applet showing the 5-hour and weekly quota
windows of a Z.ai GLM Coding Plan, reset times, credit balances and observed
consumption on horizontal or vertical panels.

Targets Cinnamon 5.8 or newer (declared series: 5.8, 6.0, 6.2, 6.4 and 6.6);
native validation was performed on 6.6.9. Requires Python 3.10 or newer. The
applet is API-key-less by default: it reuses the Coding Plan API key cached by
the signed-in ZCode app, with optional overrides through the applet setting,
the `ZAI_API_KEY` environment variable or `~/.config/cinnamon-z-usage/api-key`.
All Z.ai requests are read-only.

Open the popup to refresh, inspect the 5h/7d windows and the 24-hour activity
chart, or launch the Z.ai chat, the usage statistics dashboard and the API key
management. Weekly reset and low-usage notifications are configurable.

The panel text color and the blue/yellow/pink usage colors are configured
separately; a panel switch lets threshold colors take precedence. Credits are
optional in the panel and fully visible in the popup.

`z-usage@oss-singularity` is the Z.ai fork of
[cinnamon-chatgpt-usage](https://github.com/oss-singularity/cinnamon-chatgpt-usage)
and shares its git history for upstream backports.
