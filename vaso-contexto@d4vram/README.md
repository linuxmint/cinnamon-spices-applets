# Vaso de contexto

A glass of water in your panel that fills up as your [Claude Code](https://claude.com/claude-code) session uses its context window, and tells you when it is time to `/compact`, `/clear` or start a new session.

## What it shows

- Panel: a glass icon that fills up and changes colour, plus the percentage of context used.
- Menu: session title, a short piece of advice and the session figures (tokens, turns, compactions).
- A desktop notification when the session reaches the "compact now" or "new session" level.
- "Abrir página completa" opens a local page with the full view.

The interface is in Spanish.

## Requirements

- Claude Code, with at least one session on this machine.
- `python3` (standard library only, nothing to install).

## Privacy

Everything runs locally. The applet reads the session transcripts Claude Code already keeps in `~/.claude/projects` and only extracts the session title and token counts from them. Nothing is sent anywhere.

The optional full page is served on `127.0.0.1` only. This applet makes no network connections to the outside.

## Configuration

If your sessions are not in `~/.claude`, set `CLAUDE_CONFIG_DIR` before Cinnamon starts.
