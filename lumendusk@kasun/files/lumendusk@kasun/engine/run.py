#!/usr/bin/env python3
"""Entry point for the engine bundled inside the Cinnamon applet.

Installing from Cinnamon Spices extracts a zip and runs nothing — no venv, no
pip, no network. So the applet ships the engine and its pure-Python
dependencies beside it, and this script makes them importable without anything
being installed:

    <applet dir>/engine/run.py          this file
    <applet dir>/engine/lumendusk/      the package
    <applet dir>/engine/vendor/         astral, and tomli on Python < 3.11

Copied to ``engine/run.py`` by packaging/build-applet.sh. It is deliberately
tiny and dependency-free, because it runs before anything else is importable.
"""

import os
import sys

_HERE = os.path.dirname(os.path.abspath(__file__))

# Appended, not prepended: a real install of astral or tomli on the system is
# more likely to be current than the copy frozen into this applet, and should
# win. The bundle is a floor, not a ceiling.
sys.path.insert(0, _HERE)
sys.path.append(os.path.join(_HERE, "vendor"))

from lumendusk.cli import main  # noqa: E402  (path set up above)

if __name__ == "__main__":
    sys.exit(main())
