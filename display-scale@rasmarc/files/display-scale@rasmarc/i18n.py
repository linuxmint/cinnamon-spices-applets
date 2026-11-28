"""Private gettext catalog for helpers and file-loaded settings widgets."""

import gettext
from pathlib import Path

DOMAIN = "display-scale@rasmarc"
# Match Cinnamon 6.6's native settings and About dialogs. They read this
# fixed user locale directory, including when XDG_DATA_HOME is customized.
_catalog = gettext.translation(DOMAIN, str(Path.home() / ".local/share/locale"), fallback=True)
_catalog.add_fallback(gettext.translation(DOMAIN, str(Path(__file__).with_name("locale")), fallback=True))
_ = _catalog.gettext
