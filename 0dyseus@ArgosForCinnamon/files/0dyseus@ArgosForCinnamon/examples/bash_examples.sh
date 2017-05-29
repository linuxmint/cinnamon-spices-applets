#!/bin/bash

# The following two line will display on the applet, but not on the menu
# thanks to the attribute "dropdown" set to false.
# When there is more than one line, they will "rotate".
echo "Argos line 1 | iconName=folder dropdown=false"
echo "Argos line 2 | iconName=folder iconIsSymbolic=true dropdown=false"

# Separator
echo "---"

echo "<b>eval, tooltip and alternate examples</b> | iconName=folder iconSize=24 size=12"
echo "--<i><b>Press Alt key to see effect</b></i>"
echo "--Default item - eval example | iconName=folder tooltip='Default item tooltip - Press Alt key to display alternate item' eval='imports.ui.main.notify(\"Default item\", \"Notification activated by default item.\");'"
echo "--Alternate item - eval example | iconName=folder iconIsSymbolic=true tooltip='Alternate item tooltip' eval='imports.ui.main.notify(\"Alternate item\", \"Notification activated by alternate item.\");' alternate=true"
echo "--Default - PyGObject API Reference - URL example | iconName=folder href='https://lazka.github.io/pgi-docs/'"
echo "--Alternate - DistroWatch - URL example | iconName=folder iconIsSymbolic=true href='http://distrowatch.com/' alternate=true"
echo "--Default - Looking Glass log - URI to file example | iconName=folder href='~/.cinnamon/glass.log'"
echo "--Alternate - xsession-errors log - URI to file example | iconName=folder iconIsSymbolic=true href='~/.xsession-errors' alternate=true"

# Separator
echo "---"

echo "<b>Menu and submenu examples</b> | iconName=folder iconSize=24 size=12"
echo "--Sub menu level 2"
echo "----Sub menu item level 2"
echo "----Sub menu level 3"
echo "------Sub menu item level 3"
echo "------Sub menu level 4"
echo "--------Sub menu item level 4"

# Separator
echo "---"

echo "<b>Menu items with icons examples</b> | iconName=folder iconSize=24 size=12"
echo "--<b><i>A default icon size can be set on the applet settings window</i></b>"
echo "--Item with a 12 pixels symbolic icon | iconName=folder iconSize=12 iconIsSymbolic=true"
echo "--Item with a 14 pixels icon | iconName=folder iconSize=14"
echo "--Item with a 16 pixels symbolic icon | iconName=folder iconSize=16 iconIsSymbolic=true"
echo "--Item with a 18 pixels icon | iconName=folder iconSize=18"
echo "--Item with a 20 pixels symbolic icon | iconName=folder iconSize=20 iconIsSymbolic=true"

# Separator
echo "---"

echo "<b>ANSI colors and emojis examples</b> | iconName=folder iconSize=24 size=12"
echo "--\033[34mANSI colors example :smile:\033[0m | ansi=true size=20"
echo "--\033[30m:smiley_cat: \033[31m:smile_cat: \033[32m:joy_cat: \033[33m:heart_eyes_cat: \033[34m:smirk_cat: \033[35m:kissing_cat: \033[36m:scream_cat: | ansi=true size=20"
echo "--\033[30m:smiley: \033[31m:smile: \033[32m:joy: \033[33m:heart_eyes: \033[34m:smirk: \033[35m:kissing: \033[36m:scream: | ansi=true size=20"

# Separator
echo "---"

echo "<b>Pango markup examples</b> | iconName=folder iconSize=24 size=12"
echo "--<b>Convenience tags</b> | size=12"
echo "--<b>Bold text</b> - <i>Italic text</i> - <s>Strikethrough text</s> - <u>Underline text</u> | size=12"
echo "--Subscript text<sub>Subscript text</sub> - Superscript text<sup>Superscript text</sup> | size=12"
echo "--<big>Big text</big> - <small>Small text</small> - <tt>Monospace font</tt> | size=12"

# For a complete list of attributes go to:
# https://developer.gnome.org/pango/stable/PangoMarkupFormat.html
echo "--<b>&lt;span&gt; attributes</b> | size=12"
echo "--<span font_weight='bold' bgcolor='#FF0000' fgcolor='#FFFF00'>Background and foreground colors</span> | size=12"
echo "--<span underline='single' underline_color='#FF0000'>Single underline</span> | size=12"
echo "--<span underline='double' underline_color='#00FF00'>Double underline</span> | size=12"
echo "--<span underline='low' underline_color='#FF00FF'>Low underline</span> | size=12"
echo "--<span underline='error' underline_color='#00FFFF'>Error underline</span> | size=12"

