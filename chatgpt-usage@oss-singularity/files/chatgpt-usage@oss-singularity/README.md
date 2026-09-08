# ChatGPT Usage Monitor for Cinnamon

An independent OSS Singularity applet showing ChatGPT Work and Codex limits,
reset times, credits and observed consumption on horizontal or vertical panels.

Targets Cinnamon 6.6, tested on 6.6.9. Requires Python 3.10 or newer and a signed-in Codex CLI or a ChatGPT desktop
package containing `resources/codex`. The applet never installs a backend or
reads its credentials. Both setup and settings offer optional codex-cli and
ChatGPT-app paths, automatic path hints and Recheck. The CLI is preferred;
the app path also helps locate its bundled backend.

Open the popup to refresh, inspect each model's limits, or launch the apps and
web shortcuts. An earned reset requires a fresh acknowledgment checkbox before
the action becomes available. If its outcome
is unknown, retry the saved request using the same account. Do not switch
accounts until that attempt is resolved.

The white panel text color and the blue/yellow/pink usage colors are configured
separately; a panel switch lets threshold colors take precedence. Model-specific
panel mode selects the tightest remaining quota for each duration. A separate
global switch hides model-specific limits from the popup, history and panel.
Notification defaults are enabled and delivered alerts remain in the center.
Normal text uses a 420 px popup; larger text scales the layout and long menus
scroll to keep actions reachable. Rings and charts stay aligned with the buttons
when model-specific limits are hidden. English is the fallback language;
the bundled gettext template prepares future translations.

Usage history stores eight days of sampled percentages and reset timestamps.
It reports observed changes, including incomplete periods marked with `~`, and
cannot reconstruct consumption between samples. Its state is local to this
desktop profile, not partitioned by account; see the full guide before switching
accounts. Uninstalling retains settings, history and unresolved reset attempts.

- [Full guide and screenshots](https://github.com/oss-singularity/cinnamon-chatgpt-usage#readme)
- [Support and bug reports](https://github.com/oss-singularity/cinnamon-chatgpt-usage/issues)
- [Security policy](https://github.com/oss-singularity/cinnamon-chatgpt-usage/blob/main/SECURITY.md)
- [Code license](https://github.com/oss-singularity/cinnamon-chatgpt-usage/blob/main/LICENSE)
- [Artwork attribution](https://github.com/oss-singularity/cinnamon-chatgpt-usage/blob/main/ATTRIBUTION.md)

Code is GPL-3.0-or-later. Bundled Yaru action icons are CC-BY-SA-4.0. LICENSE,
SECURITY.md, ATTRIBUTION.md and the icon notices are also included in the
installed applet directory. OpenAI, ChatGPT and Codex are OpenAI trademarks.
This community applet is not affiliated with or endorsed by OpenAI.
