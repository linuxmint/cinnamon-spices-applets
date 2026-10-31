# License and attribution

Easy Effects Preset Selector is distributed under **GPL-3.0-or-later**.
Copyright (C) 2026 randomkiapps. The full GPL version 3 text is in `LICENSE`.

`easy-effects-selector-logo-template.svg` is the neutral monochrome form for the
applet logo. Its two faders are based on the Easy Effects 7.2.3 symbolic icon;
the three preset-choice positions and revised layout form the applet's own logo.
`easy-effects-selector-logo-about-symbolic.svg`, `icon.svg` and its 256-pixel
`icon.png` rendering are derived from that form under GPL-3.0-or-later.
Original fader reference:

https://github.com/wwmm/easyeffects/blob/v7.2.3/data/com.github.wwmm.easyeffects-symbolic.svg

`about.py` uses the installed Cinnamon About dialog for metadata and translations.
Its adapter displays the named symbolic logo in the actual GTK text color at 48 px.

`ee-bypass-symbolic.svg` is the unmodified Easy Effects 7.2.3 global-bypass
symbol from its application resources, under the same GPL version 3 or later
terms. It is bundled so that the menu button does not depend on the icon being
available in the desktop's icon theme. Original source:

https://github.com/wwmm/easyeffects/blob/v7.2.3/data/icons/scalable/emblems/ee-bypass-symbolic.svg

`preset-map.json` maps the fields stored by the Easy Effects 7.2.3 preset
serializers to their GSettings keys and paths. The mapping was generated from
the original serializers and checked against the loader code and XML schemas.
Those serializers are copyright Wellington Wallace and Easy Effects
contributors and are licensed under GPL version 3 or later. For example, the
bass enhancer serializer carries Copyright (C) 2017-2024 Wellington Wallace.

https://github.com/wwmm/easyeffects/tree/v7.2.3/src
https://github.com/wwmm/easyeffects/tree/v7.2.3/data/schemas

Source revision: `e9a3c631c8533664711b6613f14b8c860ef188dc`.

`deviation-dot.svg` uses the colors of the Easy Effects icon in a separately
drawn circular indicator. The applet continues to use the installed symbolic
Easy Effects icon in the panel.

No Easy Effects executable, library, GSettings schema, or compiled translation
is bundled with the applet. Easy Effects remains a dependency installed from the
user's distribution.
