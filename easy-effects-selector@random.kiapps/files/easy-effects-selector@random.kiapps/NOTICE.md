# License and attribution

EasyEffects Preset Selector is distributed under **GPL-3.0-or-later**.
Copyright (C) 2026 random.kiapps. The full GPL version 3 text is in `LICENSE`.

`icon.svg` is the unmodified EasyEffects 7.2.3 application icon from
`data/com.github.wwmm.easyeffects.svg`. `icon.png` is its 64-pixel rendering for
Cinnamon Spices. The icon is included under the EasyEffects project's GPL
version 3 or later terms. Original source:

https://github.com/wwmm/easyeffects/blob/v7.2.3/data/com.github.wwmm.easyeffects.svg

`ee-bypass-symbolic.svg` is the unmodified EasyEffects 7.2.3 global-bypass
symbol from its application resources, under the same GPL version 3 or later
terms. It is bundled so that the menu button does not depend on the icon being
available in the desktop's icon theme. Original source:

https://github.com/wwmm/easyeffects/blob/v7.2.3/data/icons/scalable/emblems/ee-bypass-symbolic.svg

`preset-map.json` maps the fields stored by the EasyEffects 7.2.3 preset
serializers to their GSettings keys and paths. The mapping was generated from
the original serializers and checked against the loader code and XML schemas.
Those serializers are copyright Wellington Wallace and EasyEffects
contributors and are licensed under GPL version 3 or later. For example, the
bass enhancer serializer carries Copyright (C) 2017-2024 Wellington Wallace.

https://github.com/wwmm/easyeffects/tree/v7.2.3/src
https://github.com/wwmm/easyeffects/tree/v7.2.3/data/schemas

Source revision: `e9a3c631c8533664711b6613f14b8c860ef188dc`.

`deviation-dot.svg` uses the colors of the EasyEffects icon in a separately
drawn circular indicator. The applet continues to use the installed symbolic
EasyEffects icon in the panel.

No EasyEffects executable, library, GSettings schema, or compiled translation
is bundled with the applet. EasyEffects remains a dependency installed from the
user's distribution.
