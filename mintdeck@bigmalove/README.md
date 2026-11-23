# MintDeck

A Dynamic-Island style bar that floats at the top of the screen. It stays collapsed as a small
pill, expands when the pointer moves onto it, and shows three pages:

* **AI usage** — quota slots (5-hour / weekly / context) plus today's and 7-day token or credit
  usage for AI coding tools that store their sessions locally (Claude Code, DeepSeek Harness,
  WorkBuddy).
* **Music** — title, artist and play state of any MPRIS player, with scrollable lyrics.
* **System monitor** — CPU, memory, GPU and network throughput with per-process breakdown.

Everything is drawn by the applet itself with St/Clutter and cairo inside the Cinnamon process,
so there is no second process and no GTK window. The applet is a Linux port of
[BrimDeck](https://github.com/MoFeng2223/BrimDeck) (Windows 11, C#/WPF): geometry, theme files and
data models follow the upstream project, while Windows-only transports (SMTC, PDH, DPAPI, CDP) are
replaced by MPRIS, procfs, JSONL and libsoup.

## Usage

Add **MintDeck** from System Settings → Applets, then move the pointer to the top centre of the
screen. Right-click the bar (or use the applet's context menu) for *Settings*, *Reload data* and
*About*.

Settings (System Settings → Applets → MintDeck → configure):

* **Size** — `auto` (the bar's height and content scale follow how many segments are actually
  drawn) or fixed `compact` / `standard` / `large`.
* **Appearance** — notch, capsule or line; theme selection (8 built-in themes, same file format as
  BrimDeck, so themes can be exchanged between the two).
* **Pages** — which of the three pages are enabled and in which order.
* **Language** — Simplified Chinese, Traditional Chinese, English or Japanese; switching applies
  immediately, no shell restart needed.

## Data sources

| Page | Read from | Notes |
| --- | --- | --- |
| Claude Code | `~/.claude/projects/**/*.jsonl` | local session logs only; online quota is queried with `api.anthropic.com/api/oauth/usage` when `CLAUDE_CODE_OAUTH_TOKEN` or `~/.claude/.credentials.json` exists |
| DeepSeek Harness | `~/.dsh-desktop/sessions/**/*.jsonl.zstd` | decompressed with the `zstd` binary if present, otherwise the entry is skipped |
| WorkBuddy | `~/.workbuddy/workbuddy.db` (`session_usage` table) | read-only query through `python3`'s sqlite3 module; skipped when the file does not exist |
| Music | MPRIS over D-Bus | lyrics fetched from the public NetEase/QQ lyric endpoints when available |
| System monitor | `/proc/stat`, `/proc/meminfo`, `/proc/net/dev`, `nvidia-smi` | GPU column is hidden when `nvidia-smi` is unavailable |

Nothing is uploaded anywhere. Session logs are parsed locally and cached in
`~/.cache/mintdeck/`; no credentials are read or stored by the applet.

Optional external binaries: `zstd` (DeepSeek Harness logs), `python3` (WorkBuddy database),
`nvidia-smi` (GPU readings). Each of the three is optional — the corresponding column degrades to
`—` or is hidden when the tool is missing.

## Notes

* The clock styles use the system font. The upstream repository additionally ships four optional
  OFL fonts; they are not included here to keep the applet free of binary blobs.
* Cinnamon's `imports` cache does not notice changes to `lib/**`; after an applet update log out and
  back in or restart the shell with `Alt+F2` → `r`.

## License

Apache-2.0, as a derivative work of BrimDeck (Apache-2.0). The system monitor palette is adapted
from [ftop](https://github.com/Nongfsq/ftop) (MIT).
