"""Command-line entry point: ``python3 -m lumendusk`` / ``lumendusk``."""

from __future__ import annotations

import sys

from .cli import main

if __name__ == "__main__":
    sys.exit(main())
