"""Logging for Lumendusk.

The daemon is normally started detached with its output sent to ``/dev/null``
(see ``install.sh``), so anything printed to the console is lost. Every
diagnostic therefore also goes to a small rotating log file, which is the first
place to look when something misbehaves:

    ~/.local/state/lumendusk/lumendusk.log

Plain program *output* (e.g. the table from ``brightness list``) still uses
``print`` — that is the CLI talking to the user, not a diagnostic.
"""

from __future__ import annotations

import logging
import os
from logging.handlers import RotatingFileHandler
from pathlib import Path

_LOGGER_NAME = "lumendusk"
_configured = False


def state_dir() -> Path:
    base = os.environ.get("XDG_STATE_HOME") or (Path.home() / ".local" / "state")
    return Path(base) / "lumendusk"


def log_path() -> Path:
    return state_dir() / "lumendusk.log"


def _configure() -> logging.Logger:
    """Attach a stderr handler and (best effort) a rotating file handler."""
    global _configured
    logger = logging.getLogger(_LOGGER_NAME)
    if _configured:
        return logger

    logger.setLevel(logging.INFO)
    logger.propagate = False

    console = logging.StreamHandler()
    console.setFormatter(logging.Formatter("[lumendusk] %(message)s"))
    logger.addHandler(console)

    # A read-only or missing state dir must never stop the app from running.
    try:
        path = log_path()
        path.parent.mkdir(parents=True, exist_ok=True)
        file_handler = RotatingFileHandler(
            path, maxBytes=256 * 1024, backupCount=1, encoding="utf-8"
        )
        file_handler.setFormatter(
            logging.Formatter("%(asctime)s %(levelname)-7s %(message)s")
        )
        logger.addHandler(file_handler)
    except OSError:
        pass

    _configured = True
    return logger


def info(msg: str, *args: object) -> None:
    _configure().info(msg, *args)


def warning(msg: str, *args: object) -> None:
    _configure().warning(msg, *args)


def error(msg: str, *args: object) -> None:
    _configure().error(msg, *args)


def exception(msg: str, *args: object) -> None:
    """Log an error plus the current traceback (file log only carries it)."""
    _configure().exception(msg, *args)


__all__ = ["error", "exception", "info", "log_path", "state_dir", "warning"]
