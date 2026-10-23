#!/usr/bin/env bash
# Always keep the terminal open so errors are visible.
export PATH="$HOME/.local/bin:$HOME/.npm-global/bin:$HOME/.nvm/current/bin:$PATH"
helper="$HOME/.local/share/cinnamon/applets/codex-meter@Icators/helper.py"
printf 'Codex Quota Meter — Add account\n\n'
python3 "$helper" "${1:-add}"
result=$?
printf '\n'
if [ "$result" -ne 0 ]; then
  printf 'Login failed (exit code %s). See the error above.\n' "$result"
else
  printf 'Login completed. Refresh the applet to see your account.\n'
fi
read -r -p 'Press Enter to close this window...' _
