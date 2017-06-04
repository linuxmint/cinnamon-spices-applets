#!/usr/bin/env ruby

# The following two line will display on the applet, but not on the menu
# thanks to the attribute "dropdown" set to false.
# When there is more than one line, they will "rotate".
puts "Argos line 1 | iconName=folder dropdown=false"
puts "Argos line 2 | iconName=folder iconIsSymbolic=true dropdown=false"

# Separator
puts "---"

puts "<b>eval, tooltip and alternate examples</b> | iconName=folder iconSize=24 size=12"
puts "--<i><b>Press Alt key to see effect</b></i>"
puts "--Default item - eval example | iconName=folder tooltip='Default item tooltip - Press Alt key to display alternate item' eval='imports.ui.main.notify(\"Default item\", \"Notification activated by default item.\");'"
puts "--Alternate item - eval example | iconName=folder iconIsSymbolic=true tooltip='Alternate item tooltip' eval='imports.ui.main.notify(\"Alternate item\", \"Notification activated by alternate item.\");' alternate=true"
puts "--Default - PyGObject API Reference - URL example | iconName=folder href='https://lazka.github.io/pgi-docs/'"
puts "--Alternate - DistroWatch - URL example | iconName=folder iconIsSymbolic=true href='http://distrowatch.com/' alternate=true"
puts "--Default - Looking Glass log - URI to file example | iconName=folder href='~/.cinnamon/glass.log'"
puts "--Alternate - xsession-errors log - URI to file example | iconName=folder iconIsSymbolic=true href='~/.xsession-errors' alternate=true"

# Separator
puts "---"

puts "<b>Menu and submenu examples</b> | iconName=folder iconSize=24 size=12"
puts "--Sub menu level 2"
puts "----Sub menu item level 2"
puts "----Sub menu level 3"
puts "------Sub menu item level 3"
puts "------Sub menu level 4"
puts "--------Sub menu item level 4"

# Separator
puts "---"

puts "<b>Menu items with icons examples</b> | iconName=folder iconSize=24 size=12"
puts "--<b><i>A default icon size can be set on the applet settings window</i></b>"
puts "--Item with a 12 pixels symbolic icon | iconName=folder iconSize=12 iconIsSymbolic=true"
puts "--Item with a 14 pixels icon | iconName=folder iconSize=14"
puts "--Item with a 16 pixels symbolic icon | iconName=folder iconSize=16 iconIsSymbolic=true"
puts "--Item with a 18 pixels icon | iconName=folder iconSize=18"
puts "--Item with a 20 pixels symbolic icon | iconName=folder iconSize=20 iconIsSymbolic=true"

# Separator
puts "---"

puts "<b>ANSI colors and emojis examples</b> | iconName=folder iconSize=24 size=12"
puts "--\033[34mANSI colors example :smile:\033[0m | ansi=true size=20"
puts "--\033[30m:smiley_cat: \033[31m:smile_cat: \033[32m:joy_cat: \033[33m:heart_eyes_cat: \033[34m:smirk_cat: \033[35m:kissing_cat: \033[36m:scream_cat: | ansi=true size=20"
puts "--\033[30m:smiley: \033[31m:smile: \033[32m:joy: \033[33m:heart_eyes: \033[34m:smirk: \033[35m:kissing: \033[36m:scream: | ansi=true size=20"

# Separator
puts "---"

puts "<b>Pango markup examples</b> | iconName=folder iconSize=24 size=12"
puts "--<b>Convenience tags</b> | size=12"
puts "--<b>Bold text</b> - <i>Italic text</i> - <s>Strikethrough text</s> - <u>Underline text</u> | size=12"
puts "--Subscript text<sub>Subscript text</sub> - Superscript text<sup>Superscript text</sup> | size=12"
puts "--<big>Big text</big> - <small>Small text</small> - <tt>Monospace font</tt> | size=12"

# For a complete list of attributes go to:
# https://developer.gnome.org/pango/stable/PangoMarkupFormat.html
puts "--<b>&lt;span&gt; attributes</b> | size=12"
puts "--<span font_weight='bold' bgcolor='#FF0000' fgcolor='#FFFF00'>Background and foreground colors</span> | size=12"
puts "--<span underline='single' underline_color='#FF0000'>Single underline</span> | size=12"
puts "--<span underline='double' underline_color='#00FF00'>Double underline</span> | size=12"
puts "--<span underline='low' underline_color='#FF00FF'>Low underline</span> | size=12"
puts "--<span underline='error' underline_color='#00FFFF'>Error underline</span> | size=12"

