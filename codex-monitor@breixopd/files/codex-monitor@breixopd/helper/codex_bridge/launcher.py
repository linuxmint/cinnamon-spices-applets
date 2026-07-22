"""Safe default-terminal launch operations for Codex sessions."""

from __future__ import annotations

import os
from pathlib import Path
import subprocess
import uuid


class TerminalLauncher:
    def __init__(
        self,
        codex,
        *,
        terminal="x-terminal-emulator",
        popen=None,
        default_cwd=None,
    ):
        self.codex = codex
        self.terminal = terminal
        self.popen = popen or subprocess.Popen
        self.default_cwd = Path(default_cwd or Path.home())

    def open_codex(self):
        self._spawn([self.terminal, "-e", self.codex], cwd=self._safe_cwd(None))
        return {"launched": True}

    def open_session(self, thread_id, cwd=None):
        try:
            normalized = str(uuid.UUID(thread_id))
        except (ValueError, AttributeError, TypeError):
            raise ValueError("Invalid thread identifier") from None
        if not isinstance(thread_id, str) or normalized != thread_id.lower():
            raise ValueError("Invalid thread identifier")
        self._spawn(
            [self.terminal, "-e", self.codex, "resume", normalized],
            cwd=self._safe_cwd(cwd),
        )
        return {"launched": True}

    def _safe_cwd(self, value):
        if isinstance(value, str) and os.path.isabs(value) and os.path.isdir(value):
            return value
        return str(self.default_cwd)

    def _spawn(self, command, *, cwd):
        try:
            self.popen(
                command,
                shell=False,
                cwd=cwd,
                stdin=subprocess.DEVNULL,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                close_fds=True,
                start_new_session=True,
            )
        except OSError:
            raise RuntimeError("Unable to open the default terminal") from None
